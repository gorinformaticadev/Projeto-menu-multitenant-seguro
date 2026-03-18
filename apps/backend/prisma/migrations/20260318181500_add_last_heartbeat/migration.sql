-- AlterTable
ALTER TABLE "cron_job_heartbeats" ADD COLUMN IF NOT EXISTS "lastHeartbeatAt" TIMESTAMP(3);
