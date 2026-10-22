BEGIN IMMEDIATE;
ALTER TABLE "User" ADD COLUMN "twoFactorSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "twoFactorLastCounter" INTEGER NOT NULL DEFAULT -1;
ALTER TABLE "User" ADD COLUMN "recoveryCodes" TEXT NOT NULL DEFAULT '[]';
CREATE TABLE "TwoFactorSetup" (
  "userId" TEXT NOT NULL PRIMARY KEY,
  "secret" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  CONSTRAINT "TwoFactorSetup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "new_Session" (
  "id" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userAgent" TEXT NOT NULL DEFAULT '',
  "tokenHash" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Session" ("id","tokenHash","userId","expiresAt") SELECT lower(hex(randomblob(16))),"tokenHash","userId","expiresAt" FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
CREATE UNIQUE INDEX "Session_id_key" ON "Session"("id");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
-- A creator is not a follower of their own channel; remove those synthetic events too.
DELETE FROM "Follow" WHERE "userId" = (SELECT "ownerId" FROM "Stream" WHERE "id" = "Follow"."streamId");
DELETE FROM "ActivityEvent" WHERE "kind"='follow' AND "username" = (
  SELECT u."username" FROM "Stream" s JOIN "User" u ON u."id"=s."ownerId" WHERE s."id"="ActivityEvent"."streamId"
);

ALTER TABLE "Stream" ADD COLUMN "isSuspended" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Stream" ADD COLUMN "suspensionReason" TEXT NOT NULL DEFAULT '';
CREATE TABLE "PlatformSettings" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'main',
  "registrationOpen" BOOLEAN NOT NULL DEFAULT true,
  "announcement" TEXT NOT NULL DEFAULT ''
);
CREATE TABLE "Report" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "reporterId" TEXT NOT NULL,
  "streamId" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "resolution" TEXT NOT NULL DEFAULT '',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "Report_status_id_idx" ON "Report"("status", "id");

COMMIT;
