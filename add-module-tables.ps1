# Script para adicionar tabelas do sistema de módulos ao schema.prisma

$schemaPath = ".\backend\prisma\schema.prisma"
$content = Get-Content $schemaPath -Raw -Encoding UTF8

# Adicionar as novas tabelas antes da última linha vazia
$newTables = @"

// ============================================
// SISTEMA DE MÓDULOS ROBUSTO - NOVAS TABELAS
// ============================================

// Tabela de Uploads de Módulos
model ModuleUpload {
  id                String    @id @default(uuid())
  slug              String    @unique
  name              String
  version           String
  description       String?
  author            String?
  category          String?
  enabled           Boolean   @default(false)
  validated         Boolean   @default(false)
  sandboxed         Boolean   @default(true)
  permissionsStrict Boolean   @default(true)
  uploadedAt        DateTime  @default(now())
  uploadedBy        String?
  filePath          String?
  fileHash          String?
  configJson        String?
  securityFlags     String?
  validationReport  String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  permissions       ModuleUploadPermission[]
  pages             ModuleUploadPage[]
  
  @@index([slug])
  @@index([enabled])
  @@index([validated])
  @@index([enabled, validated])
  @@index([uploadedBy])
  @@index([category])
  @@map("module_uploads")
}

model ModuleUploadPermission {
  id          String       @id @default(uuid())
  moduleId    String
  module      ModuleUpload @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  name        String
  description String
  category    String
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  
  @@unique([moduleId, name])
  @@index([moduleId])
  @@index([name])
  @@map("module_upload_permissions")
}

model ModuleUploadPage {
  id          String       @id @default(uuid())
  moduleId    String
  module      ModuleUpload @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  pageId      String
  path        String
  title       String?
  description String?
  component   String?
  protected   Boolean      @default(true)
  permissions String?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  
  @@unique([moduleId, pageId])
  @@index([moduleId])
  @@index([path])
  @@map("module_upload_pages")
}
"@

# Adicionar ao final do arquivo
$content = $content.TrimEnd()
$content += $newTables

# Salvar
Set-Content -Path $schemaPath -Value $content -Encoding UTF8 -NoNewline

Write-Host "Tabelas adicionadas com sucesso!"
