# Guia de Upload e Exibicao de Imagens (Multi-Tenant)

## Visao Geral

- **Upload**: Frontend → FormData → API Proxy (`/api/...`) → Controller → Valida Buffer → Salva em Disco (isolado por tenant)
- **Exibicao**: `<img src="...">` → Next.js Proxy → Backend → `res.sendFile` ou `useStaticAssets`

## Estrutura de Diretorios

Gerenciado por `PathsService` (`core/common/paths/paths.service.ts`), configurado via `UPLOADS_DIR` env.

```
uploads/
├── tenants/
│   └── {tenantId}/
│       ├── logos/                      # Logos do tenant
│       └── users/
│           └── {userId}/
│               └── avatar/            # Avatares de usuarios
├── platform/
│   └── logos/                         # Logo da plataforma
├── modules/
│   └── {slug}/                        # Uploads de modulos
├── temp/                              # Staging (secure-files, backups)
└── secure/                            # Arquivos com metadata no banco
```

## Controllers de Upload (Codigo Real)

### 1. Avatar de Usuario

**Arquivo**: `apps/backend/src/users/users.controller.ts`

```typescript
@Post('profile/avatar')
@UseInterceptors(FileInterceptor('avatar', createImageMulterOptions()))
async uploadAvatar(@UploadedFile() file: any, @Req() req) {
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

### 2. Logo do Tenant

**Arquivo**: `apps/backend/src/core/tenants/tenants.controller.ts`

```typescript
@Post('my-tenant/upload-logo')
@UseInterceptors(FileInterceptor('logo', multerConfig))
async uploadLogo(@UploadedFile() file: any) {
  // multerConfig salva automaticamente em tenants/{tenantId}/logos/
  // Validacao de magic numbers feita por validateFileSignature()
  return { url: `/api/tenants/public/${tenantId}/logo-file` };
}

@Post(':id/upload-logo')  // SUPER_ADMIN
@UseInterceptors(FileInterceptor('logo', multerConfig))
async uploadLogoById(@Param('id') tenantId: string, @UploadedFile() file: any) { }
```

### 3. Logo da Plataforma

**Arquivo**: `apps/backend/src/core/security-config/platform-config.controller.ts`

```typescript
@Post('logo')
@UseInterceptors(FileInterceptor('logo', createImageMulterOptions()))
async uploadLogo(@UploadedFile() file: any) {
  const upload = validateUploadedImageBuffer(file);
  // Salva em uploads/platform/logos/
  return { url: '/api/platform-config/logo-file' };
}
```

### 4. Arquivos Seguros

**Arquivo**: `apps/backend/src/core/secure-files/secure-files.controller.ts`

```typescript
@Post('upload')
@UseInterceptors(FileInterceptor('file', {
  storage: diskStorage({
    destination: 'uploads/temp/',
    filename: (req, file, cb) => cb(null, `${uuidv4()}_${sanitizedName}`)
  })
}))
async uploadSecureFile(@UploadedFile() file: any) {
  // Apos upload em temp/, move para uploads/secure/tenants/{tenantId}/modules/{slug}/{type}/
  // Tipos aceitos: JPEG, PNG, WebP, GIF, PDF, DOC, DOCX, XLS, XLSX
}
```

### 5. Upload de Modulos (ZIP)

**Arquivo**: `apps/backend/src/core/module-installer.controller.ts`

```typescript
@Post('upload')
@UseInterceptors(FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }  // 50MB
}))
async uploadModule(@UploadedFile() file: any) { }
```

### 6. Upload de Backups

**Arquivo**: `apps/backend/src/backup/backup.controller.ts`

```typescript
@Post('upload')
@UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
async uploadBackup(@UploadedFile() file: any) { }
```

## Servindo Arquivos

### Static Assets (main.ts)

```typescript
const logosPath = pathsService.getLogosDir();

// 4 prefixos para compatibilidade
app.useStaticAssets(logosPath, { prefix: '/logos', setHeaders: setLogosHeaders });
app.useStaticAssets(logosPath, { prefix: '/api/logos', setHeaders: setLogosHeaders });
app.useStaticAssets(logosPath, { prefix: '/uploads/logos', setHeaders: setLogosHeaders });
app.useStaticAssets(logosPath, { prefix: '/api/uploads/logos', setHeaders: setLogosHeaders });
```

Headers configurados:
- `Cache-Control: public, max-age=86400`
- `Cross-Origin-Resource-Policy: cross-origin`
- `Access-Control-Allow-Origin: *`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`

### Endpoints Publicos (res.sendFile)

```typescript
@Get('public/:id/avatar-file')
@Public()
async serveAvatar(@Param('id') userId: string, @Res() res: Response) {
  const avatarPath = pathsService.resolveTenantUserAvatarFilePath(tenantId, userId);
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.sendFile(avatarPath);
}
```

Endpoints publicos no core:
- `GET /api/users/public/:id/avatar-file` — Avatares
- `GET /api/tenants/public/:id/logo-file` — Logos de tenant
- `GET /api/platform-config/logo-file` — Logo da plataforma

### Proxy Frontend (next.config.js)

- `/api/*` → `NEXT_PUBLIC_API_URL/api/*`
- `/uploads/*` → `NEXT_PUBLIC_API_URL/uploads/*`

## Utilitarios Compartilhados

| Utilitario | Arquivo | Uso |
|-----------|---------|-----|
| `createImageMulterOptions()` | `core/common/utils/image-upload.util.ts` | Multer memoria (5MB padrao) |
| `validateUploadedImageBuffer()` | `core/common/utils/image-upload.util.ts` | Validacao magic numbers |
| `sanitizeOriginalImageName()` | `core/common/utils/image-upload.util.ts` | Sanitiza nome do arquivo |
| `multerConfig` | `core/common/config/multer.config.ts` | Multer disco (logos tenant) |
| `validateFileSignature()` | `core/common/config/multer.config.ts` | Validacao assinatura |
| `PathsService` | `core/common/paths/paths.service.ts` | Resolucao de caminhos |
| `sanitizeStorageSegment()` | `core/common/paths/paths.service.ts` | Valida segmentos de path |
| `@Public()` | `core/common/decorators/public.decorator.ts` | Endpoints sem auth |

## Seguranca

### Magic Numbers (validateUploadedImageBuffer)
- JPEG: `FF D8 FF`
- PNG: `89 50 4E 47`
- WebP: `RIFF....WEBP`
- GIF: `GIF87a` / `GIF89a`

### Path Traversal
- `sanitizeStorageSegment()` valida `^[a-zA-Z0-9._-]+$`
- Nomes unicos com UUID previnem colisoes
- `mode: 0o600` para avatares

### CORS (Static Assets)
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, OPTIONS`
- `Cross-Origin-Resource-Policy: cross-origin`

## Frontend — Exibicao

```tsx
<img
  src={user.avatarUrl || '/placeholder-avatar.png'}
  alt="Avatar"
  className="h-10 w-10 rounded-full"
  onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-avatar.png'; }}
/>

<img
  src={tenant.logoUrl || '/placeholder-logo.png'}
  alt="Logo"
  className="h-16"
/>
```
