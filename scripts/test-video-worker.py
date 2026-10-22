"""Actual MediaMTX + web + FFmpeg integration. Isolated synthetic accounts/database."""
import base64, hashlib, http.server, json, os, pathlib, secrets, shutil, socket, sqlite3, subprocess, tempfile, threading, time, urllib.request, urllib.error
ROOT = pathlib.Path(__file__).resolve().parents[1]
FOLDER = pathlib.Path(tempfile.mkdtemp(prefix='nexora-compat-'))
children=[]; checks=0; passwords={}

def port():
    with socket.socket() as s:s.bind(('127.0.0.1',0));return s.getsockname()[1]
appport,apiport,rtmpport,rtspport,hlsport,staticport=[port() for _ in range(6)]
base=f'http://127.0.0.1:{appport}'; static=f'http://127.0.0.1:{staticport}'
token=secrets.token_hex(32)
env={**os.environ,'DATABASE_URL':'file:'+str(FOLDER/'test.db'),'APP_URL':base,'MEDIAMTX_API_URL':f'http://127.0.0.1:{apiport}',
     'MEDIAMTX_API_PASSWORD':token,'VIDEO_INGEST_URL':f'rtmp://127.0.0.1:{rtmpport}/live','VIDEO_HLS_URL':f'http://127.0.0.1:{hlsport}',
     'VIDEO_MEDIA_URL':static,'VIDEO_STATE_FILE':str(FOLDER/'media/state.json'),'NEXT_TELEMETRY_DISABLED':'1'}

def check(value,message):
    global checks
    assert value,message
    checks+=1

def run(args,**kwargs):
    p=subprocess.Popen(args,cwd=ROOT,env=env,stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,**kwargs);children.append(p);return p

def stop(p):
    if p.poll() is None:
        p.terminate()
        try:p.wait(timeout=8)
        except subprocess.TimeoutExpired:p.kill();p.wait()

def wait(fn,message,seconds=55):
    deadline=time.time()+seconds
    while time.time()<deadline:
        try:
            if fn():return
        except Exception:pass
        time.sleep(.3)
    raise AssertionError(message)

def req(path,method='GET',data=None,cookie='',auth=None,status=200):
    headers={'Origin':base,'Content-Type':'application/json'}
    if cookie:headers['Cookie']=cookie
    if auth:headers['Authorization']=auth
    request=urllib.request.Request(base+'/api/'+path,method=method,headers=headers,data=None if data is None else json.dumps(data).encode())
    try:r=urllib.request.urlopen(request,timeout=10)
    except urllib.error.HTTPError as error:r=error
    check(r.status==status,'API status '+path.split('/')[0]+': '+str(r.status))
    return json.load(r).get('data'),r.headers.get('Set-Cookie','').split(';')[0]

def account(name):
    passwords[name]=secrets.token_urlsafe(24)
    _,cookie=req('auth/register','POST',{'username':name,'email':name+'@example.test','password':passwords[name],'role':'creator'},status=201)
    stream,_=req('streams','POST',{'title':'Codec compatibility','category':'IRL'},cookie=cookie,status=201)
    key,_=req('streams/'+stream['slug']+'/key','POST',cookie=cookie)
    return stream,cookie,key

def publish(key,hevc=False,audio=True):
    cmd=['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-re','-f','lavfi','-i','testsrc2=size=1280x720:rate=30']
    if audio:cmd+=['-f','lavfi','-i','aevalsrc=sin(440*2*PI*t):s=48000:c=5.1']
    cmd+=['-c:v','libx265' if hevc else 'libx264','-preset','ultrafast','-tune','zerolatency','-threads','2','-pix_fmt','yuv420p','-g','60']
    if hevc:cmd+=['-x265-params','pools=1:frame-threads=1:log-level=error']
    if audio:cmd+=['-c:a','aac','-b:a','256k']
    return run(cmd+['-f','flv',key['server']+'/'+key['streamKey']])

class Static(http.server.SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(FOLDER/'media/public'),**kwargs)
    def log_message(self,*_):pass
    def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
server=http.server.ThreadingHTTPServer(('127.0.0.1',staticport),Static)
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
    subprocess.run(['node','node_modules/prisma/build/index.js','migrate','deploy'],cwd=ROOT,env=env,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    app=run(['node','node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p',str(appport)])
    wait(lambda:req('health')[0],'Web readiness')
    binary=pathlib.Path(os.environ.get('MEDIAMTX_BINARY',ROOT.parent/'nexora-streaming/.runtime/mediamtx'))
    config={'logLevel':'warn','authMethod':'http','authHTTPAddress':base+'/api/video/auth','authHTTPExclude':[],
            'api':True,'apiAddress':f'127.0.0.1:{apiport}','rtsp':True,'rtspAddress':f'127.0.0.1:{rtspport}','rtspTransports':['tcp'],
            'rtmp':True,'rtmpAddress':f'127.0.0.1:{rtmpport}','hls':True,'hlsAddress':f'127.0.0.1:{hlsport}',
            'webrtc':False,'srt':False,'moq':False,'paths':{'~^live/[a-f0-9]{32}$':{'overridePublisher':False}}}
    (FOLDER/'media.json').write_text(json.dumps(config));media=run([str(binary),str(FOLDER/'media.json')])
    time.sleep(1)
    req('video/jobs',status=403);req('video/jobs',auth='Bearer invalid',status=403)
    check(req('video/jobs',auth='Bearer '+token)[0]==[],'Initial jobs empty')
    stream,cookie,key=account('compat_hevc');route='streams/'+stream['slug']
    _,follower=req('auth/register','POST',{'username':'compat_follower','email':'compat_follower@example.test','password':secrets.token_urlsafe(24),'role':'viewer'},status=201)
    req('follows','POST',{'streamId':stream['id']},cookie=follower)
    first=publish(key,hevc=True)
    wait(lambda:req(route+'/playback')[0]['status']=='processing','HEVC source awaiting worker')
    path='live/'+key['streamKey'].split('?')[0]
    req('video/auth','POST',{'action':'read','protocol':'rtsp','path':path,'user':'nexora-api','password':'wrong'},status=403)
    req('video/auth','POST',{'action':'read','protocol':'rtsp','path':path,'user':'nexora-api','password':token})
    worker_env={**env,'MEDIA_ROOT':str(FOLDER/'media'),'WORKER_API_URL':base+'/api/video/jobs','WORKER_RTSP_URL':f'rtsp://127.0.0.1:{rtspport}','WORKER_MAX_STREAMS':'1'}
    worker=subprocess.Popen(['python3','services/video-worker/worker.py'],cwd=ROOT,env=worker_env,stdin=subprocess.DEVNULL,stdout=open(FOLDER/'worker.log','w'),stderr=subprocess.STDOUT);children.append(worker)
    wait(lambda:req(route+'/playback')[0].get('dashUrl'),'HEVC conversion readiness')
    notices=req('notifications',cookie=follower)[0]
    check(len(notices['items'])==1 and notices['unread']==1,'Actual live signal produces follower notification')
    data=req(route+'/playback')[0]
    for fmt,url in [('hls',data['url']),('dash',data['dashUrl'])]:
        result=subprocess.run(['ffprobe','-v','error','-show_entries','stream=codec_name,width,height,channels','-of','json',url],capture_output=True,timeout=25,check=True)
        streams=json.loads(result.stdout)['streams'];codecs={s['codec_name'] for s in streams}
        check(codecs==({'h264','aac'} if fmt=='hls' else {'vp9','opus'}),fmt+' normalized codecs')
        check(all(s.get('channels',2)==2 for s in streams),fmt+' stereo audio')
        result=subprocess.run(['ffmpeg','-v','error','-i',url,'-t','3','-f','null','-'],capture_output=True,timeout=25)
        if result.returncode or result.stderr: print(fmt, result.returncode, result.stderr.decode()[:1800],flush=True)
        check(result.returncode==0,fmt+' decode succeeds')
        if fmt == 'hls': check(not result.stderr, 'HLS decode without warnings')
    picture=req(route)[0]['liveThumbnailUrl'];content=urllib.request.urlopen(picture).read()
    check(content.startswith(b'\xff\xd8'),'JPEG frame')
    wait(lambda:req(route)[0]['liveThumbnailUrl']!=picture,'Thumbnail timestamp refresh',20)
    newer=urllib.request.urlopen(req(route)[0]['liveThumbnailUrl']).read()
    check(hashlib.sha256(content).digest()!=hashlib.sha256(newer).digest(),'Thumbnail frame really changes')
    print('PASS: HEVC/5.1 ingest -> H264/AAC stereo + VP9/Opus stereo, decoding and changing live thumbnails',flush=True)
    if os.environ.get('NEXORA_BROWSER_HOLD'):
        fixture={'base':base,'slug':stream['slug'],'folder':str(FOLDER)}
        pathlib.Path('/tmp/nexora-compat-browser.json').write_text(json.dumps(fixture))
        print('Browser fixture ready; waiting for browser-done file',flush=True)
        wait(lambda:(FOLDER/'browser-done').exists(),'Browser fixture hold',300)
    second,secondcookie,secondkey=account('compat_silent')
    silent=publish(secondkey,audio=False)
    wait(lambda:req('streams/'+second['slug']+'/playback')[0]['status']=='capacity','Bounded capacity')
    req(route+'/key','DELETE',cookie=cookie)
    wait(lambda:not (FOLDER/'media/public'/path.split('/')[1]).exists(),'Revocation removes output')
    check(not any(job['path']==path for job in req('video/jobs',auth='Bearer '+token)[0]),'Revoked jobs removed')
    wait(lambda:req('streams/'+second['slug']+'/playback')[0].get('dashUrl'),'Queued silent stream starts')
    silentdata=req('streams/'+second['slug']+'/playback')[0]
    for url in [silentdata['url'],silentdata['dashUrl']]:
        result=subprocess.run(['ffmpeg','-v','error','-i',url,'-t','2','-f','null','-'],capture_output=True,timeout=25)
        check(result.returncode==0 and not result.stderr,'Video-only stream decode')
    adminstream,admincookie,_=account('compat_admin')
    with sqlite3.connect(FOLDER/'test.db') as db:
        db.execute("UPDATE User SET role='admin' WHERE username='compat_admin'")
    secondpath='live/'+secondkey['streamKey'].split('?')[0]
    req('admin/channels','PATCH',{'id':second['id'],'suspended':True,'reason':'Synthetic moderation test'},cookie=admincookie)
    wait(lambda:not (FOLDER/'media/public'/secondpath.split('/')[1]).exists(),'Suspension removes processed outputs')
    check(not any(job['path']==secondpath for job in req('video/jobs',auth='Bearer '+token)[0]),'Suspended jobs removed')
    req('video/auth','POST',{'action':'publish','protocol':'rtmp','path':secondpath,'query':secondkey['streamKey'].partition('?')[2]},status=403)
    req('admin/channels','PATCH',{'id':second['id'],'suspended':False,'reason':'Synthetic restore test'},cookie=admincookie)
    req('video/auth','POST',{'action':'publish','protocol':'rtmp','path':secondpath,'query':secondkey['streamKey'].partition('?')[2]},status=403)
    newkey,_=req('streams/'+second['slug']+'/key','POST',cookie=secondcookie)
    restored=publish(newkey,audio=False)
    wait(lambda:req('streams/'+second['slug']+'/playback')[0].get('dashUrl'),'Restored channel requires new key and works')
    # Worker death/stale state must never be announced as ready indefinitely.
    stop(worker)
    wait(lambda:req('streams/'+second['slug']+'/playback')[0]['status']=='processing','Worker unavailable surfaced')
    check(req('streams/'+second['slug'])[0]['liveThumbnailUrl'] is None,'No stale live thumbnails')
    req('account/delete','DELETE',{'password':passwords['compat_silent'],'confirmation':'compat_silent'},cookie=secondcookie)
    wait(lambda:restored.poll() is not None,'Account deletion disconnects live publisher')
    check(not req('video/jobs',auth='Bearer '+token)[0],'Deleted account has no processing job')
    req('video/auth','POST',{'action':'publish','protocol':'rtmp','path':'live/'+newkey['streamKey'].split('?')[0],'query':newkey['streamKey'].partition('?')[2]},status=403)
    print(f'PASS: {checks} API/media checks including worker auth, HEVC decode, thumbnails, capacity, revocation, silent source and cleanup',flush=True)
except Exception:
    if (FOLDER/'worker.log').exists():print((FOLDER/'worker.log').read_text()[-2000:])
    raise
finally:
    for child in reversed(children):stop(child)
    server.shutdown();shutil.rmtree(FOLDER)
