# Guia de Integração - Uploads Sensíveis Multi-Tenant

## 📋 Visão Geral

Sistema de upload e acesso seguro a arquivos sensíveis (documentos pessoais, imagens, comprovantes) com isolamento por tenant, módulo e tipo de documento.

## 🔐 Características

- ✅ **Isolamento Multi-Tenant**: Arquivos separados por tenant, módulo e tipo de documento
- ✅ **Segurança Total**: Nenhum arquivo acessível sem autenticação JWT
- ✅ **Streaming Controlado**: Download via endpoint autenticado
- ✅ **Auditoria Completa**: Registro de uploads e acessos
- ✅ **Validação de Assinatura**: Magic numbers para validar tipo real do arquivo
- ✅ **Docker-Ready**: Paths dinâmicos preparados para containers

## 🏗️ Arquitetura de Diretórios

```
backend/uploads/secure/tenants/
└── {tenantId}/
    └── modules/
        └── {moduleName}/
            └── {documentType}/
                └── {generatedFileName}
```

### Exemplo Prático

```
backend/uploads/secure/tenants/
├── abc-123-tenant-id/
│   └── modules/
│       ├── cadastro-pessoas/
│       │   ├── documentos-pessoais/
│       │   │   └── 9f3a2c8e-uuid.pdf
│       │   └── imagens-documentos/
│       │       └── e5f6g7h8-uuid.png
│       └── contratos/
│           └── comprovantes/
│               └── m3n4o5p6-uuid.pdf
```

## 🔌 Endpoints Disponíveis

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| `POST` | `/secure-files/upload` | Upload de arquivo sensível | JWT Required |
| `GET` | `/secure-files/:fileId` | Download/streaming de arquivo | JWT + Ownership |
| `GET` | `/secure-files/:fileId/metadata` | Obter metadata do arquivo | JWT + Ownership |
| `DELETE` | `/secure-files/:fileId` | Soft delete de arquivo | JWT + Ownership |
| `GET` | `/secure-files` | Listar arquivos do tenant | JWT Required |

## 💻 Integração no Backend (Módulos)

### 1. Importar SecureFilesModule

```typescript
// seu-modulo.module.ts
import { Module } from '@nestjs/common';
import { SecureFilesModule } from '@core/secure-files/secure-files.module';

@Module({
  imports: [SecureFilesModule],
  // ...
})
export class SeuModuloModule {}
```

### 2. Injetar SecureFilesService

```typescript
// seu-modulo.controller.ts
import { Injectable } from '@nestjs/common';
import { SecureFilesService } from '@core/secure-files/secure-files.service';

@Injectable()
export class SeuModuloService {
  constructor(
    private readonly secureFilesService: SecureFilesService,
  ) {}
}
```

### 3. Upload de Arquivo

```typescript
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadedFile } from '@nestjs/common';

@Post('upload-documento')
@UseInterceptors(FileInterceptor('file'))
async uploadDocumento(
  @UploadedFile() file: Express.Multer.File,
  @Req() req: any,
) {
  const result = await this.secureFilesService.uploadFile(
    file,
    req.user.tenantId, // Extraído do JWT
    'cadastro-pessoas', // Nome do seu módulo
    'documentos-pessoais', // Tipo de documento
    req.user.id, // ID do usuário que fez upload
    JSON.stringify({ observacao: 'Documento de identidade' }), // Metadata opcional
  );

  // Salvar apenas o fileId na sua entidade
  await this.prisma.pessoa.update({
    where: { id: pessoaId },
    data: { documentoFileId: result.fileId },
  });

  return result;
}
```

### 4. Listar Arquivos do Módulo

```typescript
@Get('documentos')
async listarDocumentos(@Req() req: any) {
  return await this.secureFilesService.listFiles(
    req.user.tenantId,
    'cadastro-pessoas', // Filtrar por módulo
    'documentos-pessoais', // Filtrar por tipo (opcional)
  );
}
```

## 🌐 Integração no Frontend

### 1. Upload de Arquivo

```typescript
// Componente React/Next.js
const handleUpload = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('moduleName', 'cadastro-pessoas');
  formData.append('documentType', 'documentos-pessoais');

  try {
    const response = await fetch('/api/secure-files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    const result = await response.json();
    console.log('Arquivo uploaded:', result.fileId);
    
    // Armazenar fileId no estado
    setFileId(result.fileId);
  } catch (error) {
    console.error('Erro no upload:', error);
  }
};
```

### 2. Exibir Imagem Sensível

```tsx
import { useEffect, useState } from 'react';

interface SecureImageProps {
  fileId: string;
  alt: string;
}

export function SecureImage({ fileId, alt }: SecureImageProps) {
  const [imageUrl, setImageUrl] = useState<string>('');

  useEffect(() => {
    if (!fileId) return;

    let objectUrl: string;

    const fetchImage = async () => {
      try {
        const response = await fetch(`/api/secure-files/${fileId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) throw new Error('Erro ao carregar imagem');

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      } catch (error) {
        console.error('Erro ao carregar imagem:', error);
      }
    };

    fetchImage();

    // Cleanup: revogar ObjectURL ao desmontar
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [fileId]);

  if (!imageUrl) return <div>Carregando imagem...</div>;

  return <img src={imageUrl} alt={alt} />;
}
```

### 3. Download de Documento

```typescript
const handleDownload = async (fileId: string, originalName: string) => {
  try {
    const response = await fetch(`/api/secure-files/${fileId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) throw new Error('Erro ao baixar arquivo');

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    
    // Criar link temporário e simular click
    const link = document.createElement('a');
    link.href = url;
    link.download = originalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Revogar ObjectURL
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Erro no download:', error);
  }
};
```

## 📝 Tipos de Documento Recomendados

| Módulo | documentType | Descrição |
|--------|--------------|-----------|
| cadastro-pessoas | `documentos-pessoais` | CPF, RG, CNH |
| cadastro-pessoas | `imagens-documentos` | Foto de documentos |
| cadastro-pessoas | `comprovantes-residencia` | Contas de água, luz |
| contratos | `contratos-assinados` | PDFs de contratos |
| contratos | `anexos-contratuais` | Documentos anexos |
| financeiro | `notas-fiscais` | XML e PDF de NF-e |
| financeiro | `comprovantes-pagamento` | Recibos e transferências |

## ⚙️ Configuração

### Variáveis de Ambiente (.env)

```env
# Diretório raiz de uploads
UPLOADS_ROOT="uploads"

# Diretório de arquivos sensíveis
SECURE_UPLOADS_DIR="uploads/secure"

# Tamanho máximo de arquivo em bytes (10MB)
MAX_SECURE_FILE_SIZE="10485760"

# Tipos MIME permitidos (separados por vírgula)
ALLOWED_SECURE_MIME_TYPES="image/jpeg,image/png,image/webp,image/gif,application/pdf"
```

## 🔒 Regras de Segurança

### ❌ NUNCA fazer

- ❌ Expor pasta `/uploads/secure` como static
- ❌ Retornar path absoluto do arquivo ao frontend
- ❌ Usar nome original do arquivo no filesystem
- ❌ Permitir acesso cross-tenant
- ❌ Salvar URL pública do arquivo no banco

### ✅ SEMPRE fazer

- ✅ Validar JWT em todos os acessos
- ✅ Verificar tenant ownership
- ✅ Usar fileId para referenciar arquivos
- ✅ Sanitizar nomes de arquivo
- ✅ Validar assinatura de arquivo (magic numbers)
- ✅ Registrar acessos em auditoria

## 🐳 Docker

### Volume Mapping

```yaml
# docker-compose.yml
services:
  backend:
    volumes:
      - ./uploads:/app/uploads
```

**Benefícios:**
- Persistência de arquivos fora do container
- Backup facilitado
- Migração simplificada

## 📊 Auditoria

Eventos registrados automaticamente na tabela `audit_logs`:

| Evento | Action | Dados Registrados |
|--------|--------|-------------------|
| Upload | `SECURE_FILE_UPLOADED` | fileId, moduleName, documentType, sizeBytes |
| Acesso | `SECURE_FILE_ACCESSED` | fileId, moduleName, documentType |
| Exclusão | `SECURE_FILE_DELETED` | fileId, moduleName, documentType |

## 🧪 Testando

### Upload via cURL

```bash
curl -X POST http://localhost:4000/secure-files/upload \
  -H "Authorization: Bearer SEU_TOKEN_JWT" \
  -F "file=@/path/to/documento.pdf" \
  -F "moduleName=cadastro-pessoas" \
  -F "documentType=documentos-pessoais"
```

### Download via cURL

```bash
curl -X GET http://localhost:4000/secure-files/{FILE_ID} \
  -H "Authorization: Bearer SEU_TOKEN_JWT" \
  -o arquivo_baixado.pdf
```

### Listar Arquivos

```bash
curl -X GET "http://localhost:4000/secure-files?moduleName=cadastro-pessoas" \
  -H "Authorization: Bearer SEU_TOKEN_JWT"
```

## ❓ FAQ

**P: Como migrar arquivos públicos antigos para o sistema seguro?**  
R: Crie um script de migração que:
1. Lista arquivos públicos
2. Registra no banco usando `prisma.secureFile.create()`
3. Move arquivo para estrutura segura
4. Atualiza referências nas entidades

**P: Posso usar CDN para distribuir arquivos sensíveis?**  
R: Não recomendado. Arquivos sensíveis devem sempre passar por autenticação. Para CDN, use apenas arquivos públicos (logos, assets).

**P: Como fazer backup dos arquivos?**  
R: Faça backup da pasta `uploads/secure` completa. Em Docker, o volume mapeado facilita backups regulares.

**P: O que acontece se deletar um arquivo?**  
R: É um soft delete. O arquivo permanece no filesystem e pode ser restaurado. Um job noturno remove fisicamente arquivos deletados há mais de 30 dias.

## 📚 Recursos Adicionais

- [Prisma Schema - SecureFile](../backend/prisma/schema.prisma)
- [Configuração Multer](../backend/src/core/secure-files/config/secure-multer.config.ts)
- [Guards de Segurança](../backend/src/core/secure-files/guards/)

---

**Desenvolvido por GOR Informática**  
📞 WhatsApp: (61) 3359-7358  
🌐 www.gorinformatica.com.br
