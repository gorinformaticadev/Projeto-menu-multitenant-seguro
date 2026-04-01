-- Aumenta o rate limit padrao de update para reduzir bloqueios operacionais
-- em fluxos administrativos legitimos sem afetar overrides personalizados.

ALTER TABLE "security_config"
ALTER COLUMN "updateRateLimitPerHour" SET DEFAULT 5;

UPDATE "security_config"
SET "updateRateLimitPerHour" = 5
WHERE "updateRateLimitPerHour" = 2;
