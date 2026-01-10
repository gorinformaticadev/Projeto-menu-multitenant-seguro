-- CreateTable
CREATE TABLE "blacklisted_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blacklisted_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blacklisted_tokens_token_key" ON "blacklisted_tokens"("token");

-- CreateIndex
CREATE INDEX "blacklisted_tokens_userId_idx" ON "blacklisted_tokens"("userId");

-- CreateIndex
CREATE INDEX "blacklisted_tokens_token_idx" ON "blacklisted_tokens"("token");

-- CreateIndex
CREATE INDEX "blacklisted_tokens_expiresAt_idx" ON "blacklisted_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "blacklisted_tokens_createdAt_idx" ON "blacklisted_tokens"("createdAt");

-- AddForeignKey
ALTER TABLE "blacklisted_tokens" ADD CONSTRAINT "blacklisted_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
