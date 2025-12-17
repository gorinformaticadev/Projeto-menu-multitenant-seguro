-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: Criação das tabelas do módulo sistema
-- Versão: 1.0.0
-- Data: 2025-12-17
-- ═══════════════════════════════════════════════════════════════════════════

-- Tabela de configurações do sistema
CREATE TABLE IF NOT EXISTS sistema_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    key VARCHAR(255) NOT NULL,
    value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Índices
    CONSTRAINT fk_sistema_configs_tenant FOREIGN KEY (tenant_id)
        REFERENCES tenants(id) ON DELETE CASCADE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_sistema_configs_tenant_id ON sistema_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sistema_configs_key ON sistema_configs(key);