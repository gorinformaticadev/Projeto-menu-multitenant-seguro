-- Migração para criar tabela de exemplo do módulo
-- Data: 2025-12-14
-- Versão: 1.0.0

CREATE TABLE IF NOT EXISTS module_exemplo_data (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    value DECIMAL(10,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tenant_id VARCHAR(36)
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_module_exemplo_tenant_id ON module_exemplo_data(tenant_id);
CREATE INDEX IF NOT EXISTS idx_module_exemplo_name ON module_exemplo_data(name);

-- Comentários sobre a tabela
COMMENT ON TABLE module_exemplo_data IS 'Tabela de dados do módulo exemplo completo';
COMMENT ON COLUMN module_exemplo_data.id IS 'ID único do registro';
COMMENT ON COLUMN module_exemplo_data.name IS 'Nome do item';
COMMENT ON COLUMN module_exemplo_data.description IS 'Descrição do item';
COMMENT ON COLUMN module_exemplo_data.value IS 'Valor numérico associado';
COMMENT ON COLUMN module_exemplo_data.is_active IS 'Status ativo/inativo';
COMMENT ON COLUMN module_exemplo_data.tenant_id IS 'ID do tenant (multitenant)';