-- Migração para adicionar campo databaseVersion à tabela modules
-- Execute este script diretamente no banco PostgreSQL

-- Adicionar coluna databaseVersion
ALTER TABLE modules ADD COLUMN IF NOT EXISTS databaseVersion VARCHAR(50);

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_modules_database_version ON modules(databaseVersion);

-- Comentário sobre a coluna
COMMENT ON COLUMN modules.databaseVersion IS 'Versão do banco de dados aplicada para este módulo';

-- Verificar se foi criada com sucesso
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'modules' AND column_name = 'databaseVersion';