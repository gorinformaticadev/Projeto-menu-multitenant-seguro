-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "isMasterTenant" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "secure_files" (
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

-- CreateIndex
CREATE INDEX "secure_files_tenantId_idx" ON "secure_files"("tenantId");

-- CreateIndex
CREATE INDEX "secure_files_moduleName_idx" ON "secure_files"("moduleName");

-- CreateIndex
CREATE INDEX "secure_files_uploadedBy_idx" ON "secure_files"("uploadedBy");

-- CreateIndex
CREATE INDEX "secure_files_documentType_idx" ON "secure_files"("documentType");

-- CreateIndex
CREATE INDEX "secure_files_tenantId_moduleName_documentType_idx" ON "secure_files"("tenantId", "moduleName", "documentType");

-- CreateIndex
CREATE INDEX "secure_files_deletedAt_idx" ON "secure_files"("deletedAt");

-- CreateIndex
CREATE INDEX "tenants_isMasterTenant_idx" ON "tenants"("isMasterTenant");
