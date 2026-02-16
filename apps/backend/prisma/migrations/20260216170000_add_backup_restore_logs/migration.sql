CREATE TYPE "RestoreStatus" AS ENUM ('STARTED', 'SUCCESS', 'FAILED');

CREATE TABLE "backup_restore_logs" (
  "id" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "status" "RestoreStatus" NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "stdout" TEXT,
  "stderr" TEXT,
  "executedBy" TEXT NOT NULL,
  "rollbackReason" TEXT,
  "errorMessage" TEXT,
  "metadata" JSONB,
  CONSTRAINT "backup_restore_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "backup_restore_logs_status_idx" ON "backup_restore_logs"("status");
CREATE INDEX "backup_restore_logs_startedAt_idx" ON "backup_restore_logs"("startedAt");
CREATE INDEX "backup_restore_logs_executedBy_idx" ON "backup_restore_logs"("executedBy");

ALTER TABLE "backup_restore_logs"
ADD CONSTRAINT "backup_restore_logs_executedBy_fkey"
FOREIGN KEY ("executedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
