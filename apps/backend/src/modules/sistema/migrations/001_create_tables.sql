-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: Criação das tabelas do módulo sistema
-- Versão: 1.0.0
-- Data: 2025-12-17
-- ═══════════════════════════════════════════════════════════════════════════

-- Tabela de configurações do sistema
CREATE TABLE IF NOT EXISTS mod_sistema_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    key VARCHAR(255) NOT NULL,
    value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Foreign Key para tabela tenants
    CONSTRAINT fk_mod_sistema_configs_tenant FOREIGN KEY (tenant_id)
        REFERENCES tenants(id) ON DELETE CASCADE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_mod_sistema_configs_tenant_id ON mod_sistema_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mod_sistema_configs_key ON mod_sistema_configs(key);