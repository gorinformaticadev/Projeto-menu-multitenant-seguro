ALTER TABLE "security_config"
ADD COLUMN "updateRateLimitWindowMinutes" INTEGER NOT NULL DEFAULT 60;
