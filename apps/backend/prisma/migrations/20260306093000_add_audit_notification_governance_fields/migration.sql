ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "severity" TEXT NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS "message" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "actorUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "actorEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "actorRole" TEXT,
  ADD COLUMN IF NOT EXISTS "ip" TEXT,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}';

UPDATE "audit_logs"
SET "message" = "action"
WHERE COALESCE("message", '') = '';

UPDATE "audit_logs"
SET "ip" = "ipAddress"
WHERE "ip" IS NULL AND "ipAddress" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "audit_logs_actorUserId_idx" ON "audit_logs"("actorUserId");
CREATE INDEX IF NOT EXISTS "audit_logs_severity_idx" ON "audit_logs"("severity");

ALTER TABLE "notifications"
  ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'SYSTEM_ALERT',
  ADD COLUMN IF NOT EXISTS "body" TEXT,
  ADD COLUMN IF NOT EXISTS "targetRole" TEXT DEFAULT 'SUPER_ADMIN',
  ADD COLUMN IF NOT EXISTS "targetUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "isRead" BOOLEAN NOT NULL DEFAULT false;

UPDATE "notifications"
SET "body" = "message"
WHERE "body" IS NULL;

UPDATE "notifications"
SET "isRead" = COALESCE("read", false)
WHERE "isRead" IS DISTINCT FROM COALESCE("read", false);

UPDATE "notifications"
SET "targetRole" = CASE
  WHEN "audience" = 'super_admin' THEN 'SUPER_ADMIN'
  ELSE "targetRole"
END
WHERE "targetRole" IS NULL;

UPDATE "notifications"
SET "targetUserId" = "userId"
WHERE "targetUserId" IS NULL AND "userId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "notifications_targetUserId_idx" ON "notifications"("targetUserId");
CREATE INDEX IF NOT EXISTS "notifications_targetRole_idx" ON "notifications"("targetRole");
CREATE INDEX IF NOT EXISTS "notifications_isRead_idx" ON "notifications"("isRead");
