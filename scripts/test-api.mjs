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
  for (const args of [
    ["migrate", "deploy"],
    ["db", "seed"],
  ]) {
    const result = spawnSync(
      process.execPath,
      ["node_modules/prisma/build/index.js", ...args],
      { env, stdio: "ignore" },
    );
    assert.equal(result.status, 0, "Isolated database preparation failed");
  }
  await start();
  const health = await request("health");
  check(health.data.database === "connected", "Database health");
  const publicStreams = (await request("streams")).data;
  check(publicStreams.length === 0, "Fresh database has no sample channels");
  check(
    publicStreams.every(
      (s) => s.isDemo && s.status === "offline" && s.viewers === "0",
    ),
    "Sample channels never claim real viewers/live status",
  );
  check(
    !JSON.stringify(publicStreams).includes("password"),
    "Public data contains no secrets",
  );
  await request("auth/register", {
    method: "POST",
    data: { ...credentials("bad"), password: "short" },
    status: 400,
  });
  await request("auth/register", {
    method: "POST",
    data: credentials("badadmin", "admin"),
    status: 400,
  });
  await request("auth/register", {
    method: "POST",
    data: { ...credentials("bademail"), email: "invalid" },
    status: 400,
  });
  await request("auth/register", {
    method: "POST",
    data: { ...credentials("badname"), username: "<script>" },
    status: 400,
  });
  await request("auth/register", {
    method: "POST",
    data: credentials("badOrigin"),
    origin: "https://evil.example",
    status: 403,
  });
  await request("auth/register", {
    method: "POST",
    data: credentials("noOrigin"),
    origin: null,
    status: 403,
  });
  await request("auth/register", { method: "POST", raw: "{", status: 400 });
  await request("auth/register", {
    method: "POST",
    raw: "x".repeat(17000),
    status: 413,
  });
  await request("auth/register", {
    method: "POST",
    data: credentials("badType"),
    headers: { "content-type": "text/plain" },
    status: 415,
  });
  const registered = await request("auth/register", {
    method: "POST",
    data: credentials("creator_user", "creator"),
    who: creator,
    status: 201,
  });
  const creatorUser = registered.data;
  check(creatorUser.role === "creator", "Creator registration");
  const cookie = registered.response.headers.get("set-cookie");
  check(
    /HttpOnly/i.test(cookie) && /SameSite=Lax/i.test(cookie),
    "Protected cookie flags",
  );
  check(
    !JSON.stringify(creatorUser).includes("password"),
    "No credential fields in registration",
  );
  const account = await db.user.findUnique({ where: { id: creatorUser.id } });
  check(
    account.passwordHash.startsWith("scrypt$") &&
      !account.passwordHash.includes(password),
    "Password hashed with scrypt",
  );
  const storedSession = await db.session.findFirst({
    where: { userId: creatorUser.id },
  });
  check(
    !creator.cookie.includes(storedSession.tokenHash),
    "Session token stored as hash",
  );
  await request("auth/register", {
    method: "POST",
    data: credentials("creator_user", "creator"),
    status: 409,
  });
  const viewerUser = (
    await request("auth/register", {
      method: "POST",
      data: credentials("viewer"),
      who: viewer,
      status: 201,
    })
  ).data;
  const otherUser = (
    await request("auth/register", {
      method: "POST",
      data: credentials("other", "creator"),
      who: other,
      status: 201,
    })
  ).data;
  const adminUser = (
    await request("auth/register", {
      method: "POST",
      data: credentials("admin"),
      who: admin,
      status: 201,
    })
  ).data;
  const promoted = spawnSync(
    process.execPath,
    [
      "--env-file=.env",
      "--import",
      "tsx",
      "scripts/promote-admin.ts",
      "admin@example.test",
    ],
    { env, stdio: "ignore" },
  );
  assert.equal(promoted.status, 0, "Admin provisioning script");
  check(
    (await request("auth/me", { who: creator })).data.id === creatorUser.id,
    "Session resolves owner",
  );
  check((await request("auth/me")).data === null, "Anonymous session is null");
  await request("streams?mine=true", { status: 401 });
  check(
    (await request("admin/users", { who: admin })).data.every(
      (u) => !("passwordHash" in u) && !("email" in u),
    ),
    "Admin list excludes secrets",
  );
  await request("admin/users", { who: viewer, status: 403 });
  await request("admin/users", { status: 401 });
  await request("streams", {
    method: "POST",
    data: { title: "My channel", category: "Gaming" },
    status: 401,
  });
  await request("streams", {
    method: "POST",
    who: viewer,
    data: { title: "My channel", category: "Gaming" },
    status: 403,
  });
  for (const data of [
    { title: "x", category: "Gaming" },
    { title: "Valid channel", category: "Wrong" },
    { title: "Valid channel", category: "Gaming", image: "../../private" },
    { title: "Valid channel", category: "Gaming", status: "live" },
    { title: "Valid channel", category: "Gaming", ownerId: otherUser.id },
  ])
    await request("streams", {
      method: "POST",
      who: creator,
      data,
      status: 400,
    });
  const channel = (
    await request("streams", {
      method: "POST",
      who: creator,
      data: {
        title: "Creator test channel",
        category: "Gaming",
        game: "Elden Ring",
      },
      status: 201,
    })
  ).data;
  check(
    channel.ownerId === creatorUser.id &&
      !channel.isDemo &&
      channel.status === "offline",
    "Server owns channel identity and live state",
  );
  check(
    /^[a-z0-9-]+$/.test(channel.slug),
    "Username underscores normalized in channel slugs",
  );
  check(
    (await request(`streams/${channel.slug}`)).data.id === channel.id,
    "Read channel by slug",
  );
  await request(`streams/${channel.slug}`, {
    method: "PATCH",
    who: other,
    data: { title: "Stolen channel" },
    status: 403,
  });
  await request(`streams/${channel.slug}`, {
    method: "PATCH",
    who: viewer,
    data: { title: "Stolen channel" },
    status: 403,
  });
  await request(`streams/${channel.slug}`, {
    method: "PATCH",
    who: creator,
    data: { title: "Updated channel" },
  });
  check(
    (await request("streams?mine=true", { who: other })).data.length === 0,
    "Private own-channel list isolated",
  );
  check(
    (await request("streams?q=Updated")).data.some((s) => s.id === channel.id),
    "Server-side search",
  );
  check(
    (await request("streams?category=Música")).data.every(
      (s) => s.category === "Música",
    ),
    "Server-side category filter",
  );
  await request("streams/not-found", { status: 404 });
  await request("streams/INVALID!", { status: 400 });
  await request("follows", { status: 401 });
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
  check(
    (await request("follows", { who: viewer })).data.length === 1,
    "Following is idempotent",
  );
  check(
    (await request("follows", { who: other })).data.length === 0,
    "Following isolated between accounts",
  );
  await request("follows", {
    method: "POST",
    who: viewer,
    data: { streamId: "1" },
    status: 400,
  });
  await request("follows", {
    method: "POST",
    who: viewer,
    data: { streamId: 99999 },
    status: 404,
  });
  const chat = `streams/${channel.slug}/chat`;
  await request(chat, {
    method: "POST",
    data: { text: "Anonymous" },
    status: 401,
  });
  await request(chat, {
    method: "POST",
    who: viewer,
    data: { text: " ".repeat(2) },
    status: 400,
  });
  await request(chat, {
    method: "POST",
    who: viewer,
    data: { text: "a".repeat(301) },
    status: 400,
  });
  await db.chatSettings.create({
    data: { streamId: channel.id, blockedWords: "spamcasino" },
  });
  await request(chat, {
    method: "POST",
    who: viewer,
    data: { text: "spamcasino" },
    status: 400,
  });
  const message = (
    await request(chat, {
      method: "POST",
      who: viewer,
      data: {
        text: "Persistent message",
        userId: creatorUser.id,
        name: "spoofed",
      },
      status: 201,
    })
  ).data;
  check(
    message.name === viewerUser.username,
    "Chat identity taken from session",
  );
  await request(`${chat}/${message.id}`, {
    method: "DELETE",
    who: other,
    status: 403,
  });
  await stop();
  await start();
  check(
    (await request("auth/me", { who: viewer })).data.id === viewerUser.id,
    "Session survives server restart",
  );
  check(
    (await request("follows", { who: viewer })).data.includes(channel.id),
    "Follow survives restart",
  );
  check(
    (await request(chat)).data.some((m) => m.text === "Persistent message"),
    "Chat survives restart",
  );
  check(
    (await request(`streams/${channel.slug}`)).data.title === "Updated channel",
    "Channel edits survive restart",
  );
  await request(`${chat}/${message.id}`, { method: "DELETE", who: creator });
  check(
    (await request(chat)).data.length === 0,
    "Channel owner can moderate chat",
  );
  await request("admin/users", {
    method: "PATCH",
    who: admin,
    data: { id: viewerUser.id, status: "muted" },
  });
  await request(chat, {
    method: "POST",
    who: viewer,
    data: { text: "Muted message" },
    status: 403,
  });
  await request("admin/users", {
    method: "PATCH",
    who: admin,
    data: { id: viewerUser.id, status: "active", role: "admin" },
    status: 400,
  });
  await request("admin/users", {
    method: "PATCH",
    who: admin,
    data: { id: viewerUser.id, status: "active" },
  });
  for (let i = 0; i < 10; i++)
    await request(chat, {
      method: "POST",
      who: other,
      data: { text: `Rate limit ${i}` },
      status: 201,
    });
  await request(chat, {
    method: "POST",
    who: other,
    data: { text: "Too fast" },
    status: 429,
  });
  await request("admin/users", {
    method: "PATCH",
    who: admin,
    data: { id: otherUser.id, status: "banned" },
  });
  check(
    (await request("auth/me", { who: other })).data === null,
    "Ban revokes session",
  );
  await request("follows", { who: other, status: 401 });
  await request("admin/users", {
    method: "PATCH",
    who: admin,
    data: { id: adminUser.id, status: "banned" },
    status: 400,
  });
  const logoutToken = viewer.cookie;
  await request("auth/logout", { method: "POST", who: viewer });
  check(
    (await request("auth/me", { who: { cookie: logoutToken } })).data === null,
    "Logout revokes old cookie server-side",
  );
  await request("auth/login", {
    method: "POST",
    who: viewer,
    data: { email: "viewer@example.test", password: "wrong-password" },
    status: 401,
  });
  await request("auth/login", {
    method: "POST",
    who: viewer,
    data: { email: "viewer@example.test", password },
  });
  await db.session.updateMany({
    where: { userId: viewerUser.id },
    data: { expiresAt: new Date(0) },
  });
  check(
    (await request("auth/me", { who: viewer })).data === null,
    "Expired session rejected",
  );
  const loginActor = actor();
  for (let i = 0; i < 8; i++)
    await request("auth/login", {
      method: "POST",
      data: { email: "limited@example.test", password },
      status: 401,
    });
  await request("auth/login", {
    method: "POST",
    data: { email: "limited@example.test", password },
    status: 429,
  });
  await request("follows", {
    method: "POST",
    who: creator,
    data: { streamId: channel.id },
  });
  await request("follows", {
    method: "DELETE",
    who: creator,
    data: { streamId: channel.id },
  });
  check(
    (await request("follows", { who: creator })).data.length === 0,
    "Unfollow persisted",
  );
  check((await request("clips")).data.length === 0, "No fake video clips");
  await stop();
  await start("https://nexora.example");
  const secure = await request("auth/login", {
    method: "POST",
    who: loginActor,
    origin: "https://nexora.example",
    data: { email: "viewer@example.test", password },
  });
  check(
    /;\s*Secure/i.test(secure.response.headers.get("set-cookie")),
    "HTTPS deployment sets Secure cookie",
  );
  console.log(
    `PASS: ${checks} API assertions, isolated SQLite, persistence across restart, authentication, ownership, CSRF, rate limiting and moderation.`,
  );
} finally {
  await stop();
  await db.$disconnect();
  await rm(folder, { recursive: true, force: true });
}
