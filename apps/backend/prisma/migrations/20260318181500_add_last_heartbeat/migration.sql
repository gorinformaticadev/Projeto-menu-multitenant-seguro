-- AlterTable
ALTER TABLE "cron_job_heartbeats" 
ADD COLUMN IF NOT EXISTS "lastHeartbeatAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "cycleId" TEXT,
ADD COLUMN IF NOT EXISTS "instanceId" TEXT;
