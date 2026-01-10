-- AlterTable
ALTER TABLE "security_config" ADD COLUMN     "maxActiveSessionsPerUser" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "rateLimitDevEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "rateLimitDevRequests" INTEGER NOT NULL DEFAULT 1000,
ADD COLUMN     "rateLimitDevWindow" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "rateLimitProdEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "rateLimitProdRequests" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "rateLimitProdWindow" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "refreshTokenRotation" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tokenCleanupEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tokenCleanupIntervalHours" INTEGER NOT NULL DEFAULT 24;
