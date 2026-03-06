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
## Auditoria e Notificacoes para SUPER_ADMIN

### Persistencia (Prisma)

`AuditLog` foi expandido para suportar auditoria operacional com:

- `severity` (`info|warning|critical`)
- `message` humano curto
- ator (`actorUserId`, `actorEmail`, `actorRole`)
- contexto de request (`ip`, `userAgent`)
- `metadata` JSON sanitizado

`Notification` foi expandido para notificacoes de sistema com:

- `type` (ex.: `SYSTEM_ALERT`)
- `severity` (`info|warning|critical`)
- `title` + `body`
- alvo por `targetRole` (`SUPER_ADMIN`) ou `targetUserId`
- leitura (`isRead`, `readAt`)

Migration aplicada:

- `apps/backend/prisma/migrations/20260306093000_add_audit_notification_governance_fields/migration.sql`

### Politica de severidade e ruido

Regras aplicadas:

- toda operacao relevante sempre gera `AuditLog`
- notificacao em tempo real/persistida segue allowlist de operacoes criticas/operacionais
- payloads passam por sanitizacao (sem tokens/segredos/paths completos)

Allowlist de notificacoes:

- `UPDATE_STARTED`
- `UPDATE_COMPLETED`
- `UPDATE_FAILED`
- `UPDATE_ROLLED_BACK_AUTO`
- `UPDATE_ROLLBACK_MANUAL`
- `MAINTENANCE_ENABLED`
- `BACKUP_FAILED`
- `RESTORE_STARTED`
- `RESTORE_COMPLETED`
- `RESTORE_FAILED`

### Acoes instrumentadas

Update/Rollback:

- `UPDATE_RUN_REQUESTED` (audit)
- `UPDATE_STARTED` (audit + notify)
- `UPDATE_COMPLETED` (audit + notify)
- `UPDATE_FAILED` (audit + notify)
- `UPDATE_ROLLED_BACK_AUTO` (audit + notify)
- `UPDATE_ROLLBACK_MANUAL` (audit + notify)

Maintenance:

- `MAINTENANCE_ENABLED` (audit + notify)
- `MAINTENANCE_DISABLED` (audit)

Backup/Restore:

- `BACKUP_STARTED` (audit)
- `BACKUP_COMPLETED` (audit)
- `BACKUP_FAILED` (audit + notify)
- `RESTORE_STARTED` (audit + notify)
- `RESTORE_COMPLETED` (audit + notify)
- `RESTORE_FAILED` (audit + notify)

### Contrato HTTP de notificacoes de sistema

Protecao:

- `JwtAuthGuard + RolesGuard`
- apenas `SUPER_ADMIN`

Rotas:

- `GET /api/system/notifications`
  - pagina notificacoes de sistema
  - query: `page`, `limit`, `unreadOnly`
- `POST /api/system/notifications/:id/read`
  - marca notificacao como lida
- `GET /api/system/notifications/stream`
  - SSE para eventos em tempo real (`event: system_alert`)

Exemplo de evento SSE:

```text
event: system_alert
data: {"id":"...","type":"SYSTEM_ALERT","severity":"critical","title":"...","body":"...","data":{...},"createdAt":"...","isRead":false,"readAt":null}
```

### Maintenance mode e notificacoes

Durante maintenance mode, rotas de notificacao de sistema ficam liberadas para monitoramento administrativo:

- `GET /api/system/notifications*`
- `POST /api/system/notifications/:id/read`

### Frontend (SUPER_ADMIN)

TopBar passou a usar canal dedicado de notificacoes de sistema para `SUPER_ADMIN`:

- SSE em `/api/system/notifications/stream`
- fallback polling a cada 30s em `/api/system/notifications`
- contador de nao lidas + inbox/dropdown
- marcar como lida
- toast imediato para eventos `critical`

### Cobertura de smoke tests

`apps/backend/test/smoke/system-contract.e2e.ts` cobre:

- `GET /api/health`
- `GET /api/system/maintenance/state`
- `GET /api/system/update/status` (auth)
- `GET /api/system/notifications` (auth)
- `POST /api/system/notifications/:id/read` (auth)
- guard de maintenance bloqueando rota comum e preservando health/update status/notifications

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
  - escopo disciplinado desta etapa: apenas acoes `UPDATE_*` e `MAINTENANCE_*`
- `GET /api/system/audit/:id`
  - retorna apenas registros de `UPDATE_*` e `MAINTENANCE_*`

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
