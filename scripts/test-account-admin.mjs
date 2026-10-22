import assert from "node:assert/strict";
import { totp, decryptSecret } from "../lib/totp.ts";
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
  ACCOUNT_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
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
  process.env.ACCOUNT_ENCRYPTION_KEY = env.ACCOUNT_ENCRYPTION_KEY;
  assert.equal(
    spawnSync(
      process.execPath,
      ["node_modules/prisma/build/index.js", "migrate", "deploy"],
      { env, stdio: "ignore" },
    ).status,
    0,
  );
  await start();
  await request("account/security", { status: 401 });
  const owner = (
    await request("auth/register", {
      method: "POST",
      who: creator,
      status: 201,
      data: credentials("secure_creator", "creator"),
    })
  ).data;
  const visitor = (
    await request("auth/register", {
      method: "POST",
      who: viewer,
      status: 201,
      data: credentials("secure_viewer"),
    })
  ).data;
  const otherUser = (
    await request("auth/register", {
      method: "POST",
      who: other,
      status: 201,
      data: credentials("secure_other", "creator"),
    })
  ).data;
  const administrator = (
    await request("auth/register", {
      method: "POST",
      who: admin,
      status: 201,
      data: credentials("secure_admin"),
    })
  ).data;
  await db.user.update({
    where: { id: administrator.id },
    data: { role: "admin" },
  });
  const device = actor();
  await request("auth/login", {
    method: "POST",
    who: device,
    data: { email: "secure_creator@example.test", password },
  });
  const channel = (
    await request("streams", {
      method: "POST",
      who: creator,
      status: 201,
      data: { title: "Security channel", category: "IRL" },
    })
  ).data;
  await request("follows", {
    method: "POST",
    who: creator,
    status: 400,
    data: { streamId: channel.id },
  });
  check(
    (await db.follow.count({ where: { streamId: channel.id } })) === 0,
    "Self follow writes nothing",
  );
  check(
    (await db.activityEvent.count({ where: { streamId: channel.id } })) === 0,
    "Self follow creates no alert",
  );
  await request("follows", {
    method: "POST",
    who: viewer,
    data: { streamId: channel.id },
  });
  await request("account/two-factor/setup", {
    method: "POST",
    who: creator,
    status: 401,
    data: { password: "incorrect" },
  });
  const setup = (
    await request("account/two-factor/setup", {
      method: "POST",
      who: creator,
      data: { password },
    })
  ).data;
  check(
    setup.secret.length === 32 &&
      setup.qrCode.startsWith("data:image/png;base64,"),
    "Authenticator provisioning",
  );
  await request("account/two-factor/confirm", {
    method: "POST",
    who: creator,
    status: 401,
    data: { password, code: "invalid" },
  });
  const counter = Math.floor(Date.now() / 30000);
  const enabled = (
    await request("account/two-factor/confirm", {
      method: "POST",
      who: creator,
      data: { password, code: totp(setup.secret, counter) },
    })
  ).data;
  check(enabled.recoveryCodes.length === 10, "One-time recovery codes issued");
  const stored = await db.user.findUnique({ where: { id: owner.id } });
  check(
    stored.twoFactorSecret !== setup.secret &&
      decryptSecret(stored.twoFactorSecret, owner.id) === setup.secret,
    "Secret encrypted and bound to account",
  );
  check(
    !stored.recoveryCodes.includes(enabled.recoveryCodes[0]),
    "Recovery values not persisted raw",
  );
  await request("account/security", { who: device, status: 401 });
  const login = actor();
  await request("auth/login", {
    method: "POST",
    who: login,
    status: 401,
    data: { email: "secure_creator@example.test", password },
  });
  await request("auth/login", {
    method: "POST",
    who: login,
    status: 401,
    data: {
      email: "secure_creator@example.test",
      password,
      code: totp(setup.secret, counter),
    },
  });
  await request("auth/login", {
    method: "POST",
    who: login,
    data: {
      email: "secure_creator@example.test",
      password,
      code: enabled.recoveryCodes[0],
    },
  });
  await request("auth/login", {
    method: "POST",
    who: device,
    status: 401,
    data: {
      email: "secure_creator@example.test",
      password,
      code: enabled.recoveryCodes[0],
    },
  });
  const sessions = (await request("account/sessions", { who: creator })).data;
  check(
    sessions.length === 2 && sessions.filter((s) => s.current).length === 1,
    "Sessions scoped/current identified",
  );
  check(
    !JSON.stringify(sessions).includes("tokenHash"),
    "No session credential disclosure",
  );
  await request("account/sessions/" + sessions[0].id, {
    method: "DELETE",
    who: viewer,
    status: 404,
  });
  await request("account/sessions", { method: "DELETE", who: creator });
  await request("account/security", { who: login, status: 401 });
  await db.rateLimit.deleteMany({
    where: { key: { in: [`otp:${owner.id}`, `account-security:${owner.id}`] } },
  });
  await db.rateLimit.deleteMany({
    where: { key: { startsWith: "auth:auth/login:" } },
  });
  const changedPassword = randomBytes(24).toString("base64url");
  await request("account/password", {
    method: "PATCH",
    who: creator,
    data: {
      password,
      newPassword: changedPassword,
      code: enabled.recoveryCodes[1],
    },
  });
  await request("auth/login", {
    method: "POST",
    who: login,
    status: 401,
    data: {
      email: "secure_creator@example.test",
      password,
      code: enabled.recoveryCodes[2],
    },
  });
  await request("auth/login", {
    method: "POST",
    who: login,
    data: {
      email: "secure_creator@example.test",
      password: changedPassword,
      code: enabled.recoveryCodes[2],
    },
  });
  const replacement = (
    await request("account/two-factor/recovery", {
      method: "POST",
      who: creator,
      data: { password: changedPassword, code: enabled.recoveryCodes[3] },
    })
  ).data;
  await request("auth/login", {
    method: "POST",
    who: device,
    status: 401,
    data: {
      email: "secure_creator@example.test",
      password: changedPassword,
      code: enabled.recoveryCodes[4],
    },
  });
  await request("account/two-factor", {
    method: "DELETE",
    who: creator,
    data: { password: changedPassword, code: replacement.recoveryCodes[0] },
  });
  await request("account/security", { who: login, status: 401 });
  check(
    !(await request("account/security", { who: creator })).data
      .twoFactorEnabled,
    "2FA disabled only after proof",
  );
  await request("auth/login", {
    method: "POST",
    who: login,
    data: { email: "secure_creator@example.test", password: changedPassword },
  });
  await request("account/two-factor/setup", {
    method: "POST",
    who: creator,
    data: { password: changedPassword },
  });
  await db.twoFactorSetup.update({
    where: { userId: owner.id },
    data: { expiresAt: new Date(0) },
  });
  await request("account/two-factor/confirm", {
    method: "POST",
    who: creator,
    status: 400,
    data: { password: changedPassword, code: "123456" },
  });
  await request("admin/overview", { who: viewer, status: 403 });
  await request("admin/roles", {
    method: "PATCH",
    who: viewer,
    status: 403,
    data: { id: visitor.id, role: "admin", password },
  });
  await request("admin/roles", {
    method: "PATCH",
    who: admin,
    status: 401,
    data: { id: visitor.id, role: "moderator", password: "wrong" },
  });
  await request("admin/roles", {
    method: "PATCH",
    who: admin,
    status: 400,
    data: { id: administrator.id, role: "viewer", password },
  });
  await request("admin/roles", {
    method: "PATCH",
    who: admin,
    data: { id: visitor.id, role: "moderator", password },
  });
  await request("account/security", { who: viewer, status: 401 });
  await request("auth/login", {
    method: "POST",
    who: viewer,
    data: { email: "secure_viewer@example.test", password },
  });
  check(
    (await request("admin/overview", { who: viewer })).data.actorRole ===
      "moderator",
    "Global moderator console access",
  );
  await request("admin/roles", {
    method: "PATCH",
    who: viewer,
    status: 403,
    data: { id: otherUser.id, role: "admin", password },
  });
  await request("admin/settings", {
    method: "PATCH",
    who: viewer,
    status: 403,
    data: { registrationOpen: false, announcement: "No" },
  });
  await request("admin/users", {
    method: "PATCH",
    who: viewer,
    status: 403,
    data: { id: administrator.id, status: "banned" },
  });
  await request(`streams/${channel.slug}/key`, { who: viewer, status: 403 });
  await request(`streams/${channel.slug}/staff-chat`, { who: viewer });
  await request("admin/channel-moderators", {
    method: "POST",
    who: admin,
    data: { streamId: channel.id, username: "secure_other" },
  });
  await request(`streams/${channel.slug}/staff-chat`, { who: other });
  await request("admin/channel-moderators", {
    method: "DELETE",
    who: admin,
    data: { streamId: channel.id, username: "secure_other" },
  });
  await request(`streams/${channel.slug}/staff-chat`, {
    who: other,
    status: 403,
  });
  const report = (
    await request("reports", {
      method: "POST",
      who: other,
      status: 201,
      data: {
        slug: channel.slug,
        reason: "spam",
        description: "Repeated unsolicited messages in this channel",
      },
    })
  ).data;
  await request("reports", {
    method: "POST",
    who: other,
    status: 409,
    data: {
      slug: channel.slug,
      reason: "spam",
      description: "Duplicate report of this channel",
    },
  });
  await request("admin/reports", { who: creator, status: 403 });
  check(
    (await request("admin/reports", { who: viewer })).data.some(
      (r) => r.id === report.id,
    ),
    "Reports visible to global moderation",
  );
  await request("admin/reports", {
    method: "PATCH",
    who: viewer,
    data: {
      id: report.id,
      status: "resolved",
      resolution: "Reviewed against channel history",
    },
  });
  await request("admin/channels", {
    method: "PATCH",
    who: viewer,
    data: {
      id: channel.id,
      suspended: true,
      reason: "Confirmed test violation",
    },
  });
  await request(`streams/${channel.slug}`, { status: 404 });
  check(
    !(await request("streams")).data.some((s) => s.id === channel.id),
    "Suspended channel hidden publicly",
  );
  await request("admin/channels", {
    method: "PATCH",
    who: admin,
    data: { id: channel.id, suspended: false, reason: "Appeal reviewed" },
  });
  await request(`streams/${channel.slug}`);
  await request("admin/settings", {
    method: "PATCH",
    who: admin,
    data: {
      registrationOpen: false,
      announcement: "Maintenance notice <script>plain text</script>",
    },
  });
  check(
    !(await request("platform")).data.registrationOpen,
    "Registration state exposed",
  );
  await request("auth/register", {
    method: "POST",
    status: 403,
    data: credentials("closed_register"),
  });
  await request("admin/settings", {
    method: "PATCH",
    who: admin,
    data: { registrationOpen: true, announcement: "" },
  });
  check(
    (await request("admin/overview", { who: admin })).data.workerHealth ===
      "not_configured",
    "Worker status honest when unconfigured",
  );
  const events = (await request("admin/audit", { who: admin })).data;
  for (const action of [
    "user.role",
    "channel.suspend",
    "channel.restore",
    "report.status",
    "moderator.add",
    "moderator.remove",
    "platform.settings",
    "account.2fa.enable",
    "account.2fa.disable",
    "account.password.change",
    "account.recovery.rotate",
  ])
    check(
      events.some((e) => e.action === action),
      "Audit " + action,
    );
  const info = (await request("account/sessions", { who: creator })).data.find(
    (s) => s.current,
  );
  await request("account/sessions/" + info.id, {
    method: "DELETE",
    who: creator,
  });
  await request("account/security", { who: creator, status: 401 });
  console.log(
    `PASS: ${checks} account/admin assertions: 2FA/replay/recovery/encryption, sessions/password, self-follow, global roles/channel moderation, reports/settings and audit`,
  );
} finally {
  await stop();
  await db.$disconnect();
  await rm(folder, { recursive: true, force: true });
}
