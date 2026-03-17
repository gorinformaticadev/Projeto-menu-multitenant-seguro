-- CreateTable
CREATE TABLE "trusted_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceLabel" TEXT,
    "userAgent" TEXT,
    "createdIp" TEXT,
    "lastUsedIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" TEXT,
    "revokeReason" TEXT,

    CONSTRAINT "trusted_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trusted_devices_tokenHash_key" ON "trusted_devices"("tokenHash");
CREATE INDEX "trusted_devices_userId_idx" ON "trusted_devices"("userId");
CREATE INDEX "trusted_devices_expiresAt_idx" ON "trusted_devices"("expiresAt");
CREATE INDEX "trusted_devices_revokedAt_idx" ON "trusted_devices"("revokedAt");
CREATE INDEX "trusted_devices_userId_revokedAt_expiresAt_idx" ON "trusted_devices"("userId", "revokedAt", "expiresAt");

-- AddForeignKey
ALTER TABLE "trusted_devices"
ADD CONSTRAINT "trusted_devices_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "trusted_devices"
ADD CONSTRAINT "trusted_devices_revokedByUserId_fkey"
FOREIGN KEY ("revokedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
