# Backup & Restore (NestJS) - Arquitetura

## Contexto atual
- Operacoes antigas estavam em `/api/backup/*` e dependiam de scripts externos `install/restore-*.sh`.
- Restore sincrono podia travar fluxo HTTP e afetar disponibilidade.
- Era necessario mover orquestracao para backend, manter backend vivo e adicionar historico/lock/job assincrono.

## Opcoes de fila consideradas
1. BullMQ (Redis):
   - Pros: retries avancados, prioridade, observabilidade pronta, multiplos workers.
   - Contras: dependencia adicional e acoplamento forte com Redis para restore critico.
2. Fila em banco (padrao adotado):
   - Pros: sem nova dependencia, estado transacional junto ao historico (`backup_jobs`), rollout simples.
   - Contras: throughput menor e menos recursos nativos de retry.

Fallback recomendado: se o volume de jobs crescer muito, migrar runner para BullMQ mantendo contrato HTTP e tabelas de auditoria.

## Estrategia de restore adotada
Opcao A: **staging database + promocao/swap**.

Fluxo:
1. Validar arquivo, assinatura e checksum.
2. Gerar `pg_restore --list` e bloquear objetos perigosos por padrao (override manual com `allowUnsafeObjects=true`).
3. Restaurar dump em database staging isolado.
4. Validar staging (conectividade + tabelas minimas + integridade).
5. Criar safety backup do banco ativo.
6. Ativar modo manutencao (backend vivo, healthcheck ok).
7. Pausar schedulers/cron e fazer quiesce real do Prisma (`disconnect`).
8. Promover staging por rename/swap de databases (sem restore destrutivo no DB principal).
9. Reconectar Prisma, executar smoke tests e opcionalmente `prisma migrate deploy`.
10. Desativar manutencao e retomar cron.

Rollback de promocao:
- Mantem referencia do DB anterior (`rollbackDatabase`).
- Se smoke/promo falhar, reverte rename para voltar rapidamente ao DB anterior.

## Active database e DSN
- O backend usa `activeDatabaseName` para compor DSN operacional (`buildDatabaseUrl`).
- Estado `activeDatabaseName` e persistido em arquivo local (`active-db-state.json`) no diretorio de backup.
- Em runtime de cutover por swap, o nome ativo permanece estavel para o app, com reconnect controlado do Prisma.

## Diagrama textual
```text
UI (/configuracoes/sistema/updates)
  -> POST /api/backups                      (cria job BACKUP PENDING)
  -> POST /api/backups/upload               (valida + registra artifact)
  -> POST /api/backups/:id/restore          (cria job RESTORE PENDING)
  -> GET  /api/backups/jobs/:jobId          (polling de status/logs/progresso)

BackupsController
  -> BackupService (enqueue/list/upload/validacao/autorizacao)
  -> BackupJobRunnerService (poll da fila em DB)
      -> BackupLockService (lease global com TTL)
      -> BackupProcessService (spawn pg_dump/pg_restore/psql sem shell)
      -> BackupRuntimeStateService (modo manutencao)
      -> CronService (pause/resume de schedulers no cutover)

Persistencia
  - backup_artifacts (metadados do arquivo)
  - backup_jobs      (status e progresso)
  - backup_leases    (lock global backup/restore)
```

## Modelo de dados (Prisma)
- `BackupArtifact`
  - `id`, `fileName`, `filePath`, `sizeBytes`, `checksumSha256`, `source`
  - `metadata`, `createdAt`, `deletedAt`, `createdByUserId`
- `BackupJob`
  - `id`, `type(BACKUP|RESTORE)`, `status(PENDING|RUNNING|SUCCESS|FAILED|CANCELED)`
  - `artifactId`, `fileName`, `filePath`, `sizeBytes`, `checksumSha256`
  - `progressPercent`, `currentStep`, `metadata`, `logs`, `error`
  - `startedAt`, `finishedAt`, `cancelRequested`, `createdByUserId`, `createdAt`
- `BackupLease`
  - `key`, `holderJobId`, `operationType`, `acquiredAt`, `expiresAt`, `metadata`

## Invariantes de seguranca aplicadas
- Apenas `SUPER_ADMIN` pode executar endpoints (`JwtAuthGuard` + `RolesGuard`).
- Validacao adicional: SUPER_ADMIN de tenant nao-master e bloqueado para restore global.
- Upload aceita apenas `.dump/.backup` com assinatura `PGDMP`.
- Nome/caminho sanitizado (sem path traversal).
- Sem execucao arbitraria: comandos via `spawn(command, args)` sem shell.
- Senha nao e logada (uso de `PGPASSWORD` no env do processo).
- Lock global impede backup e restore simultaneos.
- Modo manutencao durante cutover evita trafego concorrente de rotas de negocio.
- Prisma entra em quiesce antes da promocao (pool fechado).

## Scripts operacionais legados
`install/restore-db.sh` e `install/restore-native.sh` foram mantidos como wrappers:
- chamam API interna localhost (`/api/backups/internal/restore-by-file`)
- fazem polling de status (`/api/backups/internal/jobs/:jobId`)
- nao executam `pg_restore` direto no DB principal.

## Plano de migracao gradual
1. Fase 1 (compatibilidade): manter endpoints antigos `/api/backup/*` como bridge para novo servico.
2. Fase 2: frontend migrado para `/api/backups/*` e polling de jobs.
3. Fase 3: wrappers legados passam a ser apenas clientes da API interna.
4. Fase 4: opcionalmente descontinuar endpoints legados `/api/backup/*`.

## Checklist de confiabilidade
- Timeout configuravel (`BACKUP_JOB_TIMEOUT_SECONDS`).
- Lock/lease com TTL (`BACKUP_LEASE_SECONDS`) e heartbeat.
- Logs persistidos por job (`backup_jobs.logs`).
- Retencao configuravel (`BACKUP_RETENTION_COUNT`).
- Safety backup antes de promocao.
- Estado de manutencao exposto via `/api/backups/maintenance/state`.
- Endpoints internos de operacao com token (`BACKUP_INTERNAL_API_TOKEN`).
- Guard interno valida origem por `socket.remoteAddress` + CIDR allowlist (`BACKUP_INTERNAL_ALLOWED_CIDRS`).
- `X-Forwarded-For` e ignorado por padrao e so entra no calculo quando
  `BACKUP_INTERNAL_TRUST_PROXY=true` e o proxy remoto estiver em
  `BACKUP_INTERNAL_TRUSTED_PROXY_CIDRS`.

## Envs P0 (staging/prod)
- `BACKUP_INTERNAL_API_TOKEN` (obrigatorio para endpoint interno)
- `BACKUP_INTERNAL_ALLOWED_CIDRS` (default recomendado: `127.0.0.1/32,::1/128`)
- `BACKUP_INTERNAL_TRUST_PROXY` (default `false`; ligar somente com proxy interno confiavel)
- `PRISMA_RECONNECT_TIMEOUT_MS` (default `60000`)
- `PRISMA_RECONNECT_BACKOFF_MS` (default `1000`)
- `BACKUP_LOCK_BACKOFF_BASE_MS` (default `1000`)
- `BACKUP_LOCK_BACKOFF_MAX_MS` (default `30000`)
- `BACKUP_LOCK_MAX_ATTEMPTS` (default `30`)

## Runbook minimo - Restore em Staging (Opcao A)
1. Pre-check:
   - DB/Redis saudaveis (`docker compose ps` ou checks equivalentes).
   - `BACKUP_INTERNAL_API_TOKEN` setado.
   - CIDR allowlist validada (`BACKUP_INTERNAL_ALLOWED_CIDRS`).
2. Aplicar migracoes antes do deploy:
   - `pnpm -C apps/backend exec prisma migrate deploy --schema prisma/schema.prisma`
   - ou `docker compose exec backend pnpm exec prisma migrate deploy --schema prisma/schema.prisma`
3. Validar endpoint interno:
   - `POST /api/backups/internal/restore-by-file` com payload permitido:
     `backupFile`, `runMigrations`, `reason`.
   - `GET /api/backups/internal/jobs/:jobId` para polling.
4. Restore pequeno de prova:
   - disparar job, acompanhar ate `SUCCESS`, validar `/api/health`.

## Testes A-F obrigatorios para GO
1. A: restore grande + promocao + smoke test.
2. B: promocao com sessao `psql` pendurada (verificar terminate de conexoes).
3. C: falha/crash entre renames (verificar reconciler caso C).
4. D: falha de reconnect Prisma pos-cutover (retry/backoff + maintenance ON).
5. E: 2 restores simultaneos (lock global, backoff, `nextRunAt`, sem loop infinito).
6. F: dump invalido/objeto perigoso (bloqueio por padrao e erro operacional curto).

Observacao: comandos operacionais completos estao no `README.md` (secao "Restore em Staging (Opcao A) - Runbook Minimo").
