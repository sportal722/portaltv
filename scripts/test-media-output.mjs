import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mediaHealth, mediaOutputs, outputUrls } from "../lib/media-output.ts";
const dir = await mkdtemp(join(tmpdir(), "nexora-state-"));
process.env.VIDEO_STATE_FILE = join(dir, "state.json");
process.env.VIDEO_MEDIA_URL = "https://example.test/media";
const path = "live/" + "a".repeat(32);
const ready = {
  state: "ready",
  generation: "b".repeat(16),
  updatedAt: Date.now(),
  thumbnailAt: Date.now(),
};
try {
  assert.deepEqual(await mediaOutputs(), {});
  assert.equal(await mediaHealth(), "unavailable");
  await writeFile(
    process.env.VIDEO_STATE_FILE,
    JSON.stringify({ updatedAt: Date.now(), jobs: { [path]: ready } }),
  );
  assert.equal((await mediaOutputs())[path].state, "ready");
  assert.equal(await mediaHealth(), "healthy");
  assert.match(outputUrls(path, ready).url, /\/hls\/index.m3u8$/);
  assert.match(outputUrls(path, ready).dashUrl, /\/dash\/manifest.mpd$/);
  assert.match(outputUrls(path, ready).thumbnailUrl, /thumbnail.jpg\?v=/);
  for (const data of [
    { ...ready, generation: "../secret" },
    { ...ready, updatedAt: undefined },
    { ...ready, updatedAt: Date.now() - 16000 },
    { ...ready, state: "capacity" },
  ])
    assert.equal(outputUrls(path, data), null);
  assert.equal(outputUrls("../config", ready), null);
  assert.equal(
    outputUrls(path, { ...ready, thumbnailAt: Date.now() - 31000 })
      .thumbnailUrl,
    null,
  );
  await writeFile(
    process.env.VIDEO_STATE_FILE,
    JSON.stringify({ updatedAt: Date.now() - 16000, jobs: { [path]: ready } }),
  );
  assert.deepEqual(await mediaOutputs(), {});
  await writeFile(process.env.VIDEO_STATE_FILE, "{broken");
  assert.deepEqual(await mediaOutputs(), {});
  console.log(
    "PASS: worker state freshness, invalid state/paths/generations, stale thumbnails and safe output URLs",
  );
} finally {
  await rm(dir, { recursive: true, force: true });
}
