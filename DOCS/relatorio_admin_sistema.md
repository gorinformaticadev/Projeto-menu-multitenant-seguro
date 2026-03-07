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

## Etapa 5 - Inbox operacional SUPER_ADMIN (UX sem realtime)

Evolucao da inbox administrativa mantendo o contrato existente de backend e polling de `30s`.

### Melhorias de UX na lista

- destaque visual por severidade:
  - `critical`: realce forte
  - `warning`: realce moderado
  - `info`: realce discreto
- diferenca clara entre item lido e nao lido
- exibicao de resumo operacional por item:
  - titulo
  - mensagem
  - severidade
  - categoria
  - acao (`UPDATE_*`, `MAINTENANCE_*`, `BACKUP_*`, `RESTORE_*`)
  - data/hora relativa

### Filtros disponiveis na inbox (client-side)

- leitura: `Todas`, `Nao lidas`, `Lidas`
- severidade: `Todas`, `Criticas`, `Warnings`, `Informativas`
- categoria: `Todas`, `Update`, `Maintenance`, `Backup`, `Restore`

Mapeamento de categoria por prefixo de acao:

- `UPDATE_*` -> `Update`
- `MAINTENANCE_*` -> `Maintenance`
- `BACKUP_*` -> `Backup`
- `RESTORE_*` -> `Restore`

### Detalhe expandido seguro

Ao clicar no item:

- abre detalhe inline
- item nao lido e marcado como lido automaticamente
- permanece acao manual de `Marcar lida`

Renderer de metadata restrito a campos conhecidos (sem JSON bruto), por exemplo:

- `fromVersion`, `toVersion`, `targetVersion`
- `source`, `durationSeconds`, `etaSeconds`, `exitCode`
- `rollbackAttempted`, `rollbackCompleted`
- `backupId`, `restoreId`, `jobId`, `artifactId`
- `backupType`, `retentionPolicy`, `reason`

Campos desconhecidos sao ignorados na UI.

### Links contextuais por categoria operacional

- `UPDATE_*` -> `Abrir atualizacoes`
- `BACKUP_*` / `RESTORE_*` -> `Abrir backups`
- `MAINTENANCE_*` -> `Abrir sistema`

Rotas reaproveitadas (sem deep links complexos):

- `/configuracoes/sistema/updates?tab=status` (update/maintenance)
- `/configuracoes/sistema/updates?tab=backup` (backup/restore)

### Estados de tela

- vazio sem dados: `Nenhuma notificacao do sistema.`
- vazio com filtro: `Nenhuma notificacao encontrada para os filtros aplicados.`
- erro: `Nao foi possivel carregar notificacoes.`

### Testes frontend (minimos)

Cobertura adicionada para:

- filtro por leitura/severidade/categoria (utils)
- destaque de item `critical`
- clique para abrir detalhe
- link contextual por tipo
- `markAsRead` com detalhe aberto

### Fora de escopo mantido nesta etapa

- SSE
- WebSocket
- polling adaptativo
- busca textual
- paginacao infinita
- exportacao de notificacoes
- notificacoes para perfis fora de `SUPER_ADMIN`

## Etapa 6 - Retencao e housekeeping de AuditLog + Notification

Implementacao de politica de retencao automatica para conter crescimento das tabelas operacionais sem perder dados recentes.

### Politica de retencao

- `AuditLog`: manter `180` dias (padrao)
- `Notification`:
  - lidas: manter `30` dias (padrao)
  - nao lidas: nao apagar automaticamente

Configuracao via ambiente:

- `AUDIT_LOG_RETENTION_DAYS` (default `180`)
- `NOTIFICATION_READ_RETENTION_DAYS` (default `30`)
- `SYSTEM_RETENTION_DELETE_LIMIT` (default `5000` por execucao/tabela)

### Housekeeping (backend)

Servico dedicado:

- `SystemDataRetentionService`
  - `cleanupAuditLogs()`
  - `cleanupNotifications()`
  - `runRetentionCleanup()`

Regras aplicadas:

- Audit:
  - remove `audit_logs` com `createdAt < cutoff`
- Notification:
  - remove `notifications` com `isRead = true` e:
    - `readAt < cutoff`, ou
    - `readAt is null` + `createdAt < cutoff` (fallback legado)

Comportamento fail-safe:

- erro na limpeza nao derruba aplicacao
- erro e logado internamente e o fluxo segue
- auditoria de housekeeping so e registrada quando ocorre falha:
  - `SYSTEM_DATA_RETENTION_FAILED` (`warning`)

Protecao contra limpeza massiva acidental:

- a exclusao e feita por lote com teto por execucao (`SYSTEM_RETENTION_DELETE_LIMIT`)
- housekeeping usa `findMany` (ids mais antigos) + `deleteMany` em lote
- quando o teto e atingido, o restante segue para execucoes futuras

### Agendamento automatico (cron)

Job diario registrado no scheduler dinamico:

- chave: `system.system_data_retention`
- nome: `system_data_retention`
- schedule: `30 3 * * *` (03:30)
- origem: `core`

Nao gera auditoria de sucesso diario para evitar ruido.

### Endpoint administrativo (execucao manual)

- `POST /api/system/retention/run`
- protecao: `JwtAuthGuard + RolesGuard`
- role: `SUPER_ADMIN`

Resposta:

- `deletedAuditLogs`
- `deletedNotifications`
- `auditCutoff` (ISO)
- `notificationCutoff` (ISO)

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

## Etapa 7 - Dashboard Operacional Modular

Implementacao de dashboard operacional configuravel com widgets independentes, layout reorganizavel e persistencia por role/usuario.

### Backend (API agregada + layout persistente)

Novos endpoints:

- `GET /api/system/dashboard`
- `GET /api/system/dashboard/layout`
- `PUT /api/system/dashboard/layout`

Protecao:

- `JwtAuthGuard + RolesGuard`
- roles permitidas: `SUPER_ADMIN`, `ADMIN`, `USER`, `CLIENT`

Contrato agregado (`GET /api/system/dashboard`):

- `version`
- `uptime`
- `maintenance`
- `system`
- `cpu`
- `memory`
- `disk`
- `database`
- `redis`
- `workers`
- `api`
- `security`
- `backup`
- `jobs`
- `errors`
- `tenants`
- `notifications`
- `widgets.available`

Caracteristicas:

- coleta fail-safe por metrica (falha em uma metrica nao derruba o endpoint)
- metrica de tempo medio de resposta da API em memoria via interceptor global
- projection por role:
  - `SUPER_ADMIN`: visao completa
  - `ADMIN`: visao reduzida de infraestrutura sensivel
  - `USER/CLIENT`: visao basica com campos restritos

### Persistencia de layout (Prisma)

Novo modelo:

- `DashboardLayout` (`dashboard_layouts`)

Campos:

- `id`
- `userId`
- `role`
- `layoutJson`
- `filtersJson`
- `createdAt`
- `updatedAt`

Regras:

- `@@unique([userId, role])`
- layout salvo por usuario e role
- defaults por role quando nao existe registro persistido

Migration:

- `apps/backend/prisma/migrations/20260306193000_stage7_dashboard_operational_layouts/migration.sql`

### Frontend (inbox operacional do dashboard)

Rota:

- `/dashboard`

Funcionalidades aplicadas:

- grid responsivo em estilo observabilidade com `react-grid-layout`
- drag & drop para reorganizacao dos widgets
- ocultar/exibir widgets individualmente
- filtros globais:
  - periodo
  - severidade
  - tenant (quando aplicavel)
- persistencia automatica de layout/filtros (debounce) em `/api/system/dashboard/layout`
- polling automatico de metricas a cada `15s`
- fallback visual seguro para metricas indisponiveis/restritas

### Etapa 7.1 - Hardening complementar

Politica final de acesso durante maintenance:

- leitura do dashboard operacional permanece liberada apenas para `ADMIN` e `SUPER_ADMIN` autenticados
- `USER` e `CLIENT` continuam bloqueados pelo `MaintenanceModeGuard` quando `enabled=true`

Politica da metrica de tempo medio da API:

- o card principal usa a categoria `business`
- ficam excluidos da media os endpoints operacionais/observabilidade:
  - `/api/system/dashboard`
  - `/api/system/dashboard/layout`
  - `/api/system/maintenance/state`
  - `/api/system/notifications`
  - `/api/system/notifications/unread-count`
  - `/api/system/notifications/stream`
  - `/api/system/update/status`
  - `/api/system/update/log`
  - `/api/system/version`
  - `/api/system/metrics`
- `GET /api/health` fica segmentado em `health`
- demais rotas `/api/system/*` nao excluidas entram na categoria `system`

Politica de falha parcial por widget no agregado:

- cada bloco sensivel e resolvido isoladamente com `safeMetric`
- falha em um widget nao derruba `GET /api/system/dashboard`
- fallback por widget:
  - `database`, `redis`, `workers` -> `status=error`
  - `jobs`, `backup`, `security`, `errors` -> `status=degraded`
- o frontend renderiza estado proprio por widget (`Indisponivel`, `Degradado`, `Sem dados`) sem toast por ciclo de polling

Cache curto no agregado:

- cache em memoria com TTL de `10s` para:
  - `redis`
  - `workers`
  - `jobs`
  - `backup`
  - `security`
  - `errors`
- sem cache para:
  - `maintenance`
  - `uptime`
  - `notifications`
  - `version`

Politica explicita de widgets por role:

- `SUPER_ADMIN`:
  - `version`, `uptime`, `maintenance`, `api`, `cpu`, `memory`, `disk`, `system`, `database`, `redis`, `workers`, `jobs`, `backup`, `errors`, `security`, `tenants`, `notifications`
- `ADMIN`:
  - `version`, `uptime`, `maintenance`, `api`, `cpu`, `memory`, `database`, `jobs`, `backup`, `errors`, `security`, `notifications`
- `USER` e `CLIENT`:
  - `version`, `uptime`, `maintenance`, `api`, `notifications`

Endurecimento de persistencia/layout:

- `widgets.available` no backend e a fonte de verdade para a UI
- `layoutJson` e `filtersJson.hiddenWidgetIds` sao sanitizados no backend conforme a role antes de salvar e antes de devolver
- a precedencia continua explicita em `resolution.source` (`user_role` > `role_default`)

### Validacao desta etapa

Backend:

- `pnpm -C apps/backend build`
- `pnpm -C apps/backend test`
- `pnpm -C apps/backend test:smoke`

Frontend:

- `pnpm -C apps/frontend lint`
- `pnpm -C apps/frontend test`
- `pnpm -C apps/frontend build`

Observacao:

- lint atual do projeto permanece com warnings legados fora do escopo da etapa.
