"""Verify upgrade removes only showcase data and preserves real streaming state."""
import sqlite3
from pathlib import Path

db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys=ON")
paths = sorted(Path("prisma/migrations").glob("*/migration.sql"))
for path in paths[:-1]:
    db.executescript(path.read_text())
for uid, email, username in [("real", "real@example.test", "actualcreator"), ("demo", "kaizen@showcase.invalid", "Kaizen"), ("keep", "mika@showcase.invalid", "converted")]:
    db.execute('INSERT INTO "User" (id,email,username,passwordHash) VALUES (?,?,?,?)', (uid,email,username,"synthetic-hash"))
for sid, owner, demo in [(1,"real",0),(2,"demo",1),(3,"keep",0)]:
    db.execute('INSERT INTO "Stream" (id,slug,ownerId,title,game,category,isDemo,updatedAt) VALUES (?,?,?,?,?,?,?,CURRENT_TIMESTAMP)',(sid,f"channel-{sid}",owner,"test","activity","Gaming",demo))
db.execute('INSERT INTO "Session" (tokenHash,userId,expiresAt) VALUES (?,?,?)',("synthetic-session","real","2099-01-01"))
db.execute('INSERT INTO "StreamCredential" (streamId,path,keyHash,updatedAt) VALUES (1,?,?,CURRENT_TIMESTAMP)',("live/synthetic-path","synthetic-key-hash"))
db.execute('INSERT INTO "Follow" (streamId,userId) VALUES (1,"real")')
db.execute('INSERT INTO "ChatMessage" (streamId,userId,text) VALUES (1,"real","preserve conversation")')
db.execute('INSERT INTO "ChatMessage" (streamId,userId,text) VALUES (2,"demo","delete sample")')
db.commit()
db.executescript(paths[-1].read_text())
assert db.execute('SELECT id FROM "Stream" ORDER BY id').fetchall() == [(1,), (3,)]
assert db.execute('SELECT id FROM "User" ORDER BY id').fetchall() == [("keep",), ("real",)]
assert db.execute('SELECT tokenHash FROM "Session"').fetchone()[0] == "synthetic-session"
assert db.execute('SELECT path,keyHash FROM "StreamCredential"').fetchone() == ("live/synthetic-path","synthetic-key-hash")
assert db.execute('SELECT count(*) FROM "Follow"').fetchone()[0] == 1
assert db.execute('SELECT text,scope,isBot FROM "ChatMessage"').fetchall() == [("preserve conversation","public",0)]
assert db.execute('SELECT image,avatar,title FROM "Stream" WHERE id=1').fetchone() == ("channel",0,"test")
assert db.execute("PRAGMA foreign_key_check").fetchall() == []
assert db.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
print("PASS: upgrade preserves real accounts, channels, sessions, follows, messages and stream keys; removes sample rows; foreign keys/integrity valid")
