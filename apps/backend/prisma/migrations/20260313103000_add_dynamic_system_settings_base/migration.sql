DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'system_settings'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'update_system_settings'
  ) THEN
    ALTER TABLE "system_settings" RENAME TO "update_system_settings";

    IF EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'system_settings_pkey'
        AND conrelid = 'update_system_settings'::regclass
    ) THEN
      ALTER TABLE "update_system_settings"
        RENAME CONSTRAINT "system_settings_pkey" TO "update_system_settings_pkey";
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_class
      WHERE relkind = 'i'
        AND relname = 'system_settings_pkey'
    ) THEN
      ALTER INDEX "system_settings_pkey" RENAME TO "update_system_settings_pkey";
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "system_settings" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "valueJson" JSONB NOT NULL,
  "valueType" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'system',
  "tenantId" TEXT,
  "source" TEXT NOT NULL DEFAULT 'seed_env',
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "version" INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "system_settings_key_key"
  ON "system_settings"("key");

CREATE INDEX IF NOT EXISTS "system_settings_category_idx"
  ON "system_settings"("category");

CREATE INDEX IF NOT EXISTS "system_settings_scope_idx"
  ON "system_settings"("scope");

CREATE INDEX IF NOT EXISTS "system_settings_tenantId_idx"
  ON "system_settings"("tenantId");

CREATE INDEX IF NOT EXISTS "system_settings_scope_tenantId_idx"
  ON "system_settings"("scope", "tenantId");

CREATE TABLE IF NOT EXISTS "system_setting_audits" (
  "id" TEXT NOT NULL,
  "settingKey" TEXT NOT NULL,
  "oldValueJson" JSONB,
  "newValueJson" JSONB,
  "changedByUserId" TEXT,
  "changedByEmail" TEXT,
  "changeReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "system_setting_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "system_setting_audits_settingKey_idx"
  ON "system_setting_audits"("settingKey");

CREATE INDEX IF NOT EXISTS "system_setting_audits_createdAt_idx"
  ON "system_setting_audits"("createdAt");

CREATE INDEX IF NOT EXISTS "system_setting_audits_settingKey_createdAt_idx"
  ON "system_setting_audits"("settingKey", "createdAt");
