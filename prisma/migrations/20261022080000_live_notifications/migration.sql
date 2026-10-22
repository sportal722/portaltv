BEGIN IMMEDIATE;
ALTER TABLE "Follow" ADD COLUMN "notifyLive" BOOLEAN NOT NULL DEFAULT true;
CREATE TABLE "LiveState" (
 "streamId" INTEGER NOT NULL PRIMARY KEY,
 "lastSeenAt" DATETIME NOT NULL,
 "startedAt" DATETIME NOT NULL,
 FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "LiveNotification" (
 "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
 "userId" TEXT NOT NULL,
 "streamId" INTEGER NOT NULL,
 "startedAt" DATETIME NOT NULL,
 "title" TEXT NOT NULL,
 "readAt" DATETIME,
 FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LiveNotification_userId_streamId_startedAt_key" ON "LiveNotification"("userId", "streamId", "startedAt");
CREATE INDEX "LiveNotification_userId_id_idx" ON "LiveNotification"("userId", "id");
COMMIT;
