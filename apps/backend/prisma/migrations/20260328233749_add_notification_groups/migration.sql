/*
  Warnings:

  - Made the column `updateChannel` on table `update_system_settings` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "cron_materialized_executions" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "execution_leases" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "notificationGroupId" TEXT;

-- AlterTable
ALTER TABLE "security_config" ALTER COLUMN "globalMaxRequests" SET DEFAULT 10000,
ALTER COLUMN "rateLimitDevEnabled" SET DEFAULT false,
ALTER COLUMN "rateLimitDevRequests" SET DEFAULT 10000,
ALTER COLUMN "rateLimitProdEnabled" SET DEFAULT false,
ALTER COLUMN "rateLimitProdRequests" SET DEFAULT 10000;

-- AlterTable
ALTER TABLE "system_settings" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "update_system_settings" ALTER COLUMN "updateChannel" SET NOT NULL;

-- CreateTable
CREATE TABLE "notification_groups" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "userId" TEXT,
    "scopeType" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "lastNotificationId" TEXT,
    "lastNotificationAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastTitle" TEXT NOT NULL,
    "lastBody" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_groups_tenantId_userId_idx" ON "notification_groups"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "notification_groups_scopeType_scopeKey_idx" ON "notification_groups"("scopeType", "scopeKey");

-- CreateIndex
CREATE INDEX "notification_groups_lastNotificationAt_idx" ON "notification_groups"("lastNotificationAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_groups_tenantId_userId_scopeType_scopeKey_key" ON "notification_groups"("tenantId", "userId", "scopeType", "scopeKey");

-- CreateIndex
CREATE INDEX "notifications_notificationGroupId_idx" ON "notifications"("notificationGroupId");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_notificationGroupId_fkey" FOREIGN KEY ("notificationGroupId") REFERENCES "notification_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
