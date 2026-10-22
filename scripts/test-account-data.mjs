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
async function register(name, role = "viewer") {
  const who = actor();
  const {data:user} = await request("auth/register", {method:"POST", who, status:201, data:{username:name,email:name+"@example.test",password,role}});
  return {who,user};
}
async function broadcast(ids, at) {
  const code = `const {recordLiveChannels}=require('./lib/notifications.ts');recordLiveChannels(${JSON.stringify(ids)},new Date(${JSON.stringify(at)})).then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)})`;
  const result = spawnSync(process.execPath,["--import","tsx","-e",code],{env,encoding:"utf8"});
  assert.equal(result.status,0,result.stderr);checks++;
}
try {
  assert.equal(spawnSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy"],{env,stdio:"ignore"}).status,0);
  await start();
  const a=await register("data_owner","creator"), b=await register("data_viewer"), c=await register("data_other");
  const s=(await request("streams",{method:"POST",who:a.who,status:201,data:{title:"Live notification fixture",category:"IRL"}})).data;
  await request("follows",{method:"POST",who:b.who,data:{streamId:s.id}});
  await request("follows",{method:"POST",who:c.who,data:{streamId:s.id}});
  await request("notifications",{status:401});
  await request("notifications?before=invalid",{who:b.who,status:400});
  await request("notifications/preferences?after=invalid",{who:b.who,status:400});
  check((await request("notifications/preferences?after="+s.id,{who:b.who})).data.items.length===0,"Preference cursor accepted and applied");
  await request("notifications/preferences",{method:"PATCH",who:a.who,status:404,data:{streamId:s.id,notifyLive:false}});
  await request("notifications/preferences",{method:"PATCH",who:c.who,data:{streamId:s.id,notifyLive:false}});
  const first=Date.now();
  await broadcast([s.id],first);
  let list=(await request("notifications",{who:b.who})).data;
  check(list.items.length===1 && list.unread===1,"Real event delivered to follower");
  check((await request("notifications",{who:c.who})).data.items.length===0,"Muted follower excluded");
  await broadcast([s.id],first+12_000);
  check((await request("notifications",{who:b.who})).data.items.length===1,"Reconnect deduplicated");
  await request("notifications/read",{method:"POST",who:c.who,data:{through:list.items[0].id}});
  check((await request("notifications",{who:b.who})).data.unread===1,"Read operations owner scoped");
  await request("notifications/read",{method:"POST",who:b.who,data:{through:list.items[0].id}});
  check((await request("notifications",{who:b.who})).data.unread===0,"Read acknowledged");
  await broadcast([s.id],first+80_000);
  check((await request("notifications",{who:b.who})).data.items.length===2,"New broadcast after disconnect notifies");
  await db.liveNotification.createMany({data:Array.from({length:55},(_,i)=>({userId:b.user.id,streamId:s.id,startedAt:new Date(first-10000-i),title:"Pagination fixture"}))});
  const page=(await request("notifications",{who:b.who})).data;
  check(page.items.length===50 && page.next!==null,"Notification page is bounded");
  const older=(await request("notifications?before="+page.next,{who:b.who})).data;
  check(older.items.length===7 && older.next===null,"Cursor returns remaining notices without overlap");
  check(!older.items.some(item=>page.items.some(p=>p.id===item.id)),"Pagination does not duplicate notices");
  await db.liveNotification.create({data:{userId:b.user.id,streamId:s.id,startedAt:new Date(first-31*86400000),title:"Expired fixture"}});
  check((await request("notifications",{who:b.who})).data.unread===56,"Expired notices excluded from unread count");
  await broadcast([s.id],first+90_000);
  check(await db.liveNotification.count({where:{title:"Expired fixture"}})===0,"Active polling removes expired notices");
  await db.stream.update({where:{id:s.id},data:{isSuspended:true}});
  check((await request("notifications",{who:b.who})).data.items.length===0,"Suspended channels hidden");
  await db.stream.update({where:{id:s.id},data:{isSuspended:false}});
  await db.chatMessage.create({data:{streamId:s.id,userId:a.user.id,text:"Owner message",scope:"public"}});
  await db.chatMessage.create({data:{streamId:s.id,userId:b.user.id,text:"Private other user text",scope:"moderators"}});
  await db.streamCredential.create({data:{streamId:s.id,path:"live/"+"a".repeat(32),keyHash:"SECRET_OBS_HASH"}});
  await db.alertSettings.create({data:{streamId:s.id,tokenHash:"SECRET_ALERT_HASH"}});
  await request("account/export",{method:"POST",status:401,data:{password}});
  await request("account/export",{method:"POST",who:a.who,status:401,data:{password:"wrong-password"}});
  const exported=(await request("account/export",{method:"POST",who:a.who,data:{password,userId:b.user.id}})).data;
  check(exported.account.id===a.user.id,"Export ignores supplied userID");
  check(exported.messages.length===1 && exported.messages[0].text==="Owner message","Export only own messages");
  const raw=JSON.stringify(exported);
  for(const secret of ["passwordHash","tokenHash","twoFactorSecret","recoveryCodes","keyHash","SECRET_OBS_HASH","SECRET_ALERT_HASH","Private other user text"])check(!raw.includes(secret),"Export excludes "+secret);
  const setup=(await request("account/two-factor/setup",{method:"POST",who:a.who,data:{password}})).data;
  process.env.ACCOUNT_ENCRYPTION_KEY=env.ACCOUNT_ENCRYPTION_KEY;
  const enabled=(await request("account/two-factor/confirm",{method:"POST",who:a.who,data:{password,code:totp(setup.secret,Math.floor(Date.now()/30000))}})).data;
  await request("account/delete",{method:"DELETE",who:a.who,status:401,data:{password,confirmation:a.user.username}});
  await request("account/delete",{method:"DELETE",who:a.who,status:400,data:{password,confirmation:"wrong"}});
  await db.auditEvent.create({data:{actorId:a.user.id,actorName:a.user.username,action:"channel.edit",target:a.user.username+" "+a.user.id,streamId:s.id}});
  await db.activityEvent.create({data:{streamId:s.id,kind:"follow",username:b.user.username}});
  await db.report.create({data:{reporterId:a.user.id,streamId:s.id,reason:"other",description:"Delete fixture report"}});
  await request("account/delete",{method:"DELETE",who:a.who,data:{password,confirmation:a.user.username,code:enabled.recoveryCodes[0]}});
  check(await db.user.findUnique({where:{id:a.user.id}})===null,"Account deleted");
  for(const model of ["stream","streamCredential","chatMessage","follow","alertSettings","activityEvent","liveNotification","liveState"])
    check(await db[model].count()===0,model+" cascaded");
  check(await db.session.count({where:{userId:a.user.id}})===0,"Sessions removed");
  check(await db.report.count()===0,"Reports removed");
  const audits=JSON.stringify(await db.auditEvent.findMany());
  check(!audits.includes(a.user.id)&&!audits.includes(a.user.username),"Audit identity anonymized");
  check(audits.includes("account.delete"),"Anonymous deletion audit retained");
  await request("account/security",{who:a.who,status:401});
  check(await db.user.count()===2,"Other accounts preserved");
  await db.user.update({where:{id:b.user.id},data:{role:"admin"}});
  await request("account/delete",{method:"DELETE",who:b.who,status:409,data:{password,confirmation:b.user.username}});
  await db.user.update({where:{id:c.user.id},data:{role:"admin",status:"banned"}});
  await request("account/delete",{method:"DELETE",who:b.who,status:409,data:{password,confirmation:b.user.username}});
  await db.user.update({where:{id:c.user.id},data:{status:"active"}});
  await request("account/delete",{method:"DELETE",who:b.who,data:{password,confirmation:b.user.username}});
  check(await db.user.count({where:{role:"admin",status:"active"}})===1,"Last active administrator preserved");
  console.log(`PASS: ${checks} account-data/notification assertions: reauthentication, export isolation/secrets, deletion cascades/audit/admin protection, live delivery/preferences/deduplication/read permissions`);
} finally { await stop();await db.$disconnect();await rm(folder,{recursive:true,force:true}); }
