CREATE TABLE "cron_materialized_executions" (
  "id" TEXT NOT NULL,
  "jobKey" TEXT NOT NULL,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'pending',
  "ownerId" TEXT,
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "leaseVersion" BIGINT NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "heartbeatAt" TIMESTAMP(3),
  "reason" TEXT,
  "error" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cron_materialized_executions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cron_materialized_executions_jobKey_scheduledFor_key"
  ON "cron_materialized_executions"("jobKey", "scheduledFor");

CREATE INDEX "cron_materialized_executions_jobKey_scheduledFor_idx"
  ON "cron_materialized_executions"("jobKey", "scheduledFor");

CREATE INDEX "cron_materialized_executions_jobKey_status_scheduledFor_idx"
  ON "cron_materialized_executions"("jobKey", "status", "scheduledFor");

CREATE INDEX "cron_materialized_executions_status_lockedUntil_idx"
  ON "cron_materialized_executions"("status", "lockedUntil");

CREATE INDEX "cron_materialized_executions_jobKey_updatedAt_idx"
  ON "cron_materialized_executions"("jobKey", "updatedAt");
