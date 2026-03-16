-- AlterTable
ALTER TABLE "user_sessions"
ADD COLUMN "expiresAt" TIMESTAMP(3);

UPDATE "user_sessions"
SET "expiresAt" = COALESCE("lastActivityAt", CURRENT_TIMESTAMP) + INTERVAL '30 minutes'
WHERE "expiresAt" IS NULL;

ALTER TABLE "user_sessions"
ALTER COLUMN "expiresAt" SET NOT NULL;

-- CreateIndex
CREATE INDEX "user_sessions_expiresAt_idx" ON "user_sessions"("expiresAt");
