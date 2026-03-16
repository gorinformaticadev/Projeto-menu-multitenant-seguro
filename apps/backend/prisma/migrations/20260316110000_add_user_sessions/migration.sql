-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAuthenticatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastIpAddress" TEXT,
    "lastUserAgent" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "refresh_tokens"
ADD COLUMN "sessionId" TEXT;

-- CreateIndex
CREATE INDEX "user_sessions_userId_idx" ON "user_sessions"("userId");
CREATE INDEX "user_sessions_tenantId_idx" ON "user_sessions"("tenantId");
CREATE INDEX "user_sessions_revokedAt_idx" ON "user_sessions"("revokedAt");
CREATE INDEX "user_sessions_lastActivityAt_idx" ON "user_sessions"("lastActivityAt");
CREATE INDEX "user_sessions_userId_revokedAt_idx" ON "user_sessions"("userId", "revokedAt");
CREATE INDEX "refresh_tokens_sessionId_idx" ON "refresh_tokens"("sessionId");

-- AddForeignKey
ALTER TABLE "refresh_tokens"
ADD CONSTRAINT "refresh_tokens_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "user_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_sessions"
ADD CONSTRAINT "user_sessions_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
