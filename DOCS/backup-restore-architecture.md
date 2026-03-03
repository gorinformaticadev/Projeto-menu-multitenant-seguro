# Backup & Restore (NestJS) - Arquitetura

## Contexto atual
- Operações antigas estavam em `/api/backup/*` e dependiam de scripts externos `install/restore-*.sh`.
- Restore síncrono podia travar fluxo HTTP e afetar disponibilidade.
- Era necessário mover orquestração para backend, manter backend vivo e adicionar histórico/lock/job assíncrono.

## Opções de fila consideradas
1. BullMQ (Redis):
   - Prós: retries avançados, prioridade, observabilidade pronta, múltiplos workers.
   - Contras: dependência adicional e acoplamento forte com Redis para restore crítico.
2. Fila em banco (padrão adotado):
   - Prós: sem nova dependência, estado transacional junto ao histórico (`backup_jobs`), rollout simples.
   - Contras: throughput menor e menos recursos nativos de retry.

Fallback recomendado: se o volume de jobs crescer muito, migrar runner para BullMQ mantendo contrato HTTP e tabelas de auditoria.

## Estratégia de restore adotada
Híbrida: **staging database + cutover controlado no banco principal**.

Fluxo:
1. Validar arquivo e checksum.
2. Restaurar dump em database staging isolado.
3. Validar staging (sanity check de tabelas).
4. Criar safety backup do banco atual.
5. Ativar modo manutenção (backend vivo, healthcheck ok).
6. Aplicar restore no banco principal.
7. Opcional: `prisma migrate deploy`.
8. Desativar manutenção e limpar staging.

Motivo: reduz risco de aplicar dump corrompido direto em produção e evita derrubar processo do backend.

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

Persistência
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

## Invariantes de segurança aplicadas
- Apenas `SUPER_ADMIN` pode executar endpoints (`JwtAuthGuard` + `RolesGuard`).
- Validação adicional: SUPER_ADMIN de tenant não-master é bloqueado para restore global.
- Upload aceita apenas `.dump/.backup` com assinatura `PGDMP`.
- Nome/caminho sanitizado (sem path traversal).
- Sem execução arbitrária: comandos via `spawn(command, args)` sem shell.
- Senha não é logada (uso de `PGPASSWORD` no env do processo).
- Lock global impede backup e restore simultâneos.
- Modo manutenção durante cutover evita tráfego concorrente de rotas de negócio.

## Plano de migração gradual (substituir install/native.sh)
1. Fase 1 (compatibilidade): manter endpoints antigos `/api/backup/*` como bridge para novo serviço.
2. Fase 2: frontend migrado para `/api/backups/*` e polling de jobs.
3. Fase 3: remover dependência operacional de `install/restore-native.sh` para restore.
4. Fase 4: opcionalmente descontinuar endpoints legados e scripts de restore manual.

## Checklist de confiabilidade
- Timeout configurável (`BACKUP_JOB_TIMEOUT_SECONDS`).
- Lock/lease com TTL (`BACKUP_LEASE_SECONDS`) e heartbeat.
- Logs persistidos por job (`backup_jobs.logs`).
- Retenção configurável (`BACKUP_RETENTION_COUNT`).
- Safety backup antes de cutover.
- Estado de manutenção exposto via `/api/backups/maintenance/state`.
