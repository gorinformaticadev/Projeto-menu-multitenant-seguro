-- Migration: Add SecureFile table for sensitive file uploads
-- Created: 2025-12-19

CREATE TABLE IF NOT EXISTS "secure_files" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "moduleName" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "storedName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" BIGINT NOT NULL,
  "uploadedBy" TEXT NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastAccessedAt" TIMESTAMP(3),
  "accessCount" INTEGER NOT NULL DEFAULT 0,
  "deletedAt" TIMESTAMP(3),
  "metadata" TEXT,

  CONSTRAINT "secure_files_pkey" PRIMARY KEY ("id")
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "secure_files_tenantId_idx" ON "secure_files"("tenantId");
CREATE INDEX IF NOT EXISTS "secure_files_moduleName_idx" ON "secure_files"("moduleName");
CREATE INDEX IF NOT EXISTS "secure_files_uploadedBy_idx" ON "secure_files"("uploadedBy");
CREATE INDEX IF NOT EXISTS "secure_files_documentType_idx" ON "secure_files"("documentType");
CREATE INDEX IF NOT EXISTS "secure_files_tenantId_moduleName_documentType_idx" ON "secure_files"("tenantId", "moduleName", "documentType");
CREATE INDEX IF NOT EXISTS "secure_files_deletedAt_idx" ON "secure_files"("deletedAt");

-- Add comments for documentation
COMMENT ON TABLE "secure_files" IS 'Tabela de arquivos sensíveis com isolamento multi-tenant';
COMMENT ON COLUMN "secure_files"."tenantId" IS 'ID do tenant proprietário';
COMMENT ON COLUMN "secure_files"."moduleName" IS 'Slug do módulo que fez upload';
COMMENT ON COLUMN "secure_files"."documentType" IS 'Tipo de documento (categoria)';
COMMENT ON COLUMN "secure_files"."originalName" IS 'Nome original do arquivo (sanitizado)';
COMMENT ON COLUMN "secure_files"."storedName" IS 'Nome do arquivo no filesystem (UUID + extensão)';
COMMENT ON COLUMN "secure_files"."mimeType" IS 'Tipo MIME validado';
COMMENT ON COLUMN "secure_files"."sizeBytes" IS 'Tamanho do arquivo em bytes';
COMMENT ON COLUMN "secure_files"."uploadedBy" IS 'ID do usuário que fez upload';
COMMENT ON COLUMN "secure_files"."lastAccessedAt" IS 'Última vez que foi acessado';
COMMENT ON COLUMN "secure_files"."accessCount" IS 'Contador de acessos';
COMMENT ON COLUMN "secure_files"."deletedAt" IS 'Data de soft delete';
COMMENT ON COLUMN "secure_files"."metadata" IS 'Metadados adicionais em JSON';
