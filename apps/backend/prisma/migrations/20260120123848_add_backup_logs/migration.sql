/*
  Warnings:

  - The `data` column on the `notifications` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `metadata` column on the `secure_files` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "BackupOperation" AS ENUM ('BACKUP', 'RESTORE');

-- CreateEnum
CREATE TYPE "BackupStatus" AS ENUM ('STARTED', 'SUCCESS', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "data",
ADD COLUMN     "data" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "secure_files" DROP COLUMN "metadata",
ADD COLUMN     "metadata" JSONB;

-- CreateTable
CREATE TABLE "backup_logs" (
    "id" TEXT NOT NULL,
    "operationType" "BackupOperation" NOT NULL,
    "status" "BackupStatus" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" BIGINT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "executedBy" TEXT NOT NULL,
    "ipAddress" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,

    CONSTRAINT "backup_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "backup_logs_operationType_idx" ON "backup_logs"("operationType");

-- CreateIndex
CREATE INDEX "backup_logs_status_idx" ON "backup_logs"("status");

-- CreateIndex
CREATE INDEX "backup_logs_executedBy_idx" ON "backup_logs"("executedBy");

-- CreateIndex
CREATE INDEX "backup_logs_startedAt_idx" ON "backup_logs"("startedAt");

-- AddForeignKey
ALTER TABLE "backup_logs" ADD CONSTRAINT "backup_logs_executedBy_fkey" FOREIGN KEY ("executedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
