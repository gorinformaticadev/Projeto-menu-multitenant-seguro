ALTER TABLE "execution_leases"
  ADD COLUMN IF NOT EXISTS "leaseVersion" BIGINT NOT NULL DEFAULT 0;

UPDATE "execution_leases"
SET "leaseVersion" = 1
WHERE "leaseVersion" = 0;
