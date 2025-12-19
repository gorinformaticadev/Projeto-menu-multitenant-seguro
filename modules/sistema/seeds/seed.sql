-- SEED: Dados iniciais do módulo sistema

-- Configurações básicas
-- Insere configuração indicando que o módulo está habilitado
INSERT INTO sistema_configs (id, tenant_id, key, value)
SELECT
    gen_random_uuid(),
    t.id,
    'module_enabled',
    'true'
FROM tenants t WHERE t.ativo = true LIMIT 1;

-- Insere a versão atual do módulo
INSERT INTO sistema_configs (id, tenant_id, key, value)
SELECT
    gen_random_uuid(),
    t.id,
    'version',
    '1.0.1'
FROM tenants t WHERE t.ativo = true LIMIT 1;