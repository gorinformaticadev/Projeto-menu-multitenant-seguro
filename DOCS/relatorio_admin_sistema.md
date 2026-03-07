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

### Etapa 7.2 - Auditoria de historico e graficos incrementais

Inventario atual das metricas do dashboard:

| Widget | Tipo atual | Historico disponivel | Fonte |
| --- | --- | --- | --- |
| `version` | snapshot de versao/build | nao | `SystemVersionService` |
| `uptime` | contador derivado do processo | nao persistido | `process.uptime()` |
| `maintenance` | snapshot de estado | nao | `MaintenanceModeService` |
| `system` | snapshot do host/node | nao | `os.*` / `process.*` |
| `cpu` | snapshot + `loadAvg` do host | parcial, apenas amostra do SO | `os.loadavg()` |
| `memory` | snapshot de uso | sim, buffer leve em memoria | `os.*` / `process.memoryUsage()` |
| `disk` | snapshot de armazenamento | nao | `fs.statfs()` |
| `database` | snapshot de latencia | nao | `SELECT 1` |
| `redis` | snapshot de ping | nao | `ioredis.ping()` |
| `workers` | snapshot de filas em execucao | nao | `backupJob.count()` |
| `api` | media atual + categorias | sim, serie temporal real em memoria | `ResponseTimeMetricsService` |
| `security` | agregacao por IP no periodo | historico apenas via janela consultada, sem serie fixa | `audit_logs` |
| `backup` | ultimo backup | sim, lista recente | `backup_jobs` |
| `jobs` | contadores + ultima falha | sim, lista recente de falhas | `backup_jobs` |
| `errors` | eventos criticos recentes | sim, lista recente | `audit_logs` |
| `tenants` | contagem de tenants | nao | `tenant.count()` |
| `notifications` | contadores criticos | nao | `notification.count()` |

Melhorias incrementais aplicadas:

- `api`
  - continua com media atual de `5 min`
  - agora expoe `history` com `12` buckets para janela curta de `5` a `15 min`
  - a base ja existia em memoria no `ResponseTimeMetricsService`
- `memory`
  - agora expoe `history` curto em memoria
  - buffer fixo de `30` pontos com retencao maxima de `5 min`
  - coleta acontece durante as leituras normais do dashboard/polling
- `backup`
  - continua com `lastBackup`
  - agora expoe `recentBackups` com os `10` backups bem-sucedidos mais recentes
- `jobs`
  - continua com `running`, `pending`, `failedLast24h` e `lastFailure`
  - agora expoe `recentFailures` com as `20` falhas mais recentes
- `errors`
  - ampliado de `5` para `20` eventos criticos recentes dentro da janela/filtro atual

Historico leve exposto no endpoint agregado:

- `api.history`
  - serie temporal leve para sparkline
- `memory.history`
  - serie curta em memoria para sparkline de uso
- `backup.recentBackups`
  - lista recente para contexto operacional
- `jobs.recentFailures`
  - lista recente para detalhe rapido
- `errors.recent`
  - lista recente de eventos criticos

Limites e protecoes:

- nenhum buffer cresce indefinidamente
- `ResponseTimeMetricsService`
  - retencao maxima: `30 min`
  - limite: `1200` amostras por categoria
- historico de memoria
  - retencao maxima: `5 min`
  - limite: `30` pontos
- historicos de banco/auditoria
  - `recentBackups`: `10`
  - `recentFailures`: `20`
  - `errors.recent`: `20`
- o payload agregado continua pequeno e o hardening de falha parcial por widget permanece ativo

Limitacoes conhecidas desta etapa:

- historico de memoria e dependente de leitura do dashboard; nao existe coletor em background dedicado
- `cpu.loadAvg` continua sendo amostra do sistema operacional, nao um historico proprio do dashboard
- `security` e `notifications` continuam expostos como agregacoes/snapshots do periodo, sem serie temporal dedicada

### Etapa 7.3 - Auditoria de drill-down e acoes rapidas

Inventario consolidado das interacoes do dashboard:

| Widget / bloco | Ja era clicavel? | Destino / detalhe existente | Estado apos auditoria |
| --- | --- | --- | --- |
| `version` | nao | rota real em `/configuracoes/sistema/updates?tab=status` | passou a abrir atualizacoes |
| `maintenance` | nao | rota real em `/configuracoes/sistema/updates?tab=status` | passou a abrir atualizacoes |
| `backup` | nao | rota real em `/configuracoes/sistema/updates?tab=backup` | passou a abrir backups |
| `jobs` | parcial | popover com ultimas falhas ja existia | mantido como detalhe local; sem rota nova |
| `errors` | nao | tela real em `/logs` | passou a abrir auditoria para `SUPER_ADMIN` |
| `notifications` | nao | drawer e pagina `/notifications` ja existiam | dashboard passou a reabrir o drawer para `SUPER_ADMIN` |
| `tenants` | nao | existe rota `/empresas`, mas nao foi ligada nesta etapa | mantido como informativo |
| `database` / `redis` / `workers` | nao | nao existe tela operacional dedicada melhor do que o snapshot | mantidos como informativos |
| `saude do painel` | sim | popover por bucket ja existia | mantido |
| `panorama.jobs` | sim | popover com falhas recentes ja existia | mantido |

Rotas e componentes reaproveitados:

- `/configuracoes/sistema/updates`
  - aba `status` para versao / maintenance / update
  - aba `backup` para backup / restore
- `/logs`
  - usada como drill-down de `Eventos Criticos`
- `SystemNotificationsDrawer`
  - reaproveitado para abrir notificacoes criticas direto do dashboard

Implementacoes incrementais desta etapa:

- faixa discreta de `Acoes rapidas` no topo do dashboard
  - `Abrir atualizacoes`
  - `Abrir backups`
  - `Ver notificacoes criticas` (somente quando o drawer ja esta habilitado)
  - `Ver auditoria` (`SUPER_ADMIN`)
- widgets clicaveis onde ja havia destino real e util
  - `version`
  - `maintenance`
  - `backup`
  - `errors`
  - `notifications`
- filtros locais de foco rapido no frontend
  - `all`
  - `problems`
  - `critical`
  - `operations`
  - `infrastructure`
- os filtros rapidos atuam apenas sobre o conjunto de widgets livres/renderizados no grid desta etapa
- quando o filtro rapido nao encontra widgets livres correspondentes, o dashboard mostra estado vazio explicito em vez de sumir com a area

Decisoes de escopo mantidas:

- `jobs` continua sem nova rota dedicada, porque o popover com falhas recentes ja entrega o melhor drill-down util nesta etapa
- `database`, `redis` e `workers` permanecem apenas como snapshot operacional
- nao foi criada segunda inbox, segunda tela de logs ou rota vazia apenas para melhorar a aparencia
- debito tecnico assumido:
  - `version` e `maintenance` ainda reutilizam `/configuracoes/sistema/updates?tab=status`
  - `backup` reutiliza a mesma area base em `/configuracoes/sistema/updates?tab=backup`
  - se os fluxos operacionais crescerem, vale separar telas ou subareas dedicadas para reduzir ambiguidade de drill-down

### Etapa 7.4 - Polimento visual, responsividade e consistencia

Auditoria visual resumida:

- pontos que ja estavam bons:
  - hierarquia principal com bloco fixo de `Panorama` + grid livre
  - fallback por widget sem quebrar o dashboard
  - filtros rapidos e acoes rapidas ja tinham base funcional reaproveitavel
- inconsistencias ajustadas:
  - loading inicial ainda usava spinner generico no grid
  - estados vazios estavam misturados entre texto solto e caixas visuais diferentes
  - edicao de layout continuava exposta em telas pequenas
  - cards clicaveis e popovers precisavam de foco visivel mais consistente
  - a faixa de acoes/foco rapido ainda podia poluir em resolucoes menores

Padrao visual consolidado:

- `OperationalDashboardWidget` continua como base unica dos cards arrastaveis
- `DashboardSurfaceState` virou o bloco compartilhado para:
  - `Sem dados`
  - `Degradado`
  - `Indisponivel`
  - mensagens vazias contextuais
- `OperationalDashboardWidgetSkeleton` passou a cobrir o carregamento inicial do grid
- headers, pills de acao e foco visivel dos widgets interativos foram padronizados

Responsividade aplicada:

- grid `sm` agora trabalha em coluna unica
- ordem dos widgets pequenos prioriza problemas operacionais no viewport menor
- drag/drop e resize ficam desativados abaixo de `640px`
- em mobile o dashboard entra em modo leitura automaticamente e mostra a indicacao de que reorganizacao fica disponivel apenas em telas maiores
- faixa de `Acoes rapidas` e `Foco rapido` foi reorganizada para grid/chips mais estaveis em telas pequenas

Loading e polling:

- o carregamento inicial do dashboard agora usa skeletons no topo e no grid
- durante polling normal os dados anteriores continuam em tela; o refresh nao reseta os cards
- o dashboard evita flicker desnecessario ao trocar spinner global por placeholders estruturais

Estados padronizados:

- `loading`
  - skeletons leves por area
- `empty`
  - `Sem dados` com descricao curta contextual
- `degraded`
  - `Degradado` com explicacao curta
- `error`
  - `Indisponivel` com tentativa de recuperacao no proximo ciclo

Aplicacoes diretas do padrao:

- cards de `api`, `cpu`, `backup`, `errors` e `security`
- area vazia do grid livre
- estado sem dados do grafico de `Saude do painel`

Observacoes de acessibilidade:

- widgets clicaveis mantem suporte por teclado com `Enter` e `Espaco`
- controles internos nao disparam navegacao dupla do card
- quick actions, chips de foco rapido e popovers ganharam foco visivel
- o dashboard nao depende apenas de cor para severidade; os estados continuam com texto explicito (`Sem dados`, `Degradado`, `Indisponivel`)

### Etapa 8 - Telemetria operacional leve, erros por rota e seguranca operacional

Escopo implementado no backend:

- servico central `SystemTelemetryService` com agregacao curta em memoria
- interceptor global `SystemTelemetryInterceptor` para registrar:
  - rota normalizada
  - metodo
  - latencia
  - status HTTP
- integracao direta nos pontos que falham antes do interceptor:
  - `JwtAuthGuard` -> `401`
  - `RolesGuard` -> `403`
  - `TenantInterceptor` -> `403`
  - `SecurityThrottlerGuard` -> `429`
  - `MaintenanceModeGuard` -> `503` e tentativa de bypass negada

Politica de normalizacao de rota:

- query string sempre removida
- ids numericos, UUIDs e ObjectIds viram `:id`
- segmentos opacos/tokenizados longos viram `:token`
- quando o framework fornece `route.path`, a telemetria prioriza o template real da rota
- exemplos:
  - `/api/users/123` -> `/api/users/:id`
  - `/api/orders/987/items/1` -> `/api/orders/:id/items/:id`
  - `/api/tokens/9f86d081884c7d659a2feaa0c55ad015` -> `/api/tokens/:token`

Rotas excluidas ou reduzidas para evitar ruido:

- excluidas da telemetria de request/latencia por rota:
  - `/api/health`
  - `/api/system/dashboard`
  - `/api/system/dashboard/layout`
  - `/api/system/maintenance/state`
  - `/api/system/notifications/*`
  - `/api/system/update/status`
  - `/api/system/update/log`
  - `/api/system/version`
  - `/api/system/metrics`
- seguranca operacional continua coletando eventos negados relevantes em rotas sensiveis, inclusive dashboard durante maintenance, mas segue ignorando health/notifications/metrics puramente internas

Buffers e limites em memoria:

- requests agregados por rota:
  - retencao: `15 minutos`
  - limite maximo: `5000 eventos`
- eventos de seguranca:
  - retencao: `6 horas`
  - limite maximo: `2000 eventos`
- sem crescimento indefinido; entradas antigas sao podadas por janela e por teto maximo
- historico continua efemero em memoria:
  - reinicia apos restart do processo
  - nao cria armazenamento em banco nesta etapa

Metricas novas expostas no dashboard:

| Widget | Tipo | Fonte | Observacao |
| --- | --- | --- | --- |
| `routeLatency` | top rotas lentas + media recente | telemetria em memoria por rota | usa rota normalizada, sem query/token |
| `routeErrors` | top rotas com erro + taxa recente | telemetria em memoria por rota | inclui contagem de erro e `5xx` por rota |
| `security` | pressao de seguranca | telemetria em memoria de `401/403/429/503` | substitui o snapshot simples por denied IPs, rate limit e bypass |

Widgets e leitura operacional por role:

- `SUPER_ADMIN`
  - acesso completo a `routeLatency`, `routeErrors` e `security`
- `ADMIN`
  - ve `routeLatency` e `routeErrors`
  - ve `security` com IP mascarado e lista recente resumida
- `USER` / `CLIENT`
  - sem widgets de telemetria operacional no dashboard
  - payload continua com projection `restricted` caso algum layout legado tente referenciar esses blocos

Widgets do dashboard atualizados:

- `Top rotas lentas`
  - mostra media recente, janela e top 5 rotas mais lentas
- `Top rotas com erro`
  - mostra total de erros recentes, taxa de erro e top 5 rotas com falha
- `Pressao de seguranca`
  - mostra total negado, `429` recentes, tentativas de bypass e listas curtas de IPs/eventos

Seguranca e privacidade:

- nao gravamos query string
- nao gravamos corpo da request
- nao gravamos tokens
- IP so aparece mascarado para `ADMIN`
- rotas expostas no dashboard ja saem normalizadas, sem ids reais e sem segmentos opacos brutos

Limitacoes assumidas nesta etapa:

- telemetria nova nao e segmentada profundamente por tenant
- filtros de tenant do dashboard nao refinam a telemetria por rota/IP nesta etapa
- sem persistencia historica em banco, sem Prometheus/Grafana e sem alerting automatico complexo

Validacao executada nesta etapa:

- backend
  - testes dedicados do utilitario, servico e interceptor de telemetria
  - `system-dashboard.service.spec.ts`
  - `maintenance-mode.guard.spec.ts`
  - `security-throttler.guard.spec.ts`
  - `test:smoke`
  - `build`
- frontend
  - `eslint` dos arquivos do dashboard operacional
  - testes de `dashboard.utils`, `dashboard.interactions` e `DashboardMetricState`
  - `build`

### Etapa 8.1 - Shell principal do dashboard, cards de modulos e operacional recolhido

Politica final de exibicao do dashboard:

- o agregado operacional `/api/system/dashboard` ficou restrito a `SUPER_ADMIN`
- o dashboard principal `/dashboard` continua disponivel para usuarios autenticados, mas passa a ser composto por:
  - cards comuns/publicados pelos modulos habilitados para o usuario e tenant
  - card fixo `Dashboard Operacional`, exibido somente para `SUPER_ADMIN`, em largura total e fora do grid editavel

Comportamento esperado por role:

- `SUPER_ADMIN`
  - ve os cards comuns de modulo quando tambem pertence a um tenant/modulos ativos
  - ve adicionalmente o card principal `Dashboard Operacional`
  - a secao operacional completa fica recolhida por padrao e so expande ao clicar nesse card
- `ADMIN` / `USER` / `CLIENT`
  - nao recebem a secao operacional nem o payload agregado operacional
  - veem apenas os cards publicados pelos modulos permitidos

Hierarquia explicita de visibilidade dos cards:

- niveis suportados:
  - `SUPER_ADMIN`
  - `ADMIN`
  - `USER`
  - `CLIENT`
- cada card do dashboard principal passa a carregar uma regra `visibilityRole`
- a regra funciona como piso minimo:
  - `SUPER_ADMIN` pode ver cards marcados para `SUPER_ADMIN`, `ADMIN`, `USER` e `CLIENT`
  - `ADMIN` pode ver cards marcados para `ADMIN`, `USER` e `CLIENT`
  - `USER` pode ver cards marcados para `USER` e `CLIENT`
  - `CLIENT` ve apenas cards marcados para `CLIENT`
- para widgets declarados pelos modulos:
  - `visibilityRole` pode ser informado explicitamente
  - se o modulo declarar apenas `roles`, o backend deriva o piso pela hierarquia
  - se o modulo nao declarar regra explicita, o fallback assume `CLIENT`

Novo endpoint para integracao de modulos:

- `GET /api/system/dashboard/module-cards`
  - retorna os cards do dashboard principal para a role/tenant atual
  - reaproveita o registro de modulos e faz fallback para cards genericos quando o modulo nao publica widget rico
  - contrato preparado para cards:
    - `summary`
    - `list`
    - `kanban`
  - campos principais:
    - `id`
    - `title`
    - `description`
    - `module`
    - `kind`
    - `icon`
    - `href`
    - `actionLabel`
    - `size`
    - `stats`
    - `items`

Persistencia e edicao de layout:

- o botao `Editar layout` do dashboard principal agora controla os cards do shell principal:
  - cards de modulo
- os cards comuns continuam arrastaveis e redimensionaveis nas telas maiores
- em mobile, a edicao permanece bloqueada e o dashboard entra em modo leitura
- o card principal do operacional fica fora do grid e nao participa da ordenacao/ocultacao

UX do operacional apos a reorganizacao:

- o componente `OperationalDashboard` passou a suportar modo embutido
- o card principal do operacional ocupa sozinho a primeira linha
- esse card mostra apenas:
  - `Dashboard Operacional`
  - `Visao operacional recolhida por padrao.`
  - acao `Abrir` / `Recolher`
- no modo embutido:
  - o header preto do operacional nao se repete
  - o drawer/botao `Filtros` foi removido
  - `Periodo` e `Tenant` foram movidos para a area `Acoes rapidas`, abaixo de `Foco rapido`
  - o grid operacional usa fallback local/default, sem competir com o layout persistido do shell principal
- quando expandido:
  - a secao operacional aparece logo abaixo do card principal
  - os cards de modulos continuam abaixo da secao operacional

Debito tecnico registrado:

- `version` e `maintenance` continuam reaproveitando a area de `updates`
- `backup` continua caindo na mesma area base de sistema/updates
- se no futuro for necessario permitir layout persistido tambem para a grade operacional embutida, o correto sera separar o armazenamento do shell principal e da secao operacional

### Etapa 8.1 - Thresholds e alertas operacionais automaticos com push seletivo

Inventario da infra reaproveitada:

- inbox persistida:
  - continua usando `NotificationService` e a tabela `Notification`
- realtime/push:
  - continua usando `NotificationGateway.emitNewNotification(...)`
  - push continua centralizado em `PushNotificationService`
  - selecao de destinatarios para notificacoes globais segue atendendo `SUPER_ADMIN`
- scheduler:
  - a avaliacao automatica foi adicionada como cron `system_operational_alerts_evaluator`, executada a cada `1 minuto`

Servico central:

- novo servico `SystemOperationalAlertsService`
  - avalia snapshots da telemetria operacional existente
  - aplica janela explicita, amostra minima e cooldown
  - persiste notificacoes operacionais em `module=operational-alerts`
  - usa inbox sempre
  - usa push apenas para alertas criticos selecionados e apenas quando a infra de Web Push estiver disponivel
  - faz fallback automatico para inbox only quando o push nao estiver configurado

Thresholds implementados:

| Alerta | Regra base | Canal |
| --- | --- | --- |
| `OPS_HIGH_5XX_ERROR_RATE` | taxa de `5xx` acima de `OPS_ALERT_5XX_RATE_THRESHOLD`, com `OPS_ALERT_MIN_REQUEST_SAMPLE` | inbox + push |
| `OPS_CRITICAL_SLOW_ROUTE` | rota elegivel acima de `OPS_ALERT_ROUTE_LATENCY_MS_THRESHOLD`, com `OPS_ALERT_MIN_ROUTE_SAMPLE` | inbox |
| `OPS_ACCESS_DENIED_SPIKE` | `401/403/429` acima de `OPS_ALERT_DENIED_SPIKE_THRESHOLD`, com `OPS_ALERT_MIN_DENIED_SAMPLE` | inbox |
| `OPS_JOB_FAILURE_STORM` | falhas repetidas de jobs acima de `OPS_ALERT_JOB_FAILURE_STORM_THRESHOLD` | inbox + push |
| `OPS_DATABASE_DEGRADED` | banco degradado/erro por `OPS_ALERT_INFRA_DEGRADED_MIN_CONSECUTIVE` avaliacoes consecutivas | inbox + push |
| `OPS_REDIS_DEGRADED` | redis degradado/down por `OPS_ALERT_INFRA_DEGRADED_MIN_CONSECUTIVE` avaliacoes consecutivas | inbox + push |
| `MAINTENANCE_BYPASS_USED` | bypass de maintenance por `SUPER_ADMIN` | inbox + push |

Configuracoes de ambiente suportadas:

- `OPS_ALERT_5XX_RATE_THRESHOLD`
- `OPS_ALERT_WINDOW_MINUTES`
- `OPS_ALERT_MIN_REQUEST_SAMPLE`
- `OPS_ALERT_ROUTE_LATENCY_MS_THRESHOLD`
- `OPS_ALERT_MIN_ROUTE_SAMPLE`
- `OPS_ALERT_DENIED_SPIKE_THRESHOLD`
- `OPS_ALERT_MIN_DENIED_SAMPLE`
- `OPS_ALERT_JOB_FAILURE_STORM_THRESHOLD`
- `OPS_ALERT_INFRA_DEGRADED_MIN_CONSECUTIVE`
- `OPS_ALERT_COOLDOWN_MINUTES`

Anti-ruido e deduplicacao:

- todos os alertas automaticos passam por cooldown configuravel
- a chave de deduplicacao e estavel por tipo de alerta
- para rota lenta critica, a chave inclui `metodo + rota normalizada`
- rotas internas do proprio painel continuam excluidas da telemetria:
  - `/api/system/dashboard`
  - `/api/system/dashboard/module-cards`
  - `/api/system/dashboard/layout`
  - notificacoes internas e endpoints de health/version/status
- rankings de rota continuam exigindo amostra minima antes de aparecer no dashboard ou alimentar alerta

Politica de canais:

- inbox only:
  - alertas moderados/acionaveis, mas nao urgentes
  - `OPS_CRITICAL_SLOW_ROUTE`
  - `OPS_ACCESS_DENIED_SPIKE`
- inbox + push:
  - alertas criticos selecionados
  - `OPS_HIGH_5XX_ERROR_RATE`
  - `OPS_JOB_FAILURE_STORM`
  - `OPS_DATABASE_DEGRADED`
  - `OPS_REDIS_DEGRADED`
  - `MAINTENANCE_BYPASS_USED`
- sem push:
  - quando a infra atual de Web Push nao estiver configurada ou nao retornar chave publica valida

Auditoria:

- alertas criticos automaticos passam a registrar `AuditLog` com a acao operacional correspondente:
  - `OPS_HIGH_5XX_ERROR_RATE`
  - `OPS_JOB_FAILURE_STORM`
  - `OPS_DATABASE_DEGRADED`
  - `OPS_REDIS_DEGRADED`
- `MAINTENANCE_BYPASS_USED` continua auditado no guard e agora reaproveita o servico central apenas para inbox/push com cooldown

Dashboard:

- nao foi criada tela nova
- o card `Notificacoes Criticas` do dashboard operacional passou a mostrar:
  - `criticalUnread`
  - `criticalRecent`
  - contador de alertas operacionais recentes
  - lista curta dos ultimos alertas operacionais emitidos, alinhada com a mesma janela temporal do contador
- system alerts legados de update/restore agora tambem passam pelo gateway de notificacoes:
  - inbox/realtime para todos
  - push apenas quando a acao estiver na allowlist critica
- o envio de push agora deduplica subscriptions por `endpoint` antes de entregar

Limitacoes assumidas nesta etapa:

- `BACKUP_FAILED` continua inbox only por ser alerta moderado
- `UPDATE_FAILED`, `UPDATE_ROLLED_BACK_AUTO` e `RESTORE_FAILED` entram na politica seletiva de push
- a retencao/cooldown continua em memoria local do processo, com lock advisory para reduzir duplicidade entre instancias

Validacao executada nesta etapa:

- backend
  - `jest` direcionado para:
    - `system-telemetry.service.spec.ts`
    - `system-operational-alerts.service.spec.ts`
    - `maintenance-mode.guard.spec.ts`
    - `system-dashboard.service.spec.ts`
    - `notification.service.spec.ts`
- frontend
  - `eslint` do `OperationalDashboard.tsx`

### Etapa 8.2 - Calibracao final de thresholds, cooldown e ruido operacional

Tabela final dos alertas ativos:

| Alerta | Threshold | Janela | Amostra minima | Cooldown | Canal |
| --- | --- | --- | --- | --- | --- |
| `OPS_HIGH_5XX_ERROR_RATE` | `10%` de `5xx` | `5 min` | `25 requests` | `15 min` | inbox + push |
| `OPS_CRITICAL_SLOW_ROUTE` | `1500 ms` de media | `5 min` | `8 requests na rota` | `15 min` | inbox |
| `OPS_ACCESS_DENIED_SPIKE` | `15` eventos negados | `5 min` | `12 eventos` | `15 min` | inbox |
| `OPS_JOB_FAILURE_STORM` | `4` falhas de job | `5 min` | `4 falhas` | `15 min` | inbox + push |
| `OPS_DATABASE_DEGRADED` | `status degraded/error` | `3 verificacoes consecutivas` | `3 checks` | `15 min` | inbox + push |
| `OPS_REDIS_DEGRADED` | `status degraded/down` | `3 verificacoes consecutivas` | `3 checks` | `15 min` | inbox + push |
| `MAINTENANCE_BYPASS_USED` | evento imediato | n/a | n/a | `15 min` | inbox + push |
| `UPDATE_FAILED` | legado orientado a evento | n/a | n/a | `15 min` na entrega | inbox + push |
| `UPDATE_ROLLED_BACK_AUTO` | legado orientado a evento | n/a | n/a | `15 min` na entrega | inbox + push |
| `RESTORE_FAILED` | legado orientado a evento | n/a | n/a | `15 min` na entrega | inbox + push |

Calibracao aplicada:

- `OPS_HIGH_5XX_ERROR_RATE`
  - subiu de `5%` para `10%`
  - a amostra minima caiu de `30` para `25`, mantendo sensibilidade para ambiente com trafego moderado sem disparar com `2/25`
- `OPS_CRITICAL_SLOW_ROUTE`
  - manteve o limiar de `1500 ms`
  - exigencia de volume subiu para `8` requests da mesma rota normalizada
- `OPS_ACCESS_DENIED_SPIKE`
  - passou para `15` eventos com amostra minima de `12`
  - permanece inbox only para evitar ruido de push em seguranca moderada
- `OPS_JOB_FAILURE_STORM`
  - subiu de `3` para `4` falhas
  - reduz falso positivo em falhas isoladas sem esconder sequencia real
- `OPS_DATABASE_DEGRADED` / `OPS_REDIS_DEGRADED`
  - mantidos em `3` verificacoes consecutivas
  - continuam reemitindo apenas depois do cooldown se a condicao persistir

Politica final de push:

- somente estes eventos geram push:
  - `OPS_HIGH_5XX_ERROR_RATE`
  - `OPS_JOB_FAILURE_STORM`
  - `OPS_DATABASE_DEGRADED`
  - `OPS_REDIS_DEGRADED`
  - `UPDATE_FAILED`
  - `UPDATE_ROLLED_BACK_AUTO`
  - `RESTORE_FAILED`
  - `MAINTENANCE_BYPASS_USED`
- eventos moderados continuam inbox only:
  - `OPS_CRITICAL_SLOW_ROUTE`
  - `OPS_ACCESS_DENIED_SPIKE`
  - `BACKUP_FAILED`

Deduplicacao e cooldown:

- cooldown continua por chave estavel no avaliador operacional
- `OPS_CRITICAL_SLOW_ROUTE` usa chave por `metodo + rota normalizada`
- servicos degradados usam chave separada por `database` e `redis`
- system alerts legados criticos agora tambem passam por cooldown de entrega de `15 min`
- push segue deduplicado por `endpoint`, preservando entrega por dispositivo legitimo sem multiplicar envios para o mesmo endpoint cadastrado mais de uma vez

Dashboard:

- `operationalRecentCount` e `recentOperationalAlerts` continuam usando a mesma janela temporal
- a lista permanece curta (`3` itens) e ordenada por `createdAt desc`
- o card continua sem UI nova, apenas com feed operacional curto

Limitacao conhecida mantida:

- ainda nao existe estado `resolved`
- problemas continuos podem reemitir apos cada cooldown, o que e desejado nesta etapa, mas um ciclo de resolucao/ack permanece como melhoria futura

### Etapa 8.3 - Diagnostico do scheduler, heartbeat e watchdog de jobs

Fonte de verdade final dos jobs:

- a fonte de verdade do agendamento editavel passou a ser `cron_schedules`
- todos os jobs ativos do sistema agora se registram no `CronService`
- a tela `/configuracoes/sistema/cron` e o endpoint `GET /api/cron/runtime` passam a refletir o runtime real
- alteracoes de cron ou enable/disable continuam aplicadas em quente, sem restart

Divergencia corrigida:

- antes desta etapa havia duas excecoes fora do scheduler dinamico:
  - `system_operational_alerts_evaluator`
  - `cleanup-expired-tokens`
- ambos estavam em `@Cron(...)`, logo:
  - nao apareciam corretamente na tela
  - nao obedeciam o cron salvo em `cron_schedules`
  - nao tinham status/heartbeat unificado
- agora esses jobs tambem usam `CronService.register(...)`

Inventario atual dos jobs operacionais:

| Job | Fonte atual | Cron salvo em tela? | Cron aplicado em runtime? | Ultima execucao visivel? | Problema encontrado |
| --- | --- | --- | --- | --- | --- |
| `system.backup_auto_create` | `BackupCronService -> CronService.register` | sim | sim | sim | sem divergencia apos unificacao |
| `system.backup_retention` | `BackupCronService -> CronService.register` | sim | sim | sim | sem divergencia apos unificacao |
| `system.update_check` | `UpdateCronService -> CronService.register` | sim | sim | sim | ajustado para marcar `origin=core` e usar a tela de cron |
| `system.log_cleanup` | `UpdateCronService -> CronService.register` | sim | sim | sim | ajustado para marcar `origin=core` e usar a tela de cron |
| `system.system_data_retention` | `SystemDataRetentionService -> CronService.register` | sim | sim | sim | sem divergencia apos unificacao |
| `system.operational_alerts_evaluator` | `SystemOperationalAlertsService -> CronService.register` | sim | sim | sim | antes estava hardcoded em `@Cron`, fora da tela |
| `system.token_cleanup` | `TokenCleanupService -> CronService.register` | sim | sim | sim | antes estava hardcoded em `@Cron`, fora da tela |
| `system.job_watchdog_evaluator` | `SystemJobWatchdogService -> CronService.register` | sim | sim | sim | novo job central de watchdog |

Heartbeat persistido:

- foi criada a tabela `cron_job_heartbeats`
- cada job importante registra:
  - `jobKey`
  - `lastStartedAt`
  - `lastSucceededAt`
  - `lastFailedAt`
  - `lastDurationMs`
  - `lastStatus`
  - `lastError`
  - `nextExpectedRunAt`
  - `consecutiveFailureCount`
  - `updatedAt`
- o `CronService` atualiza esse heartbeat em:
  - registro/rebind do job
  - execucao agendada
  - trigger manual
  - enable/disable

Watchdog de jobs:

- foi adicionado `SystemJobWatchdogService`
- ele roda a cada minuto como job do proprio `CronService`
- usa o runtime real do scheduler para detectar:
  - `JOB_NOT_RUNNING`
    - job habilitado mas nao registrado no runtime
    - ou `nextExpectedRunAt` ultrapassado alem da tolerancia
  - `JOB_STUCK_RUNNING`
    - job em `running` por tempo acima do aceitavel
  - `JOB_REPEATED_FAILURES`
    - falhas consecutivas acima de `CRON_WATCHDOG_REPEATED_FAILURE_THRESHOLD`
- a tolerancia de atraso/travamento e derivada do intervalo do cron:
  - atraso: entre `5 min` e `12 h`
  - travamento: entre `10 min` e `6 h`
  - cada job ainda pode sobrescrever isso via metadata no registro
- o watchdog nao avalia durante `pauseAllForMaintenance()`, evitando falso positivo em restore/maintenance controlada

Politica de alerta do watchdog:

| Alerta | Regra | Canal | Cooldown |
| --- | --- | --- | --- |
| `JOB_NOT_RUNNING` | job habilitado sem runtime ou atrasado alem da tolerancia | inbox + push | `OPS_ALERT_COOLDOWN_MINUTES` |
| `JOB_STUCK_RUNNING` | job ficou em `running` por tempo anormal | inbox + push | `OPS_ALERT_COOLDOWN_MINUTES` |
| `JOB_REPEATED_FAILURES` | `consecutiveFailureCount >= CRON_WATCHDOG_REPEATED_FAILURE_THRESHOLD` | inbox | `OPS_ALERT_COOLDOWN_MINUTES` |

Tela `/configuracoes/sistema/cron`:

- agora consome `GET /api/cron/runtime`
- exibe por job:
  - cron configurado
  - ativo/pausado
  - status atual (`aguardando`, `executando`, `sucesso`, `falhou`)
  - ultima execucao
  - ultimo sucesso
  - ultima falha
  - duracao/heartbeat
  - proxima execucao
  - proximo horario esperado
  - origem da configuracao
  - divergencia de runtime, quando existir
- `GET /api/cron/runtime` ficou disponivel para `ADMIN` e `SUPER_ADMIN`
- `GET /api/cron`, `PUT /api/cron/:key/toggle`, `PUT /api/cron/:key/schedule` e `POST /api/cron/:key/trigger` continuam `SUPER_ADMIN`
- o watchdog agora reutiliza a mesma trilha operacional de inbox/push/cooldown dos alertas automaticos gerais, sem manter um segundo pipeline paralelo

Observabilidade e diagnostico:

- se um job estiver salvo no banco e nao tiver callback registrado, ele aparece como `Sem runtime`
- se um job falhar ou travar, o inbox operacional passa a receber alerta watchdog na mesma trilha de alertas operacionais
- `recentOperationalAlerts` do dashboard continua coerente, porque os alertas do watchdog entram como `module = operational-alerts` com `source = job-watchdog`

Validacao executada nesta etapa:

- backend
  - `pnpm -C apps/backend exec jest src/core/cron/cron.service.spec.ts src/core/cron/cron.controller.spec.ts src/common/services/token-cleanup.service.spec.ts src/common/services/system-operational-alerts.service.spec.ts src/common/services/system-job-watchdog.service.spec.ts src/retention/system-data-retention.service.spec.ts --runInBand`
  - `pnpm -C apps/backend test:smoke`
  - `pnpm -C apps/backend exec nest build`
- frontend
  - `pnpm -C apps/frontend exec eslint src/app/configuracoes/sistema/cron/page.tsx`
  - `pnpm -C apps/frontend build`

## Etapa 8.4 - Refinar a UX da tela de tarefas agendadas

Objetivo desta rodada:

- deixar a tela `/configuracoes/sistema/cron` mais administrativa e menos tecnica
- substituir a linguagem visivel de `Job` por `Tarefa`
- reduzir ruido visual sem perder detalhes operacionais

Padrao visual aplicado:

- nomes amigaveis em portugues sao resolvidos por chave tecnica no frontend
- descricoes longas saem da lista principal e passam a aparecer em popover de informacao
- a lista principal mostra:
  - nome amigavel
  - status ativo/inativo
  - estado de execucao
  - situacao do runtime
  - cronograma amigavel
  - ultima execucao / ultimo sucesso / ultima falha
  - proxima execucao / proximo horario esperado
  - duracao / falhas seguidas / chave tecnica

Edicao de tarefa:

- o botao textual `Editar` foi removido da lista
- a engrenagem virou a unica entrada para editar a tarefa
- a edicao passou a usar modal dedicado
- o modal mostra:
  - nome amigavel
  - chave tecnica somente leitura
  - status ativo/inativo
  - modo simplificado de cron
  - modo avancado para expressao manual
  - preview da expressao final
  - descricao amigavel final
  - proxima execucao estimada quando o cron e interpretavel com seguranca

Modo simplificado suportado:

- a cada X minutos
- a cada X horas
- todo dia em um horario
- toda semana em um dia e horario
- todo mes em um dia e horario

Fallbacks e limitacoes:

- cronogramas mais complexos continuam suportados no modo avancado
- quando a expressao nao pode ser interpretada com seguranca, a lista mostra `Cronograma personalizado`
- o nome amigavel continua sendo controlado por mapa de apresentacao; o `jobKey` permanece como fonte tecnica interna

## Etapa 9 - Pagina de diagnostico operacional unificada

Objetivo desta rodada:

- consolidar estado operacional relevante em uma unica pagina administrativa
- reaproveitar dashboard, cron runtime, update, backup/restore, auditoria e notificacoes
- auditar a funcionalidade de logs existente antes de criar qualquer pagina paralela

Inventario reaproveitado:

| Bloco | Ja existe? | Endpoint atual | Tela atual | Reaproveitavel? | Falta o que? |
| --- | --- | --- | --- | --- | --- |
| Saude geral | sim | `/api/system/dashboard` | `/dashboard` | sim | consolidacao em pagina unica |
| Maintenance | sim | `/api/system/dashboard` | `/dashboard` | sim | resumo administrativo |
| Cron runtime | sim | `/api/cron/runtime` | `/configuracoes/sistema/cron` | sim | resumo e link rapido |
| Heartbeat jobs | sim | `/api/cron/runtime` | `/configuracoes/sistema/cron` | sim | agregacao de tarefas problematicas |
| Ultimo update | sim | `/api/system/update/status` | `/configuracoes/sistema/updates` | sim | resumo curto |
| Ultimo rollback | sim | `/api/system/update/log` | `/configuracoes/sistema/updates` | sim | resumo curto |
| Ultimo backup | sim | endpoints de backup | `/configuracoes/sistema/updates` | sim | consolidacao |
| Ultimo restore | sim | endpoints de backup | `/configuracoes/sistema/updates` | sim | consolidacao |
| Alertas operacionais | sim | `/api/system/dashboard` + notificacoes | dashboard/inbox | sim | agrupamento unico |
| Auditoria | sim | `/api/system/audit` e `/api/audit-logs` | `/logs` | sim | separar escopo por role |
| Logs tecnicos | parcialmente | base de auditoria existente | `/logs` | parcialmente | ainda nao existe storage generico de runtime logs |

Decisao sobre logs:

- nao foi criada uma segunda pagina de logs
- a rota existente `/logs` foi reaproveitada e ajustada
- `SUPER_ADMIN` continua usando auditoria completa via `/api/audit-logs`
- `ADMIN` agora usa auditoria operacional resumida via `/api/system/audit`
- a pagina de logs recebeu correcoes de runtime:
  - fonte de dados estabilizada para evitar refetch em loop
  - filtros passaram a usar estado aplicado, sem busca a cada tecla
  - datas passaram a considerar o dia inteiro (`00:00:00.000` ate `23:59:59.999`)
  - o endpoint completo de auditoria voltou a exigir `JwtAuthGuard`

Nova pagina:

- rota: `/configuracoes/sistema/diagnostico`
- acesso: `ADMIN` e `SUPER_ADMIN`
- endpoint agregado: `GET /api/system/diagnostics`

Blocos expostos:

- estado geral derivado:
  - `healthy`
  - `attention`
  - `critical`
- panorama operacional resumido
- scheduler / tarefas criticas com link para cron
- update / rollback com link para updates
- backup / restore com ultimo estado conhecido
- alertas operacionais recentes
- auditoria recente relevante
- resumo sobre disponibilidade de logs tecnicos

Regra do estado geral:

- `healthy`
  - sem maintenance ativo
  - sem falha critica recente
  - sem tarefa critica travada ou atrasada
- `attention`
  - maintenance ativo
  - warnings recentes
  - degradacao operacional sem falha critica aberta
- `critical`
  - falha critica recente de update/restore/backup
  - alerta operacional critico recente
  - tarefa critica travada, sem runtime ou falhando repetidamente

Limitacoes conhecidas:

- a secao de logs tecnicos ainda depende da base de auditoria existente
- ainda nao existe persistencia geral de runtime logs com stack traces completos
- a pagina de diagnostico resume e linka; nao duplica a inbox nem a auditoria completa

Validacao executada nesta etapa:

- backend
  - `pnpm -C apps/backend exec jest src/diagnostics/system-diagnostics.service.spec.ts src/diagnostics/system-diagnostics.controller.spec.ts src/audit/system-audit.controller.spec.ts src/audit/audit.controller.spec.ts --runInBand`
  - `pnpm -C apps/backend test:smoke`
  - `pnpm -C apps/backend exec nest build`
- frontend
  - `pnpm -C apps/frontend test -- src/app/logs/logs.utils.test.ts src/app/configuracoes/sistema/diagnostico/diagnostics.utils.test.ts`
  - `pnpm -C apps/frontend exec eslint src/app/logs/page.tsx src/app/logs/logs.utils.ts src/app/logs/logs.utils.test.ts`

## Auditoria de consistencia operacional - navegacao e estados visuais

Objetivo desta verificacao:

- mapear se as telas operacionais/admin estao organizadas de forma logica
- identificar sobreposicoes entre dashboard, diagnostico, logs, auditoria e notificacoes
- inventariar os estados visuais usados hoje e apontar onde ha divergencia
- preparar uma recomendacao clara para a proxima etapa, sem refatoracao grande agora

### Parte 1 - Organizacao da UI, rotas e menu

#### Inventario das telas operacionais reais

| Tela | Rota | Papel principal | Role efetiva | Redundancia/confusao? | Observacao |
| --- | --- | --- | --- | --- | --- |
| Dashboard | `/dashboard` | entrada principal da plataforma; cards de modulos e, para `SUPER_ADMIN`, resumo operacional recolhido | autenticado (`SUPER_ADMIN`, `ADMIN`, `USER`, `CLIENT`) | parcial | para `SUPER_ADMIN` ele tambem virou ponto de acesso a operacao, mas nao e a melhor tela para triagem tecnica profunda |
| Diagnostico operacional | `/configuracoes/sistema/diagnostico` | leitura unificada do estado do sistema, tarefas, updates, backup/restore, alertas, auditoria e logs reaproveitados | `ADMIN`, `SUPER_ADMIN` | parcial com dashboard operacional | hoje esta mais proximo da funcao de "estado atual do sistema" do que o proprio dashboard |
| Tarefas agendadas / Cron | `/configuracoes/sistema/cron` | runtime das tarefas, heartbeat, watchdog e edicao de cronograma | menu: `SUPER_ADMIN`; backend runtime: `ADMIN`/`SUPER_ADMIN`; mutacoes: `SUPER_ADMIN` | baixa | a pagina nao esta protegida no frontend por role; um `ADMIN` pode chegar nela por URL e ver parte da tela, mas recebe `403` nas acoes mutaveis |
| Atualizacoes | `/configuracoes/sistema/updates` | update/deploy, status do sistema, configuracao do repositorio, historico de update | menu: `SUPER_ADMIN`; backend `status` responde para autenticado; mutacoes `SUPER_ADMIN` | media | concentra update e ainda abriga backup/restore, misturando duas responsabilidades operacionais diferentes |
| Backup / Restore | `/configuracoes/sistema/updates?tab=backup` | operacoes de backup, restore e historico correlato | `SUPER_ADMIN` na pratica | alta | nao ha rota propria; operacionalmente e uma area distinta, mas aparece como aba de Updates |
| Logs | `/logs` | listagem de auditoria reaproveitada com escopo por role | `SUPER_ADMIN` usa auditoria completa; `ADMIN` usa auditoria do sistema | alta | o nome "Logs" sugere log tecnico, mas a base atual e auditoria/eventos; nao existe menu visivel para chegar aqui |
| Auditoria | sem rota dedicada no frontend | historico de acoes administrativas e operacionais persistidas | `ADMIN`/`SUPER_ADMIN` via `/logs`, resumos em diagnostico | alta | hoje nao existe uma tela separada chamada "Auditoria"; o conceito foi absorvido por `/logs` e pelo diagnostico |
| Notificacoes | `/notifications` | inbox persistida de alertas do sistema | `SUPER_ADMIN` | media | a rota existe, mas o acesso principal e pelo sino/drawer no topo; nao aparece no sidebar nem na tela de configuracoes |

#### Estrutura atual do menu

Leitura do menu hoje:

- `Sidebar` principal:
  - `Dashboard`
  - grupo `Administracao`
    - `Empresas`
    - `Usuarios`
    - `Configuracoes`
- dentro de `Configuracoes`:
  - `Diagnostico Operacional`
  - `Sistema de Updates`
  - `Agendamento de Tarefas`
  - demais telas administrativas
- `Notificacoes`:
  - acesso principal pelo sino no `TopBar`
  - pagina `/notifications` abre como "central", mas nao existe entrada dedicada no menu
- `Logs`:
  - sem entrada no sidebar
  - sem entrada na tela hub de `Configuracoes`
  - acesso indireto via links do diagnostico e navegacao manual

O que ja esta consistente:

- existe um eixo administrativo coerente em `Configuracoes > Sistema`
- `Diagnostico`, `Cron` e `Updates` estao agrupados dentro da mesma familia de telas
- `Dashboard` ficou como porta de entrada geral da plataforma, sem obrigar todo usuario a entrar em operacao

O que esta confuso ou redundante:

- `Dashboard` e `Diagnostico` ainda se sobrepoem para `SUPER_ADMIN`
  - o dashboard operacional mostra estado atual e alertas
  - o diagnostico tambem mostra estado atual, so que de forma mais consolidada e administrativa
- `Backup / Restore` estar dentro de `Updates` embaralha a navegacao
  - update/deploy e backup/restore sao operacoes diferentes
  - hoje o usuario precisa saber da aba correta, nao da funcao
- `Logs` nao e uma tela facil de descobrir
  - a rota existe
  - o nome sugere log tecnico generico
  - na pratica ela mostra auditoria/eventos, nao um sistema geral de runtime logs
- `Auditoria` nao existe como rotulo/rota explicita no frontend
  - conceitualmente o sistema tem auditoria
  - visualmente o admin procura "logs", mas encontra uma visao de auditoria
- `Notificacoes` tem boa UX de atalho rapido no topo, mas baixa descoberta como area historica
  - o drawer funciona bem para consumo rapido
  - a pagina completa fica escondida para quem nao souber que existe
- ha pequena divergencia entre UI e backend em algumas telas operacionais
  - `Cron`: backend runtime permite `ADMIN`, mas a UI foi desenhada como tela de `SUPER_ADMIN`
  - `Updates`: a rota nao esta protegida por `ProtectedRoute`, embora as mutacoes sejam `SUPER_ADMIN`

#### Clareza de responsabilidade por tela

Pergunta operacional | Tela que hoje melhor responde | Leitura da clareza atual
--- | --- | ---
`Qual e o estado atual do sistema?` | `/configuracoes/sistema/diagnostico` | razoavelmente claro para admin; ainda concorre com o dashboard operacional do `SUPER_ADMIN`
`Quais tarefas agendadas estao com problema?` | `/configuracoes/sistema/cron` | claro
`Onde vejo falhas tecnicas e eventos de sistema?` | `/logs` | pouco claro, porque o nome da rota sugere log tecnico, mas o conteudo e auditoria/eventos reaproveitados
`Onde vejo historico de acoes administrativas?` | `/logs` | pouco obvio; falta o rotulo "Auditoria"
`Onde vejo alertas recentes?` | drawer de notificacoes e `/notifications` | claro para `SUPER_ADMIN`, pouco descobrivel na navegacao estrutural

Diagnostico final da arquitetura de navegacao:

- o sistema ja tem as pecas certas
- a principal fragilidade nao e falta de tela, e sim semantica/navegacao:
  - `Dashboard` e `Diagnostico` ainda disputam a ideia de "visao operacional"
  - `Logs` agrega auditoria sem se chamar auditoria
  - `Backup / Restore` ficou escondido dentro de `Updates`
  - `Notificacoes` depende mais do atalho do topo do que de uma IA de menu clara

#### Recomendacao de agrupamento/menu para a proxima etapa

Sem implementar agora, a recomendacao mais limpa e:

- `Dashboard`
  - papel: entrada geral da plataforma e cards de modulos
  - operacional: manter apenas resumo/atalho, nao competir com diagnostico
- `Configuracoes > Sistema`
  - `Diagnostico Operacional`
    - tela canonica para "estado atual do sistema"
  - `Tarefas Agendadas`
    - cron, heartbeat e watchdog
  - `Atualizacoes`
    - update/deploy
  - `Backups e Restore`
    - idealmente com entrada propria, mesmo se continuar usando a mesma rota com `tab=backup`
  - `Auditoria e Logs`
    - renomear ou pelo menos expor `/logs` com semantica correta
  - `Notificacoes`
    - manter sino/drawer, mas com entrada secundaria visivel para historico completo

### Parte 2 - Auditoria da padronizacao visual de estados e status

#### Inventario dos estados visuais encontrados

| Estado / conceito | Label exibida hoje | Cor predominante | Icone / sinal | Onde aparece | Consistente? |
| --- | --- | --- | --- | --- | --- |
| healthy / success operacional | `Saudavel`, `Ok`, `Sucesso` | verde | variavel | dashboard, diagnostico, updates, restore | parcial |
| attention / warning | `Atencao`, `Warning`, `Parcial` | amarelo / amber | alerta | diagnostico, notificacoes, maintenance, erros parciais | parcial |
| degraded | `Degradado` | amber no dashboard | sem icone fixo | dashboard operacional | nao |
| critical / failed / error | `Critica`, `Falhou`, `Indisponivel` | vermelho / rose | alerta, x, badge destructive | notificacoes, cron, updates, restore, dashboard | parcial |
| running | `Executando`, `Em andamento` | cinza no cron, azul em updates/restore | spinner / play | cron, updates, restore | nao |
| idle / waiting | `Aguardando`, `Sem leitura`, `Sem dados` | cinza / slate | neutro | cron, dashboard, diagnostico | parcial |
| active / inactive | `Ativa`, `Pausada`, `Ativo`, `Inativo` | default/secondary/cinza ou amber | switch/badge | cron, diagnostico, maintenance, updates | nao |
| maintenance | `Sistema em manutencao`, `Ativo` | amber | `AlertTriangle`, `Wrench` | banner global, updates, dashboard, diagnostico | nao |
| notification severity | `Informativa`, `Warning`, `Critica` | azul / amber / vermelho | `CheckCircle2`, `AlertTriangle`, `AlertCircle` | drawer e pagina de notificacoes | sim, dentro da propria feature |
| empty / no data | `Sem dados`, `Sem leitura`, `Nenhum registro`, `Nenhuma notificacao` | cinza / slate | componente comum em parte da UI | dashboard, diagnostico, logs, notifications | parcial |

#### O que ja esta centralizado

- `DashboardMetricState` e `DashboardSurfaceState`
  - centralizam `Sem dados`, `Indisponivel` e `Degradado` no dashboard e em partes do shell principal
- `diagnostics.utils.ts`
  - centraliza o badge do nivel geral (`healthy`, `attention`, `critical`) e o estado de bloco (`ok`, `error`)
- `cron-task.utils.ts`
  - centraliza o nome amigavel e descricao das tarefas
- `SystemNotificationsList`
  - centraliza bem a severidade de notificacoes dentro da propria feature

#### Onde os componentes ainda divergem

- `Updates` e `Backup/Restore`
  - usam pills e blocos manuais com `bg-green-500`, `bg-red-500`, `bg-yellow-500`, `bg-blue-100` etc.
  - nao reaproveitam `Badge`/`DashboardSurfaceState` com uma semantica unica
- `Cron`
  - usa `Badge` do shadcn com combinacao de `outline`, `secondary` e `destructive`
  - visualmente conversa com o sistema, mas nao casa 1:1 com `DashboardMetricState`
- `Logs`
  - coloriza por sufixo da acao (`SUCCESS`, `FAILED`, `UPDATE`, `DELETE`) e nao por severidade real
  - isso e util para leitura rapida, mas foge do vocabulario de status usado nas outras telas
- `Diagnostico`
  - trata erro de bloco como `Parcial` em amarelo
  - no dashboard, erro operacional costuma ir para `Indisponivel` em rose/vermelho
- `Maintenance`
  - hoje usa amber/amarelo em banner e updates
  - visualmente se confunde com `warning/attention`, sem identidade propria

#### Inconsistencias visuais objetivas

- `Degradado` nao tem uma identidade propria consistente
  - hoje no dashboard ele cai em amber
  - em outras telas o conceito muitas vezes vira apenas `Parcial` ou `Warning`
- `Maintenance` esta visualmente proximo demais de `warning`
  - para leitura operacional, o estado de manutencao e especial e nao deveria disputar o mesmo codigo visual de atencao generica
- `Running` muda demais de tela para tela
  - `Cron`: badge neutra/secondary
  - `Updates`: pill azul
  - `Restore`: bloco colorido com spinner
- `Success` e `Healthy` estao semanticamente proximos, mas visualmente variam entre
  - verde forte solido
  - outline neutra
  - verde pastel
- `Logs` usa classificacao por acao, nao por severidade
  - isso e aceitavel tecnicamente, mas aumenta a percepcao de "carnaval visual" quando comparado com notificacoes, cron e diagnostico
- `Warning` aparece como `Warning`, `Atencao` e `Parcial`
  - mesma camada semantica, tres labels diferentes

#### Leitura de legibilidade e ruido visual

O que esta bom:

- dashboard e diagnostico ja reduziram bastante o ruido com cards mais limpos
- notificacoes estao bem hierarquizadas por severidade
- cron esta mais administrativo e menos tecnico do que antes

Onde ainda ha cansaco visual:

- `Updates` e `Backup/Restore` concentram a maior parte do ruido
  - muitas cores fortes
  - muitos blocos informativos com estilos diferentes
  - badges e alert boxes sem uma base visual comum
- a mistura de azul, verde, amarelo e vermelho forte em poucas areas cria mais variacao do que o necessario
- `Logs` ainda parece uma tela de apoio, nao uma tela integrada ao sistema visual operacional

#### Padrao recomendado para a proxima etapa

Sem implementar agora, o padrao mais previsivel seria:

- `healthy` / `success`
  - verde
- `attention` / `warning`
  - amarelo
- `degraded`
  - laranja
- `critical` / `failed` / `error`
  - vermelho
- `maintenance`
  - azul
- `inactive` / `disabled` / `idle`
  - cinza
- `running`
  - azul neutro consistente

Regras de componente recomendadas:

- usar um unico componente de status pill/badge para severidade e runtime state
- deixar `DashboardSurfaceState` como base tambem para algumas telas administrativas
- separar claramente:
  - status de severidade
  - status de execucao
  - status de disponibilidade

Resumo final da auditoria:

- a arquitetura operacional ja esta funcional, mas ainda com semantica difusa entre `Dashboard`, `Diagnostico`, `Logs` e `Notificacoes`
- o maior ganho da proxima etapa nao sera criar tela nova; sera:
  - explicitar melhor a navegacao
  - dar nome correto a `/logs` versus auditoria
  - reduzir a sobreposicao entre `Dashboard` e `Diagnostico`
  - unificar visualmente `warning`, `degraded`, `maintenance`, `running` e `failed`
