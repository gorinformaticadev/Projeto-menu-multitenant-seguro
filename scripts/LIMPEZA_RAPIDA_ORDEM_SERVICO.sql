-- ═══════════════════════════════════════════════════════════════════════════
-- LIMPEZA RÁPIDA - MÓDULO ORDEM DE SERVIÇO
-- Execute este script no seu cliente de banco de dados (pgAdmin, DBeaver, etc.)
-- ═══════════════════════════════════════════════════════════════════════════

-- REMOVER TODAS AS TABELAS DO MÓDULO (CASCADE remove dependências)
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

-- REMOVER FUNÇÕES E TRIGGERS
DROP FUNCTION IF EXISTS update_mod_ordem_servico_ordens_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_mod_ordem_servico_user_roles_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_mod_ordem_servico_tipos_servico_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_mod_ordem_servico_tipos_equipamento_updated_at() CASCADE;

-- LIMPAR REGISTROS DE MIGRATIONS (ajuste o nome da tabela conforme seu sistema)
-- Se usar Prisma:
DELETE FROM "ModuleMigration" WHERE "moduleId" IN (SELECT id FROM "Module" WHERE slug = 'ordem_servico');

-- Se usar outro sistema de migrations:
-- DELETE FROM module_migrations WHERE module_id IN (SELECT id FROM modules WHERE slug = 'ordem_servico');

-- VERIFICAR SE LIMPEZA FOI COMPLETA
SELECT 'Tabelas restantes do módulo:' as status;
SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'mod_ordem_servico_%';

-- Se a query acima não retornar nenhuma linha, a limpeza foi bem-sucedida!