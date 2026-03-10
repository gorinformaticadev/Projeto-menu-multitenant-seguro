-- Add user avatar and platform logo references
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;

ALTER TABLE "security_config"
ADD COLUMN IF NOT EXISTS "platformLogoUrl" TEXT;
