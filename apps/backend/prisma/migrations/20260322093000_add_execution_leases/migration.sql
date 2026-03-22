CREATE TABLE IF NOT EXISTS "execution_leases" (
  "jobKey" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'released',
  "startedAt" TIMESTAMP(3) NOT NULL,
  "heartbeatAt" TIMESTAMP(3) NOT NULL,
  "lockedUntil" TIMESTAMP(3) NOT NULL,
  "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "releasedAt" TIMESTAMP(3),
  "releaseReason" TEXT,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "execution_leases_pkey" PRIMARY KEY ("jobKey")
);

CREATE INDEX IF NOT EXISTS "execution_leases_status_lockedUntil_idx"
  ON "execution_leases"("status", "lockedUntil");

CREATE INDEX IF NOT EXISTS "execution_leases_ownerId_idx"
  ON "execution_leases"("ownerId");
