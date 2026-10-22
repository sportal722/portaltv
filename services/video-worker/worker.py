"""Bounded RTSP -> HLS/WebM-DASH/thumbnail worker. No viewer spawns encoders."""
import base64
import json
import os
import re
import shutil
import signal
import subprocess
import time
import urllib.request
from pathlib import Path
from urllib.parse import quote

ROOT = Path(os.environ.get('MEDIA_ROOT', '/media'))
PUBLIC = ROOT / 'public'
TOKEN = os.environ.get('MEDIAMTX_API_PASSWORD', '')
API = os.environ.get('WORKER_API_URL', 'http://127.0.0.1:3100/api/video/jobs')
RTSP = os.environ.get('WORKER_RTSP_URL', 'rtsp://127.0.0.1:8554')
LIMIT = max(1, min(4, int(os.environ.get('WORKER_MAX_STREAMS', '2'))))
PATH = re.compile(r'^live/[a-f0-9]{32}$')
running = True


def command(source, directory):
    """One input decode shared by all outputs, explicit CPU/bitrate bounds."""
    hls, dash = directory / 'hls', directory / 'dash'
    hls.mkdir(parents=True); dash.mkdir()
    filters = ("[0:v:0]fps=30,scale=w='min(1280,iw)':h='min(720,ih)':"
               "force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1,split=3[main][web][thumb];"
               "[web]fps=24,scale=w='min(854,iw)':h='min(480,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2[compat];"
               "[thumb]fps=1/10,scale=w='min(480,iw)':h='min(270,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2[image]")
    audio = ['-ac', '2', '-ar', '48000', '-af', 'aresample=async=1:first_pts=0']
    return ['ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
            '-threads', '2', '-rtsp_transport', 'tcp', '-timeout', '15000000', '-i', source,
            '-filter_complex_threads', '2', '-filter_complex', filters,
            '-map', '[main]', '-map', '0:a:0?', '-c:v', 'libx264', '-preset', 'veryfast',
            '-profile:v', 'main', '-level:v', '3.1', '-pix_fmt', 'yuv420p', '-threads', '2',
            '-g', '60', '-keyint_min', '60', '-sc_threshold', '0', '-b:v', '2400k',
            '-maxrate', '2800k', '-bufsize', '5600k', '-c:a', 'aac', '-b:a', '128k', *audio,
            '-f', 'hls', '-hls_time', '2', '-hls_list_size', '8', '-hls_delete_threshold', '4',
            '-hls_flags', 'delete_segments+independent_segments+temp_file',
            '-hls_segment_filename', str(hls / 'segment_%09d.ts'), str(hls / 'index.m3u8'),
            '-map', '[compat]', '-map', '0:a:0?', '-c:v', 'libvpx-vp9', '-deadline', 'realtime',
            '-cpu-used', '8', '-row-mt', '1', '-threads', '2', '-pix_fmt', 'yuv420p',
            '-b:v', '900k', '-crf', '35', '-g', '48', '-c:a', 'libopus', '-b:a', '96k', *audio,
            '-f', 'dash', '-dash_segment_type', 'webm', '-seg_duration', '2', '-window_size', '8',
            '-extra_window_size', '4', '-remove_at_exit', '1', '-use_template', '1', '-use_timeline', '1',
            str(dash / 'manifest.mpd'),
            '-map', '[image]', '-c:v', 'mjpeg', '-q:v', '4', '-threads', '1',
            '-update', '1', '-atomic_writing', '1', '-f', 'image2', str(directory / 'thumbnail.jpg')]


def atomic_json(path, value):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value))
    temporary.replace(path)


def desired():
    request = urllib.request.Request(API, headers={'Authorization': 'Bearer ' + TOKEN})
    with urllib.request.urlopen(request, timeout=5) as response:
        items = json.load(response)['data']
    if not isinstance(items, list):
        raise ValueError('Invalid job response')
    return {item['path'] for item in items if isinstance(item, dict) and PATH.fullmatch(item.get('path', ''))}


class Job:
    def __init__(self, path):
        self.path = path
        self.directory = PUBLIC / path.split('/')[1]
        self.process = None
        self.started = 0
        self.next_start = 0
        self.failures = 0
        self.generation = ''

    def stop(self):
        if self.process is not None:
            if self.process.poll() is None:
                self.process.terminate()
                try: self.process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    self.process.kill(); self.process.wait()
            self.process = None
        shutil.rmtree(self.directory, ignore_errors=True)

    def tick(self, now):
        if self.process is not None:
            hls = self.directory / self.generation / 'hls/index.m3u8'
            stale = now - (hls.stat().st_mtime if hls.exists() else self.started) > 30
            if self.process.poll() is not None or stale:
                self.stop()
                self.failures += 1
                self.next_start = now + min(30, 2 ** min(self.failures, 5))
                print('encoder_retry', self.path, self.failures, flush=True)
        if self.process is None and now >= self.next_start:
            self.generation = os.urandom(8).hex()
            output = self.directory / self.generation
            output.mkdir(parents=True)
            source = RTSP.replace('rtsp://', 'rtsp://nexora-api:' + quote(TOKEN, safe='') + '@', 1) + '/' + self.path
            self.process = subprocess.Popen(command(source, output), stdin=subprocess.DEVNULL,
                                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            self.started = now
            print('encoder_started', self.path, flush=True)
        output = self.directory / self.generation
        hls, dash, thumb = output / 'hls/index.m3u8', output / 'dash/manifest.mpd', output / 'thumbnail.jpg'
        ready = all(p.exists() and now - p.stat().st_mtime < 20 for p in (hls, dash))
        if ready and now - self.started > 60: self.failures = 0
        return {'state': 'ready' if ready else ('retrying' if self.failures else 'starting'),
                'generation': self.generation, 'updatedAt': int(now * 1000),
                'thumbnailAt': int(thumb.stat().st_mtime * 1000) if ready and thumb.exists() and now-thumb.stat().st_mtime < 30 else None}


def main():
    global running
    if len(TOKEN) < 32: raise RuntimeError('A private worker credential is required')
    PUBLIC.mkdir(parents=True, exist_ok=True)
    # Only worker-owned hex directories are cleaned on restart.
    for entry in PUBLIC.iterdir():
        if re.fullmatch('[a-f0-9]{32}', entry.name) and entry.is_dir(): shutil.rmtree(entry)
    jobs, previous = {}, set()
    last_api = time.time()
    def stop(*_):
        global running
        running = False
    signal.signal(signal.SIGTERM, stop); signal.signal(signal.SIGINT, stop)
    try:
        while running:
            now = time.time()
            try:
                wanted = desired(); previous = wanted; last_api = now
            except Exception:
                wanted = previous if now-last_api < 15 else set()
            for path in list(jobs):
                if path not in wanted: jobs.pop(path).stop()
            for path in sorted(wanted):
                if path not in jobs and len(jobs) < LIMIT: jobs[path] = Job(path)
            states = {path: job.tick(now) for path, job in jobs.items()}
            for path in wanted - jobs.keys(): states[path] = {'state': 'capacity', 'updatedAt': int(now*1000)}
            atomic_json(ROOT / 'state.json', {'updatedAt': int(now*1000), 'jobs': states, 'limit': LIMIT})
            time.sleep(2)
    finally:
        for job in jobs.values(): job.stop()
        atomic_json(ROOT / 'state.json', {'updatedAt': int(time.time()*1000), 'jobs': {}, 'limit': LIMIT})


if __name__ == '__main__': main()
