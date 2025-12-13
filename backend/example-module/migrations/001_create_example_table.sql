-- Migração de exemplo para o módulo
-- Esta migração cria uma tabela de exemplo

CREATE TABLE IF NOT EXISTS "example_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tenantId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "example_items_pkey" PRIMARY KEY ("id")
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS "example_items_tenantId_idx" ON "example_items"("tenantId");
CREATE INDEX IF NOT EXISTS "example_items_isActive_idx" ON "example_items"("isActive");

-- Chave estrangeira para tenant (se a tabela tenants existir)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants') THEN
        ALTER TABLE "example_items" 
        ADD CONSTRAINT "example_items_tenantId_fkey" 
        FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;