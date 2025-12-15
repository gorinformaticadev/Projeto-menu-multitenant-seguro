-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: Criação das tabelas do módulo demo-completo
-- Versão: 1.0.0
-- Data: 2025-12-15
-- ═══════════════════════════════════════════════════════════════════════════

-- Tabela principal de demonstrações
CREATE TABLE IF NOT EXISTS demos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content TEXT,
    status VARCHAR(50) DEFAULT 'draft',
    priority INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    likes_count INTEGER DEFAULT 0,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    -- Índices
    CONSTRAINT fk_demos_tenant FOREIGN KEY (tenant_id) 
        REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_demos_created_by FOREIGN KEY (created_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_demos_updated_by FOREIGN KEY (updated_by) 
        REFERENCES users(id) ON DELETE SET NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_demos_tenant_id ON demos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_demos_status ON demos(status);
CREATE INDEX IF NOT EXISTS idx_demos_created_at ON demos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_demos_created_by ON demos(created_by);
CREATE INDEX IF NOT EXISTS idx_demos_deleted_at ON demos(deleted_at) WHERE deleted_at IS NULL;

-- Tabela de categorias
CREATE TABLE IF NOT EXISTS demo_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7), -- hex color
    icon VARCHAR(50),
    order_index INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT fk_demo_categories_tenant FOREIGN KEY (tenant_id) 
        REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT uq_demo_categories_slug UNIQUE (tenant_id, slug)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_demo_categories_tenant_id ON demo_categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_demo_categories_slug ON demo_categories(slug);
CREATE INDEX IF NOT EXISTS idx_demo_categories_is_active ON demo_categories(is_active);

-- Tabela de tags
CREATE TABLE IF NOT EXISTS demo_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(50) NOT NULL,
    slug VARCHAR(50) NOT NULL,
    color VARCHAR(7),
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT fk_demo_tags_tenant FOREIGN KEY (tenant_id) 
        REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT uq_demo_tags_slug UNIQUE (tenant_id, slug)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_demo_tags_tenant_id ON demo_tags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_demo_tags_slug ON demo_tags(slug);
CREATE INDEX IF NOT EXISTS idx_demo_tags_usage_count ON demo_tags(usage_count DESC);

-- Tabela de relacionamento demos <-> categories (many-to-many)
CREATE TABLE IF NOT EXISTS demo_category_relations (
    demo_id UUID NOT NULL,
    category_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (demo_id, category_id),
    CONSTRAINT fk_demo_cat_rel_demo FOREIGN KEY (demo_id) 
        REFERENCES demos(id) ON DELETE CASCADE,
    CONSTRAINT fk_demo_cat_rel_category FOREIGN KEY (category_id) 
        REFERENCES demo_categories(id) ON DELETE CASCADE
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_demo_cat_rel_demo_id ON demo_category_relations(demo_id);
CREATE INDEX IF NOT EXISTS idx_demo_cat_rel_category_id ON demo_category_relations(category_id);

-- Tabela de relacionamento demos <-> tags (many-to-many)
CREATE TABLE IF NOT EXISTS demo_tag_relations (
    demo_id UUID NOT NULL,
    tag_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (demo_id, tag_id),
    CONSTRAINT fk_demo_tag_rel_demo FOREIGN KEY (demo_id) 
        REFERENCES demos(id) ON DELETE CASCADE,
    CONSTRAINT fk_demo_tag_rel_tag FOREIGN KEY (tag_id) 
        REFERENCES demo_tags(id) ON DELETE CASCADE
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_demo_tag_rel_demo_id ON demo_tag_relations(demo_id);
CREATE INDEX IF NOT EXISTS idx_demo_tag_rel_tag_id ON demo_tag_relations(tag_id);

-- Tabela de anexos/arquivos
CREATE TABLE IF NOT EXISTS demo_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    demo_id UUID NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    thumbnail_path VARCHAR(500),
    uploaded_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_demo_attachments_demo FOREIGN KEY (demo_id) 
        REFERENCES demos(id) ON DELETE CASCADE,
    CONSTRAINT fk_demo_attachments_uploaded_by FOREIGN KEY (uploaded_by) 
        REFERENCES users(id) ON DELETE SET NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_demo_attachments_demo_id ON demo_attachments(demo_id);
CREATE INDEX IF NOT EXISTS idx_demo_attachments_mime_type ON demo_attachments(mime_type);

-- Tabela de comentários
CREATE TABLE IF NOT EXISTS demo_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    demo_id UUID NOT NULL,
    parent_id UUID, -- para respostas/threads
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    is_edited BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    CONSTRAINT fk_demo_comments_demo FOREIGN KEY (demo_id) 
        REFERENCES demos(id) ON DELETE CASCADE,
    CONSTRAINT fk_demo_comments_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_demo_comments_parent FOREIGN KEY (parent_id) 
        REFERENCES demo_comments(id) ON DELETE CASCADE
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_demo_comments_demo_id ON demo_comments(demo_id);
CREATE INDEX IF NOT EXISTS idx_demo_comments_user_id ON demo_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_demo_comments_parent_id ON demo_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_demo_comments_created_at ON demo_comments(created_at DESC);

-- Tabela de atividades/audit log
CREATE TABLE IF NOT EXISTS demo_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    demo_id UUID NOT NULL,
    user_id UUID,
    action VARCHAR(50) NOT NULL, -- created, updated, deleted, published, etc
    changes JSONB, -- detalhes das mudanças
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_demo_activities_demo FOREIGN KEY (demo_id) 
        REFERENCES demos(id) ON DELETE CASCADE,
    CONSTRAINT fk_demo_activities_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE SET NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_demo_activities_demo_id ON demo_activities(demo_id);
CREATE INDEX IF NOT EXISTS idx_demo_activities_user_id ON demo_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_demo_activities_action ON demo_activities(action);
CREATE INDEX IF NOT EXISTS idx_demo_activities_created_at ON demo_activities(created_at DESC);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_demo_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER demos_updated_at_trigger
    BEFORE UPDATE ON demos
    FOR EACH ROW
    EXECUTE FUNCTION update_demo_updated_at();

CREATE TRIGGER demo_categories_updated_at_trigger
    BEFORE UPDATE ON demo_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_demo_updated_at();

CREATE TRIGGER demo_comments_updated_at_trigger
    BEFORE UPDATE ON demo_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_demo_updated_at();

-- Comentários nas tabelas
COMMENT ON TABLE demos IS 'Tabela principal de demonstrações do módulo demo-completo';
COMMENT ON TABLE demo_categories IS 'Categorias para organização das demonstrações';
COMMENT ON TABLE demo_tags IS 'Tags para marcação e busca de demonstrações';
COMMENT ON TABLE demo_attachments IS 'Arquivos anexados às demonstrações';
COMMENT ON TABLE demo_comments IS 'Comentários nas demonstrações';
COMMENT ON TABLE demo_activities IS 'Log de atividades e auditoria';

-- Registro do módulo no sistema
INSERT INTO system_modules (slug, name, version, enabled, installed_at)
VALUES ('demo-completo', 'Demonstração Completa', '1.0.0', true, CURRENT_TIMESTAMP)
ON CONFLICT (slug) DO UPDATE SET
    version = EXCLUDED.version,
    updated_at = CURRENT_TIMESTAMP;
