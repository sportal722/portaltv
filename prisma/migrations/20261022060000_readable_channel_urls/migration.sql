ALTER TABLE "Stream" ADD COLUMN "legacySlug" TEXT;
CREATE UNIQUE INDEX "Stream_legacySlug_key" ON "Stream"("legacySlug");
UPDATE "Stream" SET "legacySlug" = "slug";
-- Usernames have no hyphens. Number additional channels deterministically, never randomly.
-- Include case variants in the numbering because URLs are lowercase.
UPDATE "Stream" SET "slug" = (
  SELECT lower(u.username) || CASE WHEN (
    SELECT count(*) FROM "Stream" s JOIN "User" other ON other.id=s.ownerId
    WHERE lower(other.username)=lower(u.username) AND s.id <= "Stream".id
  ) = 1 THEN '' ELSE '--' || (
    SELECT count(*) FROM "Stream" s JOIN "User" other ON other.id=s.ownerId
    WHERE lower(other.username)=lower(u.username) AND s.id <= "Stream".id
  ) END
  FROM "User" u WHERE u.id="Stream".ownerId
);
