-- Atualizar valores padrão de rate limiting para serem mais permissivos
-- Isso evita bloqueios acidentais em aplicações modernas com SPAs

-- Atualizar configurações existentes
UPDATE "SecurityConfig" 
SET 
  "globalMaxRequests" = 10000,
  "rateLimitDevEnabled" = false,
  "rateLimitProdEnabled" = false,
  "rateLimitDevRequests" = 10000,
  "rateLimitProdRequests" = 10000
WHERE "globalMaxRequests" < 10000;

-- Nota: Os valores padrão no schema já foram atualizados para novas instalações
