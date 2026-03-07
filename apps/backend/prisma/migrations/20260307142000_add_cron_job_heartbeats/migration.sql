CREATE TABLE IF NOT EXISTS "cron_job_heartbeats" (
  "jobKey" TEXT NOT NULL,
  "lastStartedAt" TIMESTAMP(3),
  "lastSucceededAt" TIMESTAMP(3),
  "lastFailedAt" TIMESTAMP(3),
  "lastDurationMs" INTEGER,
  "lastStatus" TEXT NOT NULL DEFAULT 'idle',
  "lastError" TEXT,
  "nextExpectedRunAt" TIMESTAMP(3),
  "consecutiveFailureCount" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cron_job_heartbeats_pkey" PRIMARY KEY ("jobKey")
);

CREATE INDEX IF NOT EXISTS "cron_job_heartbeats_lastStatus_idx"
  ON "cron_job_heartbeats"("lastStatus");

CREATE INDEX IF NOT EXISTS "cron_job_heartbeats_updatedAt_idx"
  ON "cron_job_heartbeats"("updatedAt");

CREATE INDEX IF NOT EXISTS "cron_job_heartbeats_nextExpectedRunAt_idx"
  ON "cron_job_heartbeats"("nextExpectedRunAt");
