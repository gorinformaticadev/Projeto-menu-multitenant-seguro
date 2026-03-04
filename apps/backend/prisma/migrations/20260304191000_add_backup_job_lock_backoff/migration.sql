ALTER TABLE "backup_jobs"
ADD COLUMN IF NOT EXISTS "lockAttempts" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "backup_jobs"
ADD COLUMN IF NOT EXISTS "nextRunAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "backup_jobs_status_nextRunAt_createdAt_idx"
  ON "backup_jobs"("status", "nextRunAt", "createdAt");

CREATE INDEX IF NOT EXISTS "backup_jobs_nextRunAt_idx"
  ON "backup_jobs"("nextRunAt");
