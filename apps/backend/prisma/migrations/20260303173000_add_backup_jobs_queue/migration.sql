-- CreateEnum
CREATE TYPE "BackupArtifactSource" AS ENUM ('BACKUP', 'UPLOAD', 'SAFETY');

-- CreateEnum
CREATE TYPE "BackupJobType" AS ENUM ('BACKUP', 'RESTORE');

-- CreateEnum
CREATE TYPE "BackupJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELED');

-- CreateTable
CREATE TABLE "backup_artifacts" (
  "id" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "sizeBytes" BIGINT NOT NULL,
  "checksumSha256" TEXT NOT NULL,
  "source" "BackupArtifactSource" NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  "createdByUserId" TEXT,
  CONSTRAINT "backup_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_jobs" (
  "id" TEXT NOT NULL,
  "type" "BackupJobType" NOT NULL,
  "status" "BackupJobStatus" NOT NULL DEFAULT 'PENDING',
  "artifactId" TEXT,
  "fileName" TEXT,
  "filePath" TEXT,
  "sizeBytes" BIGINT,
  "checksumSha256" TEXT,
  "progressPercent" INTEGER NOT NULL DEFAULT 0,
  "currentStep" TEXT,
  "metadata" JSONB,
  "logs" JSONB,
  "error" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "cancelRequested" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdByUserId" TEXT,
  CONSTRAINT "backup_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_leases" (
  "key" TEXT NOT NULL,
  "holderJobId" TEXT,
  "operationType" "BackupJobType",
  "acquiredAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "metadata" JSONB,
  CONSTRAINT "backup_leases_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "backup_artifacts_source_createdAt_idx" ON "backup_artifacts"("source", "createdAt");

-- CreateIndex
CREATE INDEX "backup_artifacts_createdByUserId_idx" ON "backup_artifacts"("createdByUserId");

-- CreateIndex
CREATE INDEX "backup_artifacts_deletedAt_idx" ON "backup_artifacts"("deletedAt");

-- CreateIndex
CREATE INDEX "backup_jobs_status_createdAt_idx" ON "backup_jobs"("status", "createdAt");

-- CreateIndex
CREATE INDEX "backup_jobs_type_status_idx" ON "backup_jobs"("type", "status");

-- CreateIndex
CREATE INDEX "backup_jobs_artifactId_idx" ON "backup_jobs"("artifactId");

-- CreateIndex
CREATE INDEX "backup_jobs_createdByUserId_idx" ON "backup_jobs"("createdByUserId");

-- CreateIndex
CREATE INDEX "backup_jobs_cancelRequested_idx" ON "backup_jobs"("cancelRequested");

-- CreateIndex
CREATE INDEX "backup_leases_expiresAt_idx" ON "backup_leases"("expiresAt");

-- AddForeignKey
ALTER TABLE "backup_artifacts"
ADD CONSTRAINT "backup_artifacts_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_jobs"
ADD CONSTRAINT "backup_jobs_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_jobs"
ADD CONSTRAINT "backup_jobs_artifactId_fkey"
FOREIGN KEY ("artifactId") REFERENCES "backup_artifacts"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
