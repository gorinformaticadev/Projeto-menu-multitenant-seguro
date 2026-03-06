CREATE INDEX IF NOT EXISTS "notifications_targetRole_isRead_createdAt_idx"
  ON "notifications"("targetRole", "isRead", "createdAt");

CREATE INDEX IF NOT EXISTS "notifications_targetUserId_isRead_createdAt_idx"
  ON "notifications"("targetUserId", "isRead", "createdAt");
