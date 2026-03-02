DO $$
BEGIN
  CREATE TYPE "SeedRunStatus" AS ENUM ('STARTED', 'SUCCESS', 'FAILED', 'SKIPPED', 'FORCED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "seed_history" (
  "id" TEXT NOT NULL,
  "executionId" TEXT NOT NULL,
  "seedKey" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "SeedRunStatus" NOT NULL DEFAULT 'STARTED',
  "force" BOOLEAN NOT NULL DEFAULT false,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "host" TEXT,
  "error" TEXT,
  "summary" JSONB,
  "userId" TEXT,
  CONSTRAINT "seed_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "seed_history_module_version_status_idx"
  ON "seed_history"("module", "version", "status");

CREATE INDEX IF NOT EXISTS "seed_history_executionId_idx"
  ON "seed_history"("executionId");

CREATE INDEX IF NOT EXISTS "seed_history_startedAt_idx"
  ON "seed_history"("startedAt");

CREATE INDEX IF NOT EXISTS "seed_history_userId_idx"
  ON "seed_history"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'seed_history_userId_fkey'
  ) THEN
    ALTER TABLE "seed_history"
      ADD CONSTRAINT "seed_history_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
