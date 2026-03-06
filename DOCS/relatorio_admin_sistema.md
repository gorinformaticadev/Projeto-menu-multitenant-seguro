# Relatorio Administrativo - Update/Rollback Atomico + Observabilidade via Painel

## Escopo aplicado

Foi consolidado o contrato de update nativo com foco em:

- fluxo atomico `releases/current/shared`
- estado de update rastreavel para a UI
- logs persistentes para acompanhamento em tempo real
- lock concorrente com erro padronizado
- rollback automatico e rollback manual via endpoint admin

## Estrutura de deploy (nativo)

- `BASE_DIR/releases/<version>`: codigo por release (imutavel)
- `BASE_DIR/shared`: estado persistente
- `BASE_DIR/current`: symlink da release ativa
- `BASE_DIR/previous`: symlink da release anterior

Dados persistentes em `shared`:

- `shared/.env`
- `shared/uploads`
- `shared/backups`
- `shared/logs/update.log`
- `shared/update-state.json`
- `shared/locks/update.lock`

## Script principal

Arquivo: `install/update-native.sh`

### Garantias principais

- lock via `flock` em `shared/locks/update.lock`
- backup obrigatorio pre-swap
- swap atomico de `current`
- healthcheck pos-swap
- rollback automatico em falha de healthcheck
- retencao de releases

### Arquivo de estado (fonte de verdade)

Path:

- `${APP_BASE_DIR}/shared/update-state.json`

Contrato:

```json
{
  "status": "idle|running|success|failed|rolled_back",
  "startedAt": "ISO|null",
  "finishedAt": "ISO|null",
  "fromVersion": "vX|unknown",
  "toVersion": "vY|unknown",
  "step": "string",
  "progress": 0,
  "lock": false,
  "lastError": "string|null",
  "rollback": {
    "attempted": false,
    "completed": false,
    "reason": "string|null"
  }
}
```

Observacoes:

- JSON sempre valido (escrita atomica com arquivo temporario + rename).
- update em execucao fica com `status=running` e `lock=true`.
- sucesso seta `status=success`.
- falha com rollback automatico bem-sucedido seta `status=rolled_back`.

### Log persistente

Path:

- `${APP_BASE_DIR}/shared/logs/update.log`

Formato:

- `[ISO_TIMESTAMP] [step] mensagem`

Rotacao:

- limite de 5MB por arquivo
- mantem ate 10 arquivos (`update.log`, `update.log.1`, ...)

### Exit codes padronizados

- `0`: success
- `10`: lock already held
- `20`: backup failed
- `30`: download/checkout failed
- `40`: build/migrations failed
- `50`: healthcheck failed + rollback succeeded
- `60`: healthcheck failed + rollback failed

## Endpoints admin do painel

Protecao:

- `JwtAuthGuard + RolesGuard`
- apenas `ADMIN` e `SUPER_ADMIN`

Rotas:

- `POST /api/system/update/run`
  - inicia update assincrono (retorna `operationId`)
  - bloqueia `--legacy-inplace` por default (libera apenas com `UPDATE_ALLOW_LEGACY_INPLACE_API=true`)
- `GET /api/system/update/status`
  - retorna `update-state.json` + metadados de operacao ativa
- `GET /api/system/update/log?tail=200`
  - retorna ultimas N linhas de `shared/logs/update.log` (1..2000)
- `POST /api/system/update/rollback`
  - executa `install/rollback-native.sh` (assincrono, com `operationId`)
- `GET /api/system/update/releases`
  - lista releases e indica `current/previous`

Contrato de concorrencia:

- se houver operacao em andamento, retorna `409 Conflict` com estado atual.

## Execucao via backend

Servico: `SystemUpdateAdminService`

Padrao de execucao:

- `spawn('bash', [script, ...args])`
- `cwd = APP_BASE_DIR`
- env herdado +:
  - `APP_BASE_DIR`
  - `UPLOADS_DIR=${APP_BASE_DIR}/shared/uploads`
  - `BACKUP_DIR=${APP_BASE_DIR}/shared/backups`

Observabilidade:

- stdout/stderr do processo sao registrados no logger do backend
- rollback manual tambem atualiza `update-state.json`
- rollback manual tambem append no `update.log`

## Rollback manual

Script: `install/rollback-native.sh`

Uso:

- `bash install/rollback-native.sh --list`
- `bash install/rollback-native.sh --to previous`
- `bash install/rollback-native.sh --to <release>`

Comportamento:

- lock compartilhado com update
- restart de backend/frontend via PM2
- healthcheck pos-rollback

## Integracao PM2/systemd (sempre em current)

O restart nativo usa sempre `BASE_DIR/current` como raiz do codigo.

Recomendacao para systemd (quando aplicavel):

- `WorkingDirectory=${APP_BASE_DIR}/current/apps/backend`
- `ExecStart=node ${APP_BASE_DIR}/current/apps/backend/dist/main.js`

Recomendacao para PM2:

- processos devem apontar para `${APP_BASE_DIR}/current/...`
- nunca fixar caminho de release especifica

## Healthcheck padrao

Endpoint esperado:

- `GET /api/health` com retorno HTTP `200`

Uso no update:

- healthcheck backend e frontend com timeout/tentativas
- falha no healthcheck apos swap dispara rollback automatico

## Compatibilidade

- update in-place legado ainda existe no script via `--legacy-inplace`
- modo legado nao e exposto por default no painel
- fluxo principal do painel permanece no modelo atomico

## Modo Manutencao (maintenance mode)

Fonte de verdade:

- `${APP_BASE_DIR}/shared/maintenance.json`

Contrato do arquivo:

```json
{
  "enabled": true,
  "reason": "Updating from vX to vY",
  "startedAt": "2026-03-05T12:34:56Z",
  "etaSeconds": 300,
  "allowedRoles": ["SUPER_ADMIN"],
  "bypassHeader": "X-Maintenance-Bypass"
}
```

Implementacao backend:

- `MaintenanceModeService`
  - le/escreve `maintenance.json` com escrita atomica
  - fallback seguro para estado desativado quando arquivo nao existe
- `MaintenanceModeGuard` (global em `APP_GUARD`)
  - bloqueia rotas quando `enabled=true`
  - retorna `503` com payload padrao:

```json
{
  "error": "MAINTENANCE_MODE",
  "message": "Sistema em manutencao. Tente novamente em alguns minutos.",
  "reason": "...",
  "etaSeconds": 300
}
```

Whitelist durante manutencao:

- `GET /api/health`
- `GET /api/system/maintenance/state`
- `GET /api/system/version`
- `GET /api/system/update/status`
- `GET /api/system/update/log`
- `GET /api/system/update/releases`
- `POST /api/system/update/run`
- `POST /api/system/update/rollback`
- `POST /api/auth/login`
- `POST /api/auth/login-2fa`
- `POST /api/auth/refresh`
- `GET /api/tenants/public/*`

Bypass administrativo:

- exige header configurado em `maintenance.json` (default `X-Maintenance-Bypass`)
- exige token correto em `MAINTENANCE_BYPASS_TOKEN`
- exige role presente em `allowedRoles` (default `SUPER_ADMIN`)

Endpoint de estado:

- `GET /api/system/maintenance/state`
  - resposta: `{ success: true, data: MaintenanceState }`

## Integracao do update com maintenance mode

No `install/update-native.sh`:

- `maintenance_on` antes de migrations
- migrations executam com manutencao ativa
- em sucesso completo (swap + restart + healthcheck): `maintenance_off`
- em falhas: manutencao permanece ativa para proteger integridade ate intervencao

Estados relevantes no update:

- `step=maintenance_on`
- `step=migrations`
- `step=maintenance_off`

## Frontend (painel)

Comportamento implementado:

- contexto global `MaintenanceProvider` consulta `GET /api/system/maintenance/state` em polling
- interceptor Axios captura `503 + error=MAINTENANCE_MODE` e publica estado para UI
- banner global de manutencao em todas as telas (`MaintenanceBanner`)
- aba de updates mostra aviso de manutencao e bloqueia acoes criticas:
  - verificar atualizacoes
  - executar atualizacao
  - salvar configuracoes de update
  - testar conexao
  - backup e restore (acoes operacionais)

Observacao:

- monitoramento continua disponivel via status/logs de update.

## CI local e smoke tests

Workflow CI adicionado:

- `backend-build`
- `frontend-build`
- `scripts-check`
- `smoke-tests`

Validacoes executadas no pipeline:

- backend: `pnpm -C apps/backend exec prisma generate`, `build`, `test`, `lint`
- frontend: `pnpm -C apps/frontend build`, `lint`
- scripts criticos: `chmod +x`, `bash -n`, `shellcheck`
- contrato HTTP: smoke tests sem executar update real

Scripts validados no CI:

- `install/update-native.sh`
- `install/rollback-native.sh`
- `install/release-retention.sh`
- `install/restore-native.sh`
- `install/restore-db.sh`
- `install/update-images.sh`
- `Scripts/migrate-uploads.sh`

Como rodar localmente:

- `pnpm install`
- `pnpm -C apps/backend exec prisma generate`
- `pnpm -C apps/backend build`
- `pnpm -C apps/backend test`
- `pnpm -C apps/backend lint`
- `pnpm -C apps/frontend build`
- `pnpm -C apps/frontend lint`
- `pnpm -C apps/backend test:smoke`
- `bash -n install/update-native.sh`
- `bash -n install/rollback-native.sh`
- `bash -n install/release-retention.sh`
- `bash -n install/restore-native.sh`
- `bash -n install/restore-db.sh`
- `bash -n install/update-images.sh`
- `bash -n Scripts/migrate-uploads.sh`
- `shellcheck -x -e SC1090,SC1091 install/update-native.sh install/rollback-native.sh install/release-retention.sh install/restore-native.sh install/restore-db.sh install/update-images.sh Scripts/migrate-uploads.sh`

Contrato coberto pelo smoke:

- `GET /api/health` retorna `200`
- `GET /api/system/maintenance/state` retorna `200` e payload sanitizado com `enabled` boolean
- `GET /api/system/update/status` exige autenticacao e retorna `200` com auth mockada
- `MaintenanceModeGuard` retorna `503` para rota protegida comum e preserva acesso a `GET /api/health`
## Governanca de merge (Branch Protection)

Objetivo:

- impedir merge sem validacao automatica
- garantir revisao humana minima
- evitar historico forcado em branch protegida

Configuracao recomendada no GitHub (para main e develop):

1. Acesse Settings -> Branches -> Add branch protection rule.
2. Em Branch name pattern, configure a regra para a branch alvo (ex.: main; repetir para develop se aplicavel).
3. Ative Require a pull request before merging.
4. Defina Required approvals como 1.
5. Ative Require status checks to pass before merging.
6. Marque como checks obrigatorios:
   - backend-build
   - frontend-build
   - scripts-check
   - smoke-tests
7. Ative Require branches to be up to date before merging.
8. Em Restrict who can push to matching branches, mantenha force-push bloqueado (Do not allow bypassing the above settings e sem permissao de force push).
9. Salve a regra e teste abrindo um PR sem passar os checks para confirmar bloqueio.

Resultado esperado:

- nenhum merge ocorre sem CI verde nos 4 gates
- ao menos 1 review aprovado e obrigatorio
- branch protegida contra force-push e merge desatualizado
## Etapa 2 - Notifications persistidas para SUPER_ADMIN (sem realtime)

### Persistencia (Prisma)

Tabela `notifications` com suporte de inbox administrativa:

- `id`, `createdAt`
- `type` (`SYSTEM_ALERT`)
- `severity` (`info|warning|critical`)
- `title`, `body`
- `data` JSON sanitizado
- `targetRole` (foco desta etapa: `SUPER_ADMIN`)
- `targetUserId` (opcional, pronto para evolucao futura)
- `isRead`, `readAt`

Migration desta etapa:

- `apps/backend/prisma/migrations/20260306153000_stage2_notifications_super_admin_inbox/migration.sql`

Indices para listagem e contagem por escopo:

- `createdAt`
- `severity`
- `targetRole`
- `targetUserId`
- `isRead`
- `targetRole + isRead + createdAt`
- `targetUserId + isRead + createdAt`

### Politica de ruido (allowlist)

Nesta etapa, notificacao persistida e criada somente para:

- `UPDATE_STARTED` (`warning`)
- `UPDATE_COMPLETED` (`warning`)
- `UPDATE_FAILED` (`critical`)
- `UPDATE_ROLLED_BACK_AUTO` (`critical`)
- `UPDATE_ROLLBACK_MANUAL` (`critical`)
- `MAINTENANCE_ENABLED` (`warning`)
- `MAINTENANCE_BYPASS_USED` (`critical`)

Fora da allowlist, nao persiste notificacao de sistema.

### Endpoints administrativos

Protecao:

- `JwtAuthGuard + RolesGuard`
- apenas `SUPER_ADMIN`

Rotas:

- `GET /api/system/notifications`
  - filtros: `isRead`, `severity`
  - paginacao: `page`, `limit` (default `20`, maximo `100`)
  - ordenacao: `createdAt desc`
- `GET /api/system/notifications/unread-count`
- `POST /api/system/notifications/:id/read`
- `POST /api/system/notifications/read-all`

### Resiliencia e seguranca

- criacao de notificacao e `fail-safe`: erro de persistencia nao derruba fluxo principal (update/maintenance).
- `data` e sanitizado (tokens, headers sensiveis, segredos e paths criticos).
- `read` e `read-all` validam escopo administrativo de `SUPER_ADMIN`.

### Fora do escopo desta etapa

- SSE
- WebSocket
- polling/frontend realtime
- inbox/bell/toast em tempo real
- notificacoes de backup/restore (implementadas na Etapa 4)

## Etapa 4 - Auditoria + Notifications para Backup/Restore (sem realtime)

### Auditoria persistente (AuditLog)

Eventos adicionados para operacoes de backup/restore:

Backup:

- `BACKUP_STARTED` (`info`)
- `BACKUP_COMPLETED` (`info`)
- `BACKUP_FAILED` (`warning`)

Restore:

- `RESTORE_STARTED` (`critical`)
- `RESTORE_COMPLETED` (`critical`)
- `RESTORE_FAILED` (`critical`)

Metadata principal padronizado:

- backup: `source`, `jobId`, `backupType`, `retentionPolicy`, `durationSeconds`
- backup concluido: `artifactId`, `dbDumpCaptured`, `uploadsArchiveCaptured`, `envSnapshotCaptured`
- restore: `source`, `restoreId`, `backupId`, `artifactIds`, `durationSeconds`
- falhas: `lastError` sanitizado (sem token/cookie/headers sensiveis/path absoluto sensivel)

### Notifications persistidas (SUPER_ADMIN)

Allowlist desta etapa para inbox administrativa:

- `BACKUP_FAILED`
- `RESTORE_STARTED`
- `RESTORE_COMPLETED`
- `RESTORE_FAILED`

Sem ruido adicional:

- `BACKUP_STARTED` e `BACKUP_COMPLETED` nao geram notificacao persistida.

Mensagens humanas padronizadas:

- `BACKUP_FAILED`: `Backup falhou` / `O backup do sistema falhou e precisa de verificacao.`
- `RESTORE_STARTED`: `Restauracao iniciada` / `Uma restauracao do sistema foi iniciada.`
- `RESTORE_COMPLETED`: `Restauracao concluida` / `A restauracao do sistema foi concluida com sucesso.`
- `RESTORE_FAILED`: `Restauracao falhou` / `A restauracao do sistema falhou e pode exigir intervencao.`

### Endpoints reaproveitados (sem novos contratos)

- `GET /api/system/audit`
- `GET /api/system/audit/:id`
- `GET /api/system/notifications`
- `GET /api/system/notifications/unread-count`
- `POST /api/system/notifications/:id/read`
- `POST /api/system/notifications/read-all`

Observacao:

- a inbox existente do `SUPER_ADMIN` (polling) passa a exibir os eventos novos sem alteracao estrutural de UI.

## Etapa 1 - AuditLog persistente (update + maintenance)

### Modelo persistente

Tabela `audit_logs` (Prisma `AuditLog`) com trilha estruturada para operacoes sensiveis:

- `id`, `createdAt`, `action`, `severity`, `message`
- contexto de ator: `actorUserId`, `actorEmail`, `actorRole`
- contexto de request: `ip`, `userAgent`
- `tenantId`
- `metadata` (JSON sanitizado)

Indices ativos para consulta administrativa:

- `createdAt`
- `action`
- `severity`
- `actorUserId`

### Eventos auditados nesta etapa

Update:

- `UPDATE_RUN_REQUESTED` (`info`)
- `UPDATE_STARTED` (`warning`)
- `UPDATE_COMPLETED` (`warning`)
- `UPDATE_FAILED` (`critical`)
- `UPDATE_ROLLBACK_MANUAL` (`critical`)
- `UPDATE_ROLLED_BACK_AUTO` (`critical`)

Maintenance:

- `MAINTENANCE_ENABLED` (`warning`)
- `MAINTENANCE_DISABLED` (`info`)
- `MAINTENANCE_BYPASS_USED` (`critical`)

Observacoes:

- `metadata` de update inclui `fromVersion`, `toVersion`, `durationSeconds`, `exitCode` e estado de rollback quando aplicavel.
- `metadata` de maintenance inclui `reason`, `etaSeconds` e `source` (`admin` ou `update-script`).
- uso de bypass token por `SUPER_ADMIN` gera auditoria critica com `route` e `method`.

### Endpoints administrativos de auditoria

- `GET /api/system/audit`
  - paginacao: `page`, `limit` (default `20`, maximo `100`)
  - filtros: `action`, `severity`, `actorUserId`, `from`, `to`
  - ordenacao: `createdAt desc`
  - escopo administrativo atual: acoes `UPDATE_*`, `MAINTENANCE_*`, `BACKUP_*`, `RESTORE_*`
- `GET /api/system/audit/:id`
  - retorna apenas registros administrativos (`UPDATE_*`, `MAINTENANCE_*`, `BACKUP_*`, `RESTORE_*`)

Protecao:

- `JwtAuthGuard + RolesGuard`
- perfis permitidos: `ADMIN`, `SUPER_ADMIN`

### Resiliencia e seguranca

- falha ao persistir auditoria nao derruba operacao principal (fail-safe).
- sanitizacao de payload remove segredos, headers sensiveis, paths sensiveis e conteudo bruto com credenciais/token.
- retorno de `metadata` em listagem/detalhe tambem e sanitizado.

### Fora do escopo desta etapa

- notificacoes realtime/inbox
- SSE/WebSocket adicionais
- frontend dedicado para auditoria
