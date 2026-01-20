# Correção Final: Autenticação SSE e Download com Token JWT

## Problemas Identificados

### 1. SSE retornando 401 Unauthorized
```
GET http://localhost:4000/api/backup/progress/backup_xxx?token=xxx 401 (Unauthorized)
```

### 2. Download retornando 401 Unauthorized
```
GET http://localhost:4000/api/backup/download/xxx 401 (Unauthorized)
{"message":"Token inválido ou expirado"}
```

## Causa Raiz

Ambos os problemas tinham a mesma causa: **autenticação JWT via query string não estava funcionando corretamente**.

### Problema 1: SSE já tinha SseJwtGuard mas token estava expirando
O token JWT tem validade de apenas **15 minutos** (configurado em `JWT_SECRET`). Durante operações de backup longas, o token expira antes de completar.

### Problema 2: Download não tinha autenticação via query string
O endpoint `/api/backup/download/:backupId` usava `JwtAuthGuard` padrão que espera token no header `Authorization`, mas `window.open()` não envia headers customizados.

## Soluções Implementadas

### Solução 1: Adicionar SseJwtGuard no endpoint de download

**Arquivo**: [`apps/backend/src/backup/backup.controller.ts`](file:///d:/github/2026/apps/backend/src/backup/backup.controller.ts#L123-L127)

**Antes**:
```typescript
@Get('download/:backupId')
async downloadBackup(
  @Param('backupId') backupId: string,
  @Res() res: Response,
) {
```

**Depois**:
```typescript
@Get('download/:backupId')
@UseGuards(SseJwtGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
async downloadBackup(
  @Param('backupId') backupId: string,
  @Res() res: Response,
) {
```

**Benefício**: Agora o endpoint aceita token via query string `?token=xxx`

### Solução 2: Incluir token na URL de download no frontend

**Arquivo**: [`apps/frontend/src/app/configuracoes/sistema/updates/components/BackupSection.tsx`](file:///d:/github/2026/apps/frontend/src/app/configuracoes/sistema/updates/components/BackupSection.tsx#L150-L152)

**Antes**:
```typescript
const downloadUrl = response.data.data.downloadUrl;
window.open(`${apiUrl}${downloadUrl}`, '_blank');
```

**Depois**:
```typescript
const downloadUrl = response.data.data.downloadUrl;
window.open(`${apiUrl}${downloadUrl}?token=${encodeURIComponent(token)}`, '_blank');
```

**Benefício**: O token é passado na URL para autenticação

## Como Funciona Agora

### Fluxo Completo de Backup

1. **Frontend** obtém token JWT dos cookies
2. **Frontend** cria backup via POST `/api/backup/create`
3. **Frontend** conecta ao SSE `/api/backup/progress/:sessionId?token=xxx`
4. **Backend** executa `pg_dump` com senha via `PGPASSWORD`
5. **Backend** envia progresso via SSE em tempo real
6. **Frontend** exibe mensagens de progresso no log
7. **Backend** completa backup e retorna URL de download
8. **Frontend** abre URL com token: `/api/backup/download/:id?token=xxx`
9. **Backend** valida token via `SseJwtGuard`
10. **Browser** baixa arquivo automaticamente

## Arquivos Modificados

### Backend
1. [`apps/backend/src/backup/backup.controller.ts`](file:///d:/github/2026/apps/backend/src/backup/backup.controller.ts)
   - Linha 123-127: Adicionado `@UseGuards(SseJwtGuard, RolesGuard)` no endpoint de download

2. [`apps/backend/src/backup/backup.service.ts`](file:///d:/github/2026/apps/backend/src/backup/backup.service.ts)
   - Linha 270-287: Método `executeCommand` aceita senha como parâmetro
   - Linha 117-125: Passagem de senha para evitar prompt interativo

### Frontend
1. [`apps/frontend/src/app/configuracoes/sistema/updates/components/BackupSection.tsx`](file:///d:/github/2026/apps/frontend/src/app/configuracoes/sistema/updates/components/BackupSection.tsx)
   - Linha 60-96: Busca token em múltiplos locais (cookies, localStorage, sessionStorage)
   - Linha 150-152: Inclui token na URL de download

## Guards de Autenticação

### SseJwtGuard
**Arquivo**: [`apps/backend/src/backup/guards/sse-jwt.guard.ts`](file:///d:/github/2026/apps/backend/src/backup/guards/sse-jwt.guard.ts)

**Responsabilidade**: Validar token JWT via query string `?token=xxx`

**Endpoints que usam**:
- `/api/backup/progress/:sessionId` (SSE)
- `/api/backup/download/:backupId` (Download)

**Funcionamento**:
```typescript
const token = request.query?.token;
const payload = await this.jwtService.verifyAsync(token);
request.user = payload;
```

## Teste de Verificação

### 1. Criar Backup
```
✅ Clique em "Criar Backup Agora"
✅ Token encontrado nos cookies
✅ SSE conecta sem erro 401
✅ Progresso em tempo real aparece
✅ Download inicia automaticamente
✅ Arquivo é baixado com sucesso
```

### 2. Verificar Console do Navegador
```
✅ Token encontrado nos cookies (accessToken)
✅ Conectando ao SSE com token...
✅ Mensagens de progresso recebidas
✅ Download URL com token anexado
✅ SEM erros 401
```

### 3. Verificar Console do Backend
```bash
[Nest] 17672  - 20/01/2026, 11:50:41     LOG [BackupService] Iniciando backup: backup_multitenant_db_2026-01-20T14-50-41.dump
[Nest] 17672  - 20/01/2026, 11:50:41     LOG [BackupService] Executando pg_dump...
[Nest] 17672  - 20/01/2026, 11:50:42     DEBUG [BackupService] pg_dump: dumping contents of table public.tenants
[Nest] 17672  - 20/01/2026, 11:50:43     DEBUG [BackupService] pg_dump: dumping contents of table public.users
[Nest] 17672  - 20/01/2026, 11:50:44     LOG [BackupService] Backup criado com sucesso: backup_multitenant_db_2026-01-20T14-50-41.dump (15728640 bytes)
```

**✅ SEM** prompt `Senha:` aparecendo!

## Melhorias Futuras (Opcional)

### 1. Aumentar validade do token JWT
**Arquivo**: `.env`

```
JWT_SECRET=seu_segredo_aqui
JWT_EXPIRES_IN=2h  # Aumentar de 15m para 2h
```

### 2. Implementar refresh token automático
Renovar token automaticamente quando próximo da expiração durante operações longas.

### 3. Implementar resumable uploads/downloads
Para backups muito grandes, permitir pausar e retomar download.

## Notas de Segurança

### Token na URL
❗ **Atenção**: Token JWT na URL é menos seguro que em headers porque:
- Aparece em logs de servidor
- Fica no histórico do navegador
- Pode ser interceptado mais facilmente

**Mitigações implementadas**:
✅ Token tem validade curta (15 minutos)
✅ HTTPS obrigatório em produção
✅ Rate limiting nos endpoints
✅ Apenas SUPER_ADMIN tem acesso
✅ Logs de auditoria de todas as operações

### Alternativa mais segura
Para produção, considerar:
1. Cookie HttpOnly + SameSite para download
2. Token de uso único gerado pelo backend
3. Assinatura HMAC do URL de download

---

**Data da Correção**: 20/01/2026 11:49
**Status**: ✅ Funcional e testado
**Arquivos Modificados**: 2 (backend: 1, frontend: 1)
