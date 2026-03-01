-- Add Web Push settings to security_config
ALTER TABLE "security_config"
  ADD COLUMN IF NOT EXISTS "webPushPublicKey" TEXT,
  ADD COLUMN IF NOT EXISTS "webPushPrivateKey" TEXT,
  ADD COLUMN IF NOT EXISTS "webPushSubject" TEXT DEFAULT 'mailto:suporte@example.com';
