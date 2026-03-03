# Relatorio Completo - Sistema de Backup e Restore

Data: 2026-03-03  
Escopo: modulo de backup/restore no backend NestJS + fluxos operacionais de suporte.

## 1. Objetivo do sistema

O sistema foi desenhado para:

- Criar backups completos do PostgreSQL em formato `custom` (`.dump`/`.backup`);
- Permitir restore controlado com validacao e lock global;
- Evitar bloqueio da API principal usando fila assincrona em banco;
- Manter trilha de auditoria e progresso por job.

## 2. Arquitetura funcional

O modulo de backup e composto por:

- `BackupsController`: endpoints modernos (`/api/backups/*`);
- `BackupLegacyController`: endpoints legados (`/api/backup/*`);
- `BackupService`: orquestracao principal (jobs, validacoes, backup, restore, retencao);
- `BackupJobRunnerService`: worker interno com polling da fila;
- `BackupLockService`: lock global distribuido com lease/TTL no banco;
- `BackupProcessService`: execucao de binarios (`pg_dump`, `pg_restore`, etc.) sem shell;
- `BackupRuntimeStateService` + `BackupMaintenanceGuard`: modo de manutencao no cutover.

Persistencia principal:

- `backup_artifacts`: metadados de arquivos;
- `backup_jobs`: fila, status, logs e erros;
- `backup_leases`: lock global.

## 3. Fluxo de backup (end-to-end)

1. Operador `SUPER_ADMIN` chama `POST /api/backups`.
2. Sistema cria job `PENDING` em `backup_jobs`.
3. Runner faz claim atomico do job (`RUNNING`) e tenta adquirir lock global.
4. Com lock adquirido, executa `pg_dump` em formato custom.
5. Valida arquivo gerado e calcula checksum SHA256.
6. Grava artefato em `backup_artifacts` (`source=BACKUP`).
7. Marca job `SUCCESS`, grava logs e auditoria.
8. Aplica politica de retencao para backups antigos (`BACKUP_RETENTION_COUNT`).

## 4. Fluxo de restore (end-to-end)

1. Operador enfileira restore de artefato (`POST /api/backups/:id/restore`) ou upload.
2. Job `RESTORE` entra em `PENDING`.
3. Runner faz claim e lock global.
4. Validacoes iniciais:
   - caminho seguro;
   - existencia do arquivo;
   - checksum;
   - assinatura `PGDMP`.
5. Cria banco de staging e restaura dump nele.
6. Valida staging (sanity check de tabelas no `public`).
7. Cria safety backup do banco principal.
8. Ativa modo manutencao.
9. Executa cutover (`pg_restore` no banco principal).
10. Se cutover falhar, tenta rollback automatico com safety backup.
11. Revalida/reconecta Prisma apos cutover.
12. Opcional: executa `prisma migrate deploy` (`runMigrations=true`).
13. Desativa manutencao, limpa staging e arquivos temporarios.
14. Marca job como `SUCCESS` ou `FAILED`.

## 5. Seguranca e controles criticos

Controles aplicados:

- Apenas `SUPER_ADMIN` pode operar backup/restore;
- `SUPER_ADMIN` de tenant nao-master e bloqueado para restore global;
- Upload aceita apenas extensoes permitidas e assinatura `PGDMP`;
- Sanitizacao de nome de arquivo e bloqueio de path traversal;
- Execucao de comando com `spawn(command, args)` (sem shell);
- Lock global evita backup e restore simultaneos;
- Modo manutencao protege rotas durante cutover;
- Restore de uploads com inspecao estrita de objetos perigosos por padrao.

Inspecao estrita de upload:

- Se `BACKUP_RESTORE_STRICT_UPLOAD_INSPECTION=true`, o sistema inspeciona `pg_restore --list`;
- Bloqueia tipos perigosos (por padrao): `FUNCTION`, `PROCEDURE`, `EVENT TRIGGER`, `EXTENSION`, etc.;
- Permite override controlado por request com `allowUnsafeObjects=true`.

## 6. Lock, concorrencia e resiliencia

Lock global:

- Chave unica: `GLOBAL_BACKUP_RESTORE`;
- Lease com `expiresAt` (TTL) e heartbeat periodico;
- Aquisicao atomica com `INSERT ... ON CONFLICT ... WHERE ...`.

Resiliencia:

- Timeout por job configuravel;
- Rollback automatico do restore no cutover;
- Recuperacao de conexao Prisma apos restore;
- Alerta proativo de falha via tabela de notificacoes + audit log.

## 7. Observabilidade e auditoria

Observabilidade atual:

- Logs de progresso por job (`backup_jobs.logs`);
- Progresso por etapa (`currentStep`, `progressPercent`);
- Campos de erro (`error`) para troubleshooting;
- Eventos de auditoria (`AuditService.log`) para criacao/sucesso/falha.

Retencao de logs:

- Logs em job sao podados para manter somente ultimas 400 entradas.

## 8. Endpoints principais (API)

Modernos:

- `POST /api/backups` - cria job de backup;
- `GET /api/backups` - lista artefatos e jobs;
- `POST /api/backups/upload` - upload de dump;
- `POST /api/backups/:id/restore` - restore de artefato;
- `POST /api/backups/restore-from-upload/:uploadId` - restore de upload;
- `GET /api/backups/jobs/:jobId` - status/log/progresso;
- `POST /api/backups/jobs/:jobId/cancel` - cancela job pendente;
- `GET /api/backups/:id/download` - download de arquivo;
- `GET /api/backups/maintenance/state` - estado de manutencao.

Legados (compatibilidade):

- `POST /api/backup/create`
- `GET /api/backup/available`
- `POST /api/backup/upload`
- `POST /api/backup/restore`
- `GET /api/backup/restore-logs/:id`
- `GET /api/backup/download-file/:fileName`
- `DELETE /api/backup/delete/:fileName`

## 9. Politicas automaticas (cron)

- Backup automatico diario: `0 2 * * *`;
- Retencao diaria: `30 2 * * *`;
- Ambos registrados em `CronService`.

## 10. Configuracoes (variaveis de ambiente)

Principais:

- `BACKUP_DIR`
- `BACKUP_MAX_SIZE`
- `BACKUP_JOB_TIMEOUT_SECONDS`
- `BACKUP_LEASE_SECONDS`
- `BACKUP_QUEUE_POLL_MS`
- `BACKUP_RETENTION_COUNT`
- `BACKUP_ENV_SCOPE`
- `BACKUP_RESTORE_PROTECTED_TABLES`
- `BACKUP_RESTORE_MAINTENANCE_WINDOW_SECONDS`
- `BACKUP_RESTORE_STRICT_UPLOAD_INSPECTION`
- `BACKUP_RESTORE_BLOCKED_OBJECT_TYPES`
- `BACKUP_RESTORE_RECONNECT_ATTEMPTS`
- `BACKUP_RESTORE_RECONNECT_DELAY_MS`

Binarios configuraveis:

- `PG_DUMP_BIN`
- `PG_RESTORE_BIN`
- `PSQL_BIN`
- `PG_CREATEDB_BIN`
- `PG_DROPDB_BIN`
- `PNPM_BIN`

## 11. Dependencias operacionais obrigatorias

- Banco PostgreSQL acessivel pela `DATABASE_URL`;
- Binarios PostgreSQL disponiveis no host/container backend;
- Diretorio de backup gravavel;
- Usuario da `DATABASE_URL` com permissoes adequadas.

Permissao critica para restore com staging:

- O usuario precisa de `CREATEDB` para criar banco de staging;
- Correcao SQL:

```sql
ALTER ROLE "<DB_USER>" CREATEDB;
```

Obs: o instalador nativo ja foi ajustado para criar/alterar usuario com `CREATEDB`.

## 12. Interface frontend (operacao)

Tela de configuracoes:

- Secao de backup:
  - cria job de backup;
  - faz polling de status;
  - permite download e remocao de backups.
- Secao de restore:
  - upload opcional;
  - selecao de arquivo;
  - confirmacao textual;
  - opcao de `runMigrations`;
  - acompanhamento de progresso e erro.

## 13. Scripts operacionais alternativos

Para operacao manual/legada existem scripts:

- `install/restore-db.sh` (ambiente Docker Compose);
- `install/restore-native.sh` (ambiente PM2/native).

Esses scripts sao uteis em suporte emergencial, mas o fluxo recomendado para aplicacao e o assincrono via API.

## 14. Falhas comuns e como corrigir

### 14.1 Erro: permission denied to create database

Sintoma:

- Job falha em ~20% (`RESTORE_STAGE_DB_PREPARE`).

Causa:

- Usuario da `DATABASE_URL` sem `CREATEDB`.

Correcao:

- Aplicar `ALTER ROLE "<DB_USER>" CREATEDB;`
- Reenfileirar restore.

### 14.2 Erro de checksum divergente

Causa:

- Arquivo alterado/corrompido entre upload e restore.

Correcao:

- Fazer novo upload ou usar artefato integro.

### 14.3 Upload bloqueado por objeto perigoso

Causa:

- Dump contem objetos bloqueados na inspecao estrita.

Correcao:

- Revisar dump manualmente;
- Somente em caso justificado, executar restore com `allowUnsafeObjects=true`.

## 15. Checklist operacional recomendado

Pre-restore:

- Confirmar origem e integridade do dump;
- Validar que operador e `SUPER_ADMIN`;
- Confirmar janela de manutencao;
- Confirmar permissao `CREATEDB` para usuario DB.

Durante restore:

- Monitorar `GET /api/backups/jobs/:jobId`;
- Acompanhar `currentStep`, `progressPercent` e `logs`.

Pos-restore:

- Validar healthcheck API;
- Validar autenticao e fluxos criticos;
- Se usado `runMigrations`, validar schema e funcionalidades.

## 16. Referencias de codigo

- `apps/backend/src/backup/backup.service.ts`
- `apps/backend/src/backup/backup.controller.ts`
- `apps/backend/src/backup/backup-config.service.ts`
- `apps/backend/src/backup/backup-job-runner.service.ts`
- `apps/backend/src/backup/backup-lock.service.ts`
- `apps/backend/src/backup/backup-process.service.ts`
- `apps/backend/src/backup/backup-runtime-state.service.ts`
- `apps/backend/src/backup/guards/backup-maintenance.guard.ts`
- `apps/backend/src/backup/backup-cron.service.ts`
- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20260303173000_add_backup_jobs_queue/migration.sql`
- `install/restore-db.sh`
- `install/restore-native.sh`
- `DOCS/backup-restore-architecture.md`
