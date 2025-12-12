-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "appVersion" TEXT DEFAULT '1.0.0',
    "gitToken" TEXT,
    "gitUsername" TEXT,
    "gitRepository" TEXT,
    "gitReleaseBranch" TEXT NOT NULL DEFAULT 'main',
    "packageManager" TEXT NOT NULL DEFAULT 'npm',
    "updateCheckEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastUpdateCheck" TIMESTAMP(3),
    "availableVersion" TEXT,
    "updateAvailable" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "update_logs" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "packageManager" TEXT NOT NULL DEFAULT 'npm',
    "backupPath" TEXT,
    "errorMessage" TEXT,
    "rollbackReason" TEXT,
    "executedBy" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "executionLogs" TEXT,

    CONSTRAINT "update_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "update_logs_status_idx" ON "update_logs"("status");

-- CreateIndex
CREATE INDEX "update_logs_startedAt_idx" ON "update_logs"("startedAt");

-- CreateIndex
CREATE INDEX "update_logs_version_idx" ON "update_logs"("version");

-- CreateIndex
CREATE INDEX "update_logs_executedBy_idx" ON "update_logs"("executedBy");

-- Insert default system settings
INSERT INTO "system_settings" ("id", "appVersion", "packageManager", "updateCheckEnabled", "gitReleaseBranch", "updatedAt")
VALUES (gen_random_uuid(), '1.0.0', 'npm', true, 'main', CURRENT_TIMESTAMP);