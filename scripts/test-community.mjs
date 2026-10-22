import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
const folder = await mkdtemp(join(tmpdir(), "nexora-api-"));
const databaseUrl = `file:${join(folder, "test.db")}`;
const socket = createServer();
await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
const port = socket.address().port;
await new Promise((resolve) => socket.close(resolve));
const base = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  APP_URL: base,
  NEXT_TELEMETRY_DISABLED: "1",
  MEDIAMTX_API_URL: "",
};
const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
let server;
let checks = 0;
function check(condition, message) {
  assert.ok(condition, message);
  checks++;
}
async function start(origin = base) {
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    { env: { ...env, APP_URL: origin }, stdio: "ignore" },
  );
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null)
      throw Error(
        "Test server exited before readiness. Run npm run build first.",
      );
    try {
      const r = await fetch(`${base}/api/health`);
      if (r.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw Error("Test server readiness timed out.");
}
async function stop() {
  if (server && server.exitCode === null) {
    const exited = new Promise((resolve) => server.once("exit", resolve));
    server.kill("SIGTERM");
    await exited;
  }
}
function actor() {
  return { cookie: "" };
}
async function request(
  path,
  {
    method = "GET",
    data,
    status = 200,
    who,
    origin = base,
    raw,
    headers = {},
  } = {},
) {
  const response = await fetch(`${base}/api/${path}`, {
    method,
    headers: {
      ...(method === "GET"
        ? {}
        : {
            "content-type": "application/json",
            ...(origin === null ? {} : { origin }),
          }),
      ...(who?.cookie ? { cookie: who.cookie } : {}),
      ...headers,
    },
    ...(data !== undefined
      ? { body: JSON.stringify(data) }
      : raw !== undefined
        ? { body: raw }
        : {}),
  });
  assert.equal(
    response.status,
    status,
    `${method} ${path}: expected ${status}, received ${response.status}`,
  );
  checks++;
  const payload = await response.json();
  if (!response.ok) {
    check(typeof payload.error?.code === "string", "Consistent error envelope");
    check(
      !JSON.stringify(payload).includes("passwordHash"),
      "Error must not reveal hashes",
    );
  }
  const setCookie = response.headers.get("set-cookie");
  if (setCookie && who) who.cookie = setCookie.split(";")[0];
  return { data: payload.data, response };
}
const password = randomBytes(24).toString("base64url");
const creator = actor(),
  viewer = actor(),
  other = actor(),
  admin = actor();
const credentials = (name, role = "viewer") => ({
  email: `${name}@example.test`,
  username: name,
  password,
  role,
});
try {
  const result = spawnSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    { env, stdio: "ignore" },
  );
  assert.equal(result.status, 0);
  await start();
  const owner = actor(),
    mod = actor(),
    viewer = actor(),
    outsider = actor(),
    admin = actor();
  async function register(name, role, who) {
    return (
      await request("auth/register", {
        method: "POST",
        data: credentials(name, role),
        who,
        status: 201,
      })
    ).data;
  }
  const creator = await register("channelowner", "creator", owner);
  const moderator = await register("channelmod", "viewer", mod);
  const spectator = await register("spectator", "viewer", viewer);
  await register("outsideowner", "creator", outsider);
  const administrator = await register("administrator", "viewer", admin);
  await db.user.update({
    where: { id: administrator.id },
    data: { role: "admin" },
  });
  const channel = (
    await request("streams", {
      method: "POST",
      who: owner,
      data: {
        title: "Real creator channel",
        category: "Gaming",
        game: "Own content",
        description: "Original description",
        tag: "Community, English",
        language: "English",
      },
      status: 201,
    })
  ).data;
  const otherChannel = (
    await request("streams", {
      method: "POST",
      who: outsider,
      data: { title: "Other creator channel", category: "Música" },
      status: 201,
    })
  ).data;
  const root = `streams/${channel.slug}`,
    other = `streams/${otherChannel.slug}`;
  await request(root, {
    method: "PATCH",
    who: owner,
    data: { title: "Changed title" },
  });
  const edited = (await request(root)).data;
  check(
    edited.description === "Original description" &&
      edited.language === "English" &&
      edited.tag === "Community, English",
    "Partial edits preserve metadata",
  );
  for (const thumbnailUrl of [
    "javascript:alert(1)",
    "http://insecure.test/a.png",
    "https://user:pass@example.test/a.png",
  ])
    await request(root, {
      method: "PATCH",
      who: owner,
      data: { thumbnailUrl },
      status: 400,
    });
  await request(`${root}/dashboard`, { status: 401 });
  await request(`${root}/dashboard`, { who: viewer, status: 403 });
  await request(`${root}/moderators`, {
    method: "POST",
    who: owner,
    data: { username: moderator.username },
  });
  check(
    (await request("moderation", { who: mod })).data.length === 1,
    "Only assigned channel listed for moderator",
  );
  check(
    (await request(`${root}/dashboard`, { who: mod })).data.isOwner === false,
    "Moderator is not owner",
  );
  await request(`${other}/dashboard`, { who: mod, status: 403 });
  await request(root, {
    method: "PATCH",
    who: mod,
    data: { title: "Attempted takeover" },
    status: 403,
  });
  for (const area of ["alerts", "commands", "key"])
    await request(`${root}/${area}`, { who: mod, status: 403 });
  await request(`${root}/overlay-key`, {
    method: "POST",
    who: mod,
    status: 403,
  });
  await request(`${root}/moderators`, {
    method: "POST",
    who: mod,
    data: { username: spectator.username },
    status: 403,
  });
  const staffMessage = (
    await request(`${root}/staff-chat`, {
      method: "POST",
      who: mod,
      data: { text: "Private team conversation" },
      status: 201,
    })
  ).data;
  check(
    (await request(`${root}/staff-chat`, { who: owner })).data.some(
      (m) => m.id === staffMessage.id,
    ),
    "Owner sees private staff message",
  );
  check(
    !(await request(`${root}/chat`)).data.some((m) => m.id === staffMessage.id),
    "Public history excludes staff messages",
  );
  await request(`${root}/staff-chat`, { who: viewer, status: 403 });
  await request(`${root}/chat/${staffMessage.id}`, {
    method: "DELETE",
    who: owner,
    status: 404,
  });
  const eventAbort = new AbortController();
  const response = await fetch(`${base}/api/${root}/events?scope=staff`, {
    headers: { cookie: mod.cookie },
    signal: eventAbort.signal,
  });
  check(
    response.ok &&
      response.headers.get("content-type").includes("text/event-stream"),
    "Private SSE authenticated",
  );
  const reader = response.body.getReader();
  const first = new TextDecoder().decode((await reader.read()).value);
  check(
    first.includes("Private team conversation"),
    "SSE sends authorized snapshot",
  );
  await request(`${root}/moderators`, {
    method: "DELETE",
    who: owner,
    data: { username: moderator.username },
  });
  const timeout = setTimeout(() => eventAbort.abort(), 8000);
  let denied = "";
  while (!denied.includes("event: denied")) {
    const part = await reader.read();
    if (part.done) break;
    denied += new TextDecoder().decode(part.value);
  }
  clearTimeout(timeout);
  eventAbort.abort();
  check(
    denied.includes("event: denied"),
    "Active staff SSE revokes access when moderator removed",
  );
  await request(`${root}/staff-chat`, { who: mod, status: 403 });
  await request(`${root}/moderators`, {
    method: "POST",
    who: owner,
    data: { username: moderator.username },
  });
  const settings = {
    slowSeconds: 0,
    followersOnly: true,
    blockLinks: true,
    blockedWords: "forbidden\nphishing",
  };
  await request(`${root}/chat-settings`, {
    method: "PATCH",
    who: mod,
    data: settings,
  });
  await request(`${root}/chat-settings`, {
    method: "PATCH",
    who: viewer,
    data: settings,
    status: 403,
  });
  await request(`${root}/chat-settings`, {
    method: "PATCH",
    who: owner,
    data: { ...settings, slowSeconds: -1 },
    status: 400,
  });
  await request(`${root}/chat`, {
    method: "POST",
    who: viewer,
    data: { text: "Need follow" },
    status: 403,
  });
  const key = (
    await request(`${root}/overlay-key`, { method: "POST", who: owner })
  ).data.token;
  check(key.length === 64, "Overlay key generated once");
  const safeSettings = (await request(`${root}/alerts`, { who: owner })).data;
  check(
    safeSettings.hasOverlayKey &&
      !JSON.stringify(safeSettings).includes(key) &&
      !("tokenHash" in safeSettings),
    "Settings never disclose overlay secrets",
  );
  const overlayHeaders = { authorization: `Bearer ${key}` };
  check(
    (await request(`${root}/overlay-events`, { headers: overlayHeaders })).data
      .cursor === 0,
    "Empty overlay starts at zero cursor",
  );
  await request(`${root}/overlay-events`, { status: 403 });
  await request(`${other}/overlay-events`, {
    headers: overlayHeaders,
    status: 403,
  });
  await request("follows", {
    method: "POST",
    who: viewer,
    data: { streamId: channel.id },
  });
  await request("follows", {
    method: "POST",
    who: viewer,
    data: { streamId: channel.id },
  });
  const events = (
    await request(`${root}/overlay-events?after=0`, { headers: overlayHeaders })
  ).data;
  check(
    events.events.length === 1 &&
      events.events[0].username === spectator.username,
    "First follower alert delivered from zero cursor and duplicate follows deduplicated",
  );
  await request("follows", {
    method: "DELETE",
    who: viewer,
    data: { streamId: channel.id },
  });
  await request("follows", {
    method: "POST",
    who: viewer,
    data: { streamId: channel.id },
  });
  check(
    (
      await request(`${root}/overlay-events?after=0`, {
        headers: overlayHeaders,
      })
    ).data.events.length === 1,
    "Refollow cannot spam alerts",
  );
  for (const content of [
    "FORBIDDEN word",
    "https://example.test",
    "www.example.test",
  ])
    await request(`${root}/chat`, {
      method: "POST",
      who: viewer,
      data: { text: content },
      status: 400,
    });
  await db.rateLimit.deleteMany();
  const publicMessage = (
    await request(`${root}/chat`, {
      method: "POST",
      who: viewer,
      data: { text: "Hello everyone" },
      status: 201,
    })
  ).data;
  await request(`${root}/chat/${publicMessage.id}`, {
    method: "DELETE",
    who: outsider,
    status: 403,
  });
  await request(`${root}/chat/${publicMessage.id}`, {
    method: "DELETE",
    who: mod,
  });
  check(
    !(await request(`${root}/chat`)).data.some(
      (m) => m.id === publicMessage.id,
    ),
    "Moderator deletes public message",
  );
  await request(`${root}/chat-settings`, {
    method: "PATCH",
    who: mod,
    data: { ...settings, slowSeconds: 30 },
  });
  await request(`${root}/chat`, {
    method: "POST",
    who: viewer,
    data: { text: "First slow message" },
    status: 201,
  });
  await request(`${root}/chat`, {
    method: "POST",
    who: viewer,
    data: { text: "Second slow message" },
    status: 429,
  });
  await request(`${root}/bans`, {
    method: "POST",
    who: mod,
    data: {
      username: spectator.username,
      reason: "Repeated spam",
      minutes: 10,
    },
  });
  await request(`${root}/chat`, {
    method: "POST",
    who: viewer,
    data: { text: "Banned message" },
    status: 403,
  });
  await request(`${root}/bans`, {
    method: "POST",
    who: mod,
    data: { username: creator.username, reason: "Takeover", minutes: 0 },
    status: 403,
  });
  await request(`${root}/bans`, {
    method: "POST",
    who: mod,
    data: { username: administrator.username, reason: "Takeover", minutes: 0 },
    status: 403,
  });
  await request(`${root}/bans`, {
    method: "DELETE",
    who: mod,
    data: { username: spectator.username },
  });
  await request(`${root}/chat-settings`, {
    method: "PATCH",
    who: owner,
    data: { ...settings, slowSeconds: 0 },
  });
  await request(`${root}/bans`, {
    method: "POST",
    who: owner,
    data: {
      username: spectator.username,
      reason: "Timeout expiry",
      minutes: 1,
    },
  });
  await db.channelBan.update({
    where: { streamId_userId: { streamId: channel.id, userId: spectator.id } },
    data: { expiresAt: new Date(0) },
  });
  await request(`${root}/chat`, {
    method: "POST",
    who: viewer,
    data: { text: "Expired timeout permits messages" },
    status: 201,
  });
  await db.rateLimit.deleteMany();
  const command = {
    name: "welcome",
    response: "Welcome {user}",
    cooldownSeconds: 30,
    moderatorsOnly: false,
    enabled: true,
  };
  await request(`${root}/commands`, {
    method: "POST",
    who: owner,
    data: command,
  });
  await request(`${root}/chat`, {
    method: "POST",
    who: viewer,
    data: { text: "!welcome" },
    status: 201,
  });
  const commandMessages = (await request(`${root}/chat`)).data;
  check(
    commandMessages.some(
      (m) =>
        m.isBot &&
        m.text === `Welcome ${spectator.username}` &&
        m.role === "bot",
    ),
    "Custom command expands user and responds as bot",
  );
  await request(`${root}/chat`, {
    method: "POST",
    who: mod,
    data: { text: "!welcome" },
    status: 201,
  });
  check(
    (await request(`${root}/chat`)).data.filter((m) => m.isBot).length === 1,
    "Shared command cooldown enforced",
  );
  await request(`${root}/commands`, {
    method: "POST",
    who: owner,
    data: { ...command, name: "staff", moderatorsOnly: true },
  });
  await request(`${root}/chat`, {
    method: "POST",
    who: viewer,
    data: { text: "!staff" },
    status: 201,
  });
  check(
    (await request(`${root}/chat`)).data.filter((m) => m.isBot).length === 1,
    "Viewer cannot invoke moderator-only command",
  );
  await request(`${root}/chat`, {
    method: "POST",
    who: mod,
    data: { text: "!staff" },
    status: 201,
  });
  check(
    (await request(`${root}/chat`)).data.filter((m) => m.isBot).length === 2,
    "Moderator command permitted for assigned moderator",
  );
  await request(`${root}/alerts`, {
    method: "PATCH",
    who: owner,
    data: {
      followersEnabled: false,
      template: "Thanks {user}",
      accent: "#aabbcc",
      durationSeconds: 4,
      soundEnabled: false,
    },
  });
  await request(`${root}/alert-test`, { method: "POST", who: owner });
  const preview = (
    await request(`${root}/overlay-events?after=0`, { headers: overlayHeaders })
  ).data;
  check(
    preview.events.length === 1 && preview.events[0].kind === "test",
    "Disabled followers filtered, test alert still works",
  );
  const rotated = (
    await request(`${root}/overlay-key`, { method: "POST", who: owner })
  ).data.token;
  check(rotated !== key, "Overlay key rotation creates new token");
  await request(`${root}/overlay-events`, {
    headers: overlayHeaders,
    status: 403,
  });
  await request(`${root}/overlay-events`, {
    headers: { authorization: `Bearer ${rotated}` },
  });
  await request(`${root}/overlay-key`, { method: "DELETE", who: owner });
  await request(`${root}/overlay-events`, {
    headers: { authorization: `Bearer ${rotated}` },
    status: 403,
  });
  check(
    (await request(`${root}/dashboard`, { who: owner })).data.audit.length > 10,
    "Moderation/settings actions audited",
  );
  await request("admin/audit", { who: mod, status: 403 });
  check(
    (await request("admin/audit", { who: admin })).data.length > 10,
    "Global audit restricted to admins",
  );
  await request(`${root}/chat-settings`, {
    method: "PATCH",
    who: owner,
    data: settings,
    origin: "https://evil.test",
    status: 403,
  });
  await request("account/creator", { method: "POST", who: viewer });
  check(
    (await request("auth/me", { who: viewer })).data.role === "creator",
    "Viewer can activate own creator tools without elevated roles",
  );
  await stop();
  await start();
  check(
    (await request(`${root}/commands`, { who: owner })).data.length === 2,
    "Commands persist across restart",
  );
  check(
    (await request(`${root}/staff-chat`, { who: mod })).data.length === 1,
    "Staff chat persists and remains private after restart",
  );
  check(
    (await request(`${root}/alerts`, { who: owner })).data.followersEnabled ===
      false,
    "Alert settings persist across restart",
  );
  console.log(
    `PASS: ${checks} creator/community assertions including cross-channel permissions, SSE revocation, moderation, commands, private overlay keys and persistence.`,
  );
} finally {
  await stop();
  await db.$disconnect();
  await rm(folder, { recursive: true, force: true });
}
