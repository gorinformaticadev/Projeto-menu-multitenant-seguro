# Guia de Upload e Exibicao de Imagens (Multi-Tenant)

Este guia documenta o padrao atual para upload, armazenamento seguro e exibicao de imagens no sistema Pluggor.

## Visao Geral da Arquitetura

- **Fluxo de Upload**: Frontend envia FormData → API Proxy (`/api/...`) → Controller Backend → Valida Buffer → Salva em Disco (Tenant-Isolated)
- **Fluxo de Exibicao**: Frontend (`<img src="...">`) → Next.js Proxy (`/api/...` ou `/uploads/...`) → Backend Endpoint → `res.sendFile` ou `useStaticAssets`

## Estrutura de Diretorios de Upload

O diretorio raiz e gerenciado por `PathsService` e configurado via env `UPLOADS_DIR`.

```
uploads/
├── tenants/
│   └── {tenantId}/
│       ├── logos/                        # Logos do tenant
│       └── users/
│           └── {userId}/
│               └── avatar/              # Avatares de usuarios
├── platform/
│   └── logos/                           # Logo da plataforma
├── modules/
│   └── {slug}/                          # Uploads de modulos
├── temp/                                # Staging temporario
└── secure/                              # Arquivos seguros (com metadata no banco)
    └── tenants/
        └── {tenantId}/
            └── modules/
                └── {moduleName}/
                    └── {documentType}/
```

## Padroes de Upload por Tipo

### 1. Imagens em Memoria (Avatares, Logos de Plataforma)

Usar `createImageMulterOptions()` + `validateUploadedImageBuffer()`:

```typescript
import { createImageMulterOptions, validateUploadedImageBuffer } from '@/core/common/utils/image-upload.util';

@Post('avatar')
@UseInterceptors(FileInterceptor('file', createImageMulterOptions()))
async uploadAvatar(@UploadedFile() file: any) {
  const upload = validateUploadedImageBuffer(file);

  const avatarDir = path.join(
    process.cwd(), 'uploads', 'tenants',
    tenantId, 'users', userId, 'avatar'
  );
  fs.mkdirSync(avatarDir, { recursive: true });

  const avatarPath = path.join(avatarDir, `avatar.${upload.extension}`);
  fs.writeFileSync(avatarPath, upload.buffer, { mode: 0o600 });

  return { url: `/api/users/public/${userId}/avatar-file` };
}
```

### 2. Imagens em Disco (Logos de Tenant)

Usar `multerConfig` com disk storage:

```typescript
import { multerConfig } from '@/core/common/config/multer.config';

@Post('logo')
@UseInterceptors(FileInterceptor('file', multerConfig))
async uploadLogo(@UploadedFile() file: any) {
  // file ja foi salvo pelo multer no diretorio correto
  return { url: `/api/tenants/public/${tenantId}/logo-file` };
}
```

### 3. Arquivos de Modulo

Upload para diretorio isolado por modulo:

```typescript
const uploadDir = path.join(
  process.cwd(), 'uploads', 'modules',
  slug, resource, tenantId
);
fs.mkdirSync(uploadDir, { recursive: true });

const uniqueName = `${uuidv4()}_${sanitizedName}`;
fs.writeFileSync(path.join(uploadDir, uniqueName), bufferData);

return { url: `/api/${slug}/${resource}/uploads/${tenantId}/${uniqueName}` };
```

## Servindo Arquivos

### Endpoints Publicos (para `<img>` sem auth)

Usar `@Public()` decorator para endpoints de exibicao:

```typescript
import { Public } from '@/core/common/decorators/public.decorator';

@Get('public/:id/avatar-file')
@Public()
async serveAvatar(@Param('id') userId: string, @Res() res: Response) {
  const avatarPath = pathsService.resolveAvatarPath(userId);
  if (fs.existsSync(avatarPath)) {
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.sendFile(avatarPath);
  } else {
    res.status(404).json({ message: 'Avatar nao encontrado' });
  }
}
```

### Static Assets (Logos)

No `main.ts`, logos sao servidas como static assets:

```typescript
app.useStaticAssets(logosPath, { prefix: '/logos' });
app.useStaticAssets(logosPath, { prefix: '/api/logos' });
```

Com headers: `Cache-Control: public, max-age=86400`

### Proxy do Frontend (next.config.js)

O proxy reescreve URLs para o backend:

- `/api/*` → `NEXT_PUBLIC_API_URL/api/*`
- `/uploads/*` → `NEXT_PUBLIC_API_URL/uploads/*`

## Seguranca

### Validacao de Buffer (Magic Numbers)

`validateUploadedImageBuffer()` verifica assinaturas de arquivo:
- JPEG: `FF D8 FF`
- PNG: `89 50 4E 47`
- WebP: `RIFF....WEBP`
- GIF: `GIF87a` / `GIF89a`

### Protecao contra Path Traversal

- `validatePathSegment()` bloqueia `..`, `/`, `\`, `\0`
- `sanitizeStorageSegment()` valida `^[a-zA-Z0-9._-]+$`
- Nomes unicos com UUID previnem colisoes

### Permissoes de Arquivo

- Avatares: `mode: 0o600` (leitura/escrita apenas pelo owner)
- Cache: `max-age=300` (5 min) para avatares, `max-age=86400` (24h) para logos

## Frontend - Exibicao de Imagens

```tsx
// Avatar do usuario
<img
  src={user.avatarUrl || '/placeholder-avatar.png'}
  alt="Avatar"
  className="h-10 w-10 rounded-full"
  onError={(e) => e.currentTarget.src = '/placeholder-avatar.png'}
/>

// Logo do tenant
<img
  src={tenant.logoUrl || '/placeholder-logo.png'}
  alt="Logo"
  className="h-16"
/>
```

## Utilitarios Compartilhados

| Utilitario | Local | Uso |
|-----------|-------|-----|
| `createImageMulterOptions()` | `core/common/utils/image-upload.util.ts` | Config multer memoria |
| `validateUploadedImageBuffer()` | `core/common/utils/image-upload.util.ts` | Validacao de buffer |
| `multerConfig` | `core/common/config/multer.config.ts` | Config multer disco |
| `PathsService` | `core/common/paths/paths.service.ts` | Resolucao de caminhos |
| `@Public()` | `core/common/decorators/public.decorator.ts` | Endpoints sem auth |
