-- ═══════════════════════════════════════════════════════════════════════════
-- SCRIPT DE LIMPEZA COMPLETA DO MÓDULO ORDEM DE SERVIÇO
-- Versão: 1.0.0
-- Data: 2026-01-10
-- Descrição: Remove todas as tabelas e dados do módulo ordem_servico
-- ═══════════════════════════════════════════════════════════════════════════

-- ATENÇÃO: Este script remove TODOS os dados do módulo ordem_servico
-- Execute apenas se tiver certeza de que deseja limpar tudo

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. REMOVER TRIGGERS E FUNÇÕES
-- ═══════════════════════════════════════════════════════════════════════════

-- Remover triggers
DROP TRIGGER IF EXISTS update_mod_ordem_servico_ordens_updated_at ON mod_ordem_servico_ordens;
DROP TRIGGER IF EXISTS trigger_mod_ordem_servico_ordens_updated_at ON mod_ordem_servico_ordens;
DROP TRIGGER IF EXISTS trigger_mod_ordem_servico_user_roles_updated_at ON mod_ordem_servico_user_roles;
DROP TRIGGER IF EXISTS trigger_mod_ordem_servico_tipos_servico_updated_at ON mod_ordem_servico_tipos_servico;
DROP TRIGGER IF EXISTS trigger_mod_ordem_servico_tipos_equipamento_updated_at ON mod_ordem_servico_tipos_equipamento;

-- Remover funções
DROP FUNCTION IF EXISTS update_mod_ordem_servico_ordens_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_mod_ordem_servico_user_roles_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_mod_ordem_servico_tipos_servico_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_mod_ordem_servico_tipos_equipamento_updated_at() CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. REMOVER TABELAS (EM ORDEM REVERSA DE DEPENDÊNCIA)
-- ═══════════════════════════════════════════════════════════════════════════

-- Remover tabelas que dependem de outras tabelas primeiro
DROP TABLE IF EXISTS mod_ordem_servico_historico CASCADE;
DROP TABLE IF EXISTS mod_ordem_servico_ordens CASCADE;
DROP TABLE IF EXISTS mod_ordem_servico_template_permissions CASCADE;
DROP TABLE IF EXISTS mod_ordem_servico_profile_templates CASCADE;
DROP TABLE IF EXISTS mod_ordem_servico_permission_audit CASCADE;
DROP TABLE IF EXISTS mod_ordem_servico_profile_permissions CASCADE;
DROP TABLE IF EXISTS mod_ordem_servico_user_permissions CASCADE;
DROP TABLE IF EXISTS mod_ordem_servico_user_roles CASCADE;
DROP TABLE IF EXISTS mod_ordem_servico_tipos_equipamento CASCADE;
DROP TABLE IF EXISTS mod_ordem_servico_tipos_servico CASCADE;
DROP TABLE IF EXISTS mod_ordem_servico_staff CASCADE;
DROP TABLE IF EXISTS mod_ordem_servico_products CASCADE;
DROP TABLE IF EXISTS mod_ordem_servico_clients CASCADE;
DROP TABLE IF EXISTS mod_ordem_servico_notification_schedules CASCADE;
DROP TABLE IF EXISTS mod_ordem_servico_configs CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. LIMPAR REGISTROS DE MIGRATIONS DO MÓDULO
-- ═══════════════════════════════════════════════════════════════════════════

-- Remover registros de migrations do módulo ordem_servico
DELETE FROM module_migrations 
WHERE module_id IN (
    SELECT id FROM modules WHERE slug = 'ordem_servico'
);

-- Remover registros de migrations do prisma (se existir)
DELETE FROM "ModuleMigration" 
WHERE "moduleId" IN (
    SELECT id FROM "Module" WHERE slug = 'ordem_servico'
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. VERIFICAÇÃO FINAL
-- ═══════════════════════════════════════════════════════════════════════════

-- Verificar se todas as tabelas foram removidas
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name LIKE 'mod_ordem_servico_%'
ORDER BY table_name;

-- Se a query acima retornar alguma linha, significa que ainda há tabelas do módulo

-- ═══════════════════════════════════════════════════════════════════════════
-- LIMPEZA COMPLETA FINALIZADA
-- ═══════════════════════════════════════════════════════════════════════════

-- Após executar este script:
-- 1. Execute o migrate do sistema principal (se necessário)
-- 2. Execute o botão de migrations/seeds do módulo ordem_servico
-- 3. A migration 001_master.sql será executada em um banco limpo