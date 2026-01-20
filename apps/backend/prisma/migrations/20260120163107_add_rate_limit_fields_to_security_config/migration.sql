-- AlterTable
ALTER TABLE "security_config" ADD COLUMN     "backupRateLimitPerHour" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "restoreRateLimitPerHour" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "updateRateLimitPerHour" INTEGER NOT NULL DEFAULT 2;
