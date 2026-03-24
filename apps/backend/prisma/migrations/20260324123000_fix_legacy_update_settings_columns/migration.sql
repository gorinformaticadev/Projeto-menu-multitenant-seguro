DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'update_system_settings'
  ) THEN
    ALTER TABLE "update_system_settings"
      ADD COLUMN IF NOT EXISTS "updateChannel" TEXT DEFAULT 'release',
      ADD COLUMN IF NOT EXISTS "releaseTag" TEXT DEFAULT 'latest',
      ADD COLUMN IF NOT EXISTS "composeFile" TEXT DEFAULT 'docker-compose.prod.yml',
      ADD COLUMN IF NOT EXISTS "envFile" TEXT DEFAULT 'install/.env.production';
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'system_settings'
  ) THEN
    ALTER TABLE "system_settings"
      ADD COLUMN IF NOT EXISTS "updateChannel" TEXT DEFAULT 'release',
      ADD COLUMN IF NOT EXISTS "releaseTag" TEXT DEFAULT 'latest',
      ADD COLUMN IF NOT EXISTS "composeFile" TEXT DEFAULT 'docker-compose.prod.yml',
      ADD COLUMN IF NOT EXISTS "envFile" TEXT DEFAULT 'install/.env.production';
  END IF;
END $$;
