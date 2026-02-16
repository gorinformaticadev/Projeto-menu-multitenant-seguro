ALTER TABLE "system_settings"
ADD COLUMN IF NOT EXISTS "releaseTag" TEXT DEFAULT 'latest',
ADD COLUMN IF NOT EXISTS "composeFile" TEXT DEFAULT 'docker-compose.prod.yml',
ADD COLUMN IF NOT EXISTS "envFile" TEXT DEFAULT 'install/.env.production';
