-- DropIndex
DROP INDEX "notifications_isRead_idx";

-- DropIndex
DROP INDEX "notifications_notificationGroupId_idx";

-- DropIndex
DROP INDEX "notifications_read_idx";

-- DropIndex
DROP INDEX "notifications_source_idx";

-- CreateIndex
CREATE INDEX "notification_groups_tenantId_lastNotificationAt_idx" ON "notification_groups"("tenantId", "lastNotificationAt" DESC);

-- CreateIndex
CREATE INDEX "notifications_notificationGroupId_createdAt_idx" ON "notifications"("notificationGroupId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "notifications_notificationGroupId_read_idx" ON "notifications"("notificationGroupId", "read");

-- CreateIndex
CREATE INDEX "notifications_notificationGroupId_isRead_idx" ON "notifications"("notificationGroupId", "isRead");
