-- CreateTable
CREATE TABLE "ChannelModerator" (
    "streamId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("streamId", "userId"),
    CONSTRAINT "ChannelModerator_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChannelModerator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChannelBan" (
    "streamId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("streamId", "userId"),
    CONSTRAINT "ChannelBan_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChannelBan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatSettings" (
    "streamId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slowSeconds" INTEGER NOT NULL DEFAULT 0,
    "followersOnly" BOOLEAN NOT NULL DEFAULT false,
    "blockLinks" BOOLEAN NOT NULL DEFAULT false,
    "blockedWords" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "ChatSettings_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatCommand" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "streamId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "cooldownSeconds" INTEGER NOT NULL DEFAULT 30,
    "moderatorsOnly" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" DATETIME,
    CONSTRAINT "ChatCommand_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlertSettings" (
    "streamId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "followersEnabled" BOOLEAN NOT NULL DEFAULT true,
    "template" TEXT NOT NULL DEFAULT '¡Gracias por seguir el canal, {user}!',
    "accent" TEXT NOT NULL DEFAULT '#a78bfa',
    "durationSeconds" INTEGER NOT NULL DEFAULT 6,
    "soundEnabled" BOOLEAN NOT NULL DEFAULT false,
    "tokenHash" TEXT,
    CONSTRAINT "AlertSettings_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "streamId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityEvent_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "streamId" INTEGER,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Stream" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "image" TEXT NOT NULL DEFAULT 'channel',
    "avatar" INTEGER NOT NULL DEFAULT 0,
    "tag" TEXT NOT NULL DEFAULT 'Comunidad',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL DEFAULT '',
    "language" TEXT NOT NULL DEFAULT 'Español',
    "thumbnailUrl" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'offline',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Stream_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Stream" ("avatar", "category", "createdAt", "game", "id", "image", "isDemo", "ownerId", "slug", "status", "tag", "title", "updatedAt") SELECT "avatar", "category", "createdAt", "game", "id", "image", "isDemo", "ownerId", "slug", "status", "tag", "title", "updatedAt" FROM "Stream";
DROP TABLE "Stream";
ALTER TABLE "new_Stream" RENAME TO "Stream";
CREATE UNIQUE INDEX "Stream_slug_key" ON "Stream"("slug");
CREATE INDEX "Stream_ownerId_idx" ON "Stream"("ownerId");
CREATE INDEX "Stream_category_idx" ON "Stream"("category");
CREATE TABLE "new_ChatMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "streamId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'public',
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ChatMessage" ("createdAt", "id", "streamId", "text", "userId") SELECT "createdAt", "id", "streamId", "text", "userId" FROM "ChatMessage";
DROP TABLE "ChatMessage";
ALTER TABLE "new_ChatMessage" RENAME TO "ChatMessage";
CREATE INDEX "ChatMessage_streamId_id_idx" ON "ChatMessage"("streamId", "id");
CREATE INDEX "ChatMessage_userId_idx" ON "ChatMessage"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ChannelModerator_userId_idx" ON "ChannelModerator"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatCommand_streamId_name_key" ON "ChatCommand"("streamId", "name");

-- CreateIndex
CREATE INDEX "ActivityEvent_streamId_id_idx" ON "ActivityEvent"("streamId", "id");

-- CreateIndex
CREATE INDEX "AuditEvent_streamId_id_idx" ON "AuditEvent"("streamId", "id");


-- Remove only explicitly marked showcase channels. Real accounts/channels remain.
DELETE FROM "Stream" WHERE "isDemo" = 1;
DELETE FROM "User" WHERE "email" IN ('kaizen@showcase.invalid','lunavibes@showcase.invalid','alexrush@showcase.invalid','niaplays@showcase.invalid','danidrive@showcase.invalid','sofisound@showcase.invalid','mika@showcase.invalid') AND NOT EXISTS (SELECT 1 FROM "Stream" WHERE "Stream"."ownerId" = "User"."id");
UPDATE "Stream" SET "image" = 'channel', "avatar" = 0;
