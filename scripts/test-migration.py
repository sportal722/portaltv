"""Verify upgrade removes only showcase data and preserves real streaming state."""
import sqlite3
from pathlib import Path

db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys=ON")
paths = sorted(Path("prisma/migrations").glob("*/migration.sql"))
studio = next(i for i,p in enumerate(paths) if "creator_workspace" in str(p))
for path in paths[:studio]:
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
db.executescript(paths[studio].read_text())
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

# Upgrade readable URLs after checking the previous cleanup migration.
for path in paths[studio+1:]:
    if "account_security" in str(path):
        db.execute('INSERT INTO Follow (userId,streamId) VALUES ("keep",1)'); db.commit()
    db.executescript(path.read_text())
assert db.execute('SELECT slug,legacySlug FROM "Stream" WHERE id=1').fetchone() == ("actualcreator","channel-1")
assert db.execute('SELECT path,keyHash FROM "StreamCredential"').fetchone() == ("live/synthetic-path","synthetic-key-hash")
assert db.execute("PRAGMA foreign_key_check").fetchall() == []
print("PASS: canonical username URL and legacy alias preserved without modifying OBS credentials")

# Multiple channels, underscores and case-distinct accounts stay unique after upgrade.
other = sqlite3.connect(":memory:")
readable = next(i for i,p in enumerate(paths) if "readable_channel_urls" in str(p))
for path in paths[:readable]: other.executescript(path.read_text())
for uid, username in [("a", "Some_User"), ("b", "some_user"), ("c", "someuser")]:
    other.execute('INSERT INTO User (id,email,username,passwordHash) VALUES (?,?,?,?)',(uid,uid+'@example.test',username,'synthetic'))
for sid, owner in [(1,"a"),(2,"a"),(3,"b"),(4,"c")]:
    other.execute('INSERT INTO Stream (id,slug,ownerId,title,game,category,updatedAt) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP)',(sid,'old-'+str(sid),owner,'Existing real channel','Activity','Gaming'))
other.commit()
other.executescript(paths[readable].read_text())
assert other.execute('SELECT slug,legacySlug FROM Stream ORDER BY id').fetchall() == [('some_user','old-1'),('some_user--2','old-2'),('some_user--3','old-3'),('someuser','old-4')]
print('PASS: readable migration handles multiple channels, case variants and underscores without collisions')

# Security migration preserves valid sessions and all non-self follows.
assert db.execute('SELECT tokenHash,userId,expiresAt FROM Session').fetchone()==('synthetic-session','real','2099-01-01')
assert db.execute('SELECT length(id) FROM Session').fetchone()[0]==32
assert db.execute('SELECT count(*) FROM Follow WHERE userId="real" AND streamId=1').fetchone()[0]==0
assert db.execute('SELECT twoFactorSecret,twoFactorLastCounter,recoveryCodes FROM User WHERE id="real"').fetchone()==(None,-1,'[]')
assert db.execute('SELECT isSuspended FROM Stream WHERE id=1').fetchone()[0]==0
assert db.execute('PRAGMA foreign_key_check').fetchall()==[]
print('PASS: session cookies/ownership retained; self-follows removed; 2FA defaults disabled and channels not suspended')

assert db.execute('SELECT userId FROM Follow WHERE streamId=1').fetchall()==[("keep",)]
