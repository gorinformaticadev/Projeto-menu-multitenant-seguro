# 1️⃣ Diagnóstico Geral

O sistema de configuração ainda não está pronto como referência de produção. A leitura real do código mostra três fontes de verdade concorrentes: os exemplos de env, os `docker-compose*` e os instaladores/update scripts. Isso gera drift operacional, principalmente em Redis, secrets, diretórios de runtime, seed e frontend build/runtime.

| critério | status | motivo |
|---|---|---|
| segurança | `não` | há segredos hardcoded em [docker-compose.dev.yml](D:/Usuarios/Servidor/GORInformatica/Documents/GitHub/Projeto-menu-multitenant-seguro/docker-compose.dev.yml#L26), arquivo de staging versionado em [apps/backend/.env.staging](D:/Usuarios/Servidor/GORInformatica/Documents/GitHub/Projeto-menu-multitenant-seguro/apps/backend/.env.staging#L10) e backup copia env bruto em [backup.service.ts](D:/Usuarios/Servidor/GORInformatica/Documents/GitHub/Projeto-menu-multitenant-seguro/apps/backend/src/backup/backup.service.ts#L1231) |
| consistência | `não` | `REDIS_URL` aparece no env prod, mas o backend usa `REDIS_HOST/PORT/USERNAME/PASSWORD/DB` em [app.module.ts](D:/Usuarios/Servidor/GORInformatica/Documents/GitHub/Projeto-menu-multitenant-seguro/apps/backend/src/app.module.ts#L43) |
| escalabilidade | `parcial` | há boa separação por serviços, mas sem schema central de env e com variáveis injetadas por script sem documentação canônica |
| produção | `não` | faltam variáveis usadas em runtime nos envs auditados, há naming drift (`SMTP_PASS` vs `SMTP_PASSWORD`) e defaults inseguros |
| Docker | `parcial` | backend está próximo do modelo correto; frontend quebra separação build/runtime com `NEXT_PUBLIC_API_URL` em [apps/frontend/Dockerfile](D:/Usuarios/Servidor/GORInformatica/Documents/GitHub/Projeto-menu-multitenant-seguro/apps/frontend/Dockerfile#L14) |
| 12-Factor | `parcial baixo` | configuração não está completamente externalizada nem centralizada; build e runtime se misturam no frontend e no fluxo de update/backup |

Observação factual: não encontrei `.env`, `.env.production` ou `.env.development` versionados na raiz; encontrei apenas os exemplos e um `apps/backend/.env.staging` versionado.

# 2️⃣ Inventário de Variáveis

Inventário consolidado por grupo, cobrindo todas as variáveis presentes nos 3 arquivos auditados.

`Raiz: .env.example`

| variável | arquivo | valor exemplo | comentário |
|---|---|---|---|
| `DOMAIN`, `FRONTEND_URL`, `BACKEND_URL`, `NEXT_PUBLIC_API_URL` | `.env.example` | `__DOMAIN__`, `https://__DOMAIN__`, `https://api.__DOMAIN__`, `https://api.__DOMAIN__/api` | escopo de domínio/proxy/frontend |
| `DB_USER`, `DB_PASSWORD`, `DB_NAME` | `.env.example` | `__DB_USER__`, `__DB_PASSWORD__`, `__DB_NAME__` | escopo compose/infra, não backend direto |
| `JWT_SECRET`, `ENCRYPTION_KEY`, `NODE_ENV`, `PORT` | `.env.example` | `__JWT_SECRET__`, `__ENCRYPTION_KEY__`, `production`, `4000` | mistura segredo de app com infra |
| `VIRTUAL_HOST`, `LETSENCRYPT_HOST`, `LETSENCRYPT_EMAIL` | `.env.example` | `__DOMAIN__`, `__DOMAIN__`, `__EMAIL__` | proxy/acme |
| `BACKUP_RESTORE_STRICT_UPLOAD_INSPECTION`, `BACKUP_RESTORE_BLOCK_DANGEROUS_OBJECTS`, `BACKUP_RESTORE_BLOCKED_OBJECT_TYPES`, `BACKUP_RESTORE_REQUIRED_TABLES`, `BACKUP_RESTORE_MAINTENANCE_WINDOW_SECONDS`, `BACKUP_RESTORE_RECONNECT_ATTEMPTS`, `BACKUP_RESTORE_RECONNECT_DELAY_MS` | `.env.example` | `true`, `true`, lista de tipos, `_prisma_migrations`, `1800`, `6`, `2000` | todas comentadas; servem como documentação |
| `BACKUP_ACTIVE_DB_STATE_FILE`, `BACKUP_INTERNAL_API_TOKEN`, `BACKUP_ADMIN_DATABASE_URL`, `BACKUP_INTERNAL_TRUST_PROXY`, `BACKUP_INTERNAL_ALLOWED_CIDRS`, `BACKUP_INTERNAL_TRUSTED_PROXY_CIDRS` | `.env.example` | `apps/backend/backups/active-db-state.json`, `troque-este-token-interno`, vazio, `false`, `127.0.0.1/32,::1/128`, CIDRs privados | todas comentadas |
| `PRISMA_RECONNECT_TIMEOUT_MS`, `PRISMA_RECONNECT_BACKOFF_MS`, `BACKUP_LOCK_BACKOFF_BASE_MS`, `BACKUP_LOCK_BACKOFF_MAX_MS`, `BACKUP_LOCK_MAX_ATTEMPTS` | `.env.example` | `60000`, `1000`, `1000`, `30000`, `30` | todas comentadas |

`Backend dev: apps/backend/.env.example`

| variável | arquivo | valor exemplo | comentário |
|---|---|---|---|
| `DATABASE_URL`, `BACKUP_ADMIN_DATABASE_URL` | `apps/backend/.env.example` | vazio, vazio | banco principal e admin db opcional |
| `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | `apps/backend/.env.example` | vazio, `7d`, `15m`, `7d` | auth |
| `FRONTEND_URL`, `PORT`, `NODE_ENV`, `HOST` | `apps/backend/.env.example` | `http://localhost:5000`, `4000`, `development`, `0.0.0.0` | runtime base |
| `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_SUBJECT` | `apps/backend/.env.example` | vazio, vazio, `mailto:suporte@example.com` | web push |
| `HTTPS_ENABLED`, `SSL_KEY_PATH`, `SSL_CERT_PATH` | `apps/backend/.env.example` | `false`, vazio, vazio | HTTPS/certificado |
| `GLOBAL_RATE_LIMIT_TTL`, `GLOBAL_RATE_LIMIT_LIMIT`, `RATE_LIMIT_REDIS_ENABLED`, `RATE_LIMIT_REDIS_PREFIX`, `RATE_LIMIT_REDIS_CONNECT_TIMEOUT`, `RATE_LIMIT_ANON_LIMIT`, `RATE_LIMIT_USER_LIMIT`, `RATE_LIMIT_TENANT_LIMIT`, `RATE_LIMIT_API_KEY_LIMIT`, `RATE_LIMIT_DASHBOARD_LIMIT`, `RATE_LIMIT_METRICS_RETENTION_HOURS`, `RATE_LIMIT_METRICS_MAX_QUERY_HOURS`, `RATE_LIMIT_BLOCK_AUDIT_COOLDOWN_MS`, `RATE_LIMIT_BLOCK_AUDIT_DEDUP_MAX` | `apps/backend/.env.example` | `60000`, `100`, `true`, `rate-limit`, `1000`, `120`, `1000`, `2000`, `1500`, `2500`, `168`, `168`, `30000`, `5000` | rate limiting |
| `SEED_ON_START`, `SEED_FORCE`, `SEED_LOCK_ID`, `SEED_LOCK_WAIT_SECONDS`, `SEED_LOCK_RETRY_MS` | `apps/backend/.env.example` | `true`, `false`, `87456321`, `90`, `2000` | seed/migration |
| `AUDIT_LOG_RETENTION_DAYS`, `NOTIFICATION_READ_RETENTION_DAYS`, `SYSTEM_RETENTION_DELETE_LIMIT` | `apps/backend/.env.example` | `180`, `30`, `5000` | retenção |
| `BACKUP_INTERNAL_API_TOKEN`, `BACKUP_INTERNAL_ALLOWED_CIDRS`, `BACKUP_INTERNAL_TRUST_PROXY`, `BACKUP_INTERNAL_TRUSTED_PROXY_CIDRS` | `apps/backend/.env.example` | vazio, localhost, `false`, CIDRs privados | backup interno |
| `PRISMA_RECONNECT_TIMEOUT_MS`, `PRISMA_RECONNECT_BACKOFF_MS`, `BACKUP_LOCK_BACKOFF_BASE_MS`, `BACKUP_LOCK_BACKOFF_MAX_MS`, `BACKUP_LOCK_MAX_ATTEMPTS` | `apps/backend/.env.example` | `60000`, `1000`, `1000`, `30000`, `30` | reconnect/lock |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `LOG_LEVEL` | `apps/backend/.env.example` | vazio, `development`, `info` | observabilidade |
| `UPLOAD_DESTINATION`, `MAX_FILE_SIZE`, `ALLOWED_FILE_TYPES`, `UPLOADS_PUBLIC_URL` | `apps/backend/.env.example` | `/app/uploads`, `10485760`, mimes de imagem, `http://localhost:4000/uploads` | uploads públicos |
| `MAX_LOGO_FILE_SIZE`, `ALLOWED_LOGO_MIME_TYPES`, `LOGOS_UPLOAD_DIR`, `LOGO_CACHE_TTL` | `apps/backend/.env.example` | `5242880`, mimes de logo, `${UPLOADS_DIR}/logos`, `86400` | logos |
| `UPLOADS_ROOT`, `SECURE_UPLOADS_DIR`, `MAX_SECURE_FILE_SIZE`, `ALLOWED_SECURE_MIME_TYPES` | `apps/backend/.env.example` | `uploads`, `uploads/secure`, `10485760`, lista de mimes | secure files |
| `CSP_ADVANCED`, `SECURITY_HEADERS_ENABLED`, `CSRF_PROTECTION_ENABLED`, `CORS_MAX_AGE` | `apps/backend/.env.example` | `false`, `true`, `false`, `86400` | segurança HTTP |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `EMAIL_FROM_NAME` | `apps/backend/.env.example` | Gmail/587/false, usuário e senha exemplo | email |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD`, `REDIS_DB`, `CACHE_TTL` | `apps/backend/.env.example` | `127.0.0.1`, `6379`, vazio, vazio, `0`, `3600` | Redis; `CACHE_TTL` comentada |
| `OPS_ALERT_5XX_RATE_THRESHOLD`, `OPS_ALERT_WINDOW_MINUTES`, `OPS_ALERT_MIN_REQUEST_SAMPLE`, `OPS_ALERT_ROUTE_LATENCY_MS_THRESHOLD`, `OPS_ALERT_MIN_ROUTE_SAMPLE`, `OPS_ALERT_DENIED_SPIKE_THRESHOLD`, `OPS_ALERT_MIN_DENIED_SAMPLE`, `OPS_ALERT_JOB_FAILURE_STORM_THRESHOLD`, `OPS_ALERT_INFRA_DEGRADED_MIN_CONSECUTIVE`, `OPS_ALERT_COOLDOWN_MINUTES`, `OPS_ALERT_REDIS_REQUIRED`, `CRON_WATCHDOG_REPEATED_FAILURE_THRESHOLD` | `apps/backend/.env.example` | `10`, `5`, `25`, `1500`, `8`, `15`, `12`, `4`, `3`, `15`, `false`, `3` | alertas/watchdog |
| `MAX_MODULE_FILE_SIZE`, `MODULES_TEMP_DIR`, `MODULES_INSTALL_DIR` | `apps/backend/.env.example` | `52428800`, `${UPLOADS_DIR}/temp`, `./modules` | módulos |
| `ENABLE_FILE_SIGNATURE_VALIDATION`, `SECURE_FILES_SOFT_DELETE`, `SECURE_FILES_RETENTION_DAYS` | `apps/backend/.env.example` | `true`, `true`, `90` | proteção extra |
| `ENCRYPTION_KEY` | `apps/backend/.env.example` | linha final malformada | duplicada e inconsistente com o restante do arquivo |

`Backend prod: apps/backend/.env.production.example`

| variável | arquivo | valor exemplo | comentário |
|---|---|---|---|
| `DATABASE_URL`, `BACKUP_ADMIN_DATABASE_URL` | `apps/backend/.env.production.example` | vazio, vazio | banco prod |
| `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | `apps/backend/.env.production.example` | placeholders longos, `7d`, `15m`, `7d` | auth |
| `ENCRYPTION_KEY` | `apps/backend/.env.production.example` | `CHANGE_THIS...` | segredo de app |
| `FRONTEND_URL`, `PORT`, `NODE_ENV`, `HOST` | `apps/backend/.env.production.example` | `https://your-domain.com`, `4000`, `production`, `0.0.0.0` | runtime base |
| `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_SUBJECT` | `apps/backend/.env.production.example` | placeholders | web push |
| `HTTPS_ENABLED`, `SSL_KEY_PATH`, `SSL_CERT_PATH` | `apps/backend/.env.production.example` | `true`, paths absolutos | TLS |
| `GLOBAL_RATE_LIMIT_TTL`, `GLOBAL_RATE_LIMIT_LIMIT`, `RATE_LIMIT_REDIS_ENABLED`, `RATE_LIMIT_REDIS_PREFIX`, `RATE_LIMIT_REDIS_CONNECT_TIMEOUT`, `RATE_LIMIT_ANON_LIMIT`, `RATE_LIMIT_USER_LIMIT`, `RATE_LIMIT_TENANT_LIMIT`, `RATE_LIMIT_API_KEY_LIMIT`, `RATE_LIMIT_DASHBOARD_LIMIT`, `RATE_LIMIT_METRICS_RETENTION_HOURS`, `RATE_LIMIT_METRICS_MAX_QUERY_HOURS`, `RATE_LIMIT_BLOCK_AUDIT_COOLDOWN_MS`, `RATE_LIMIT_BLOCK_AUDIT_DEDUP_MAX` | `apps/backend/.env.production.example` | `60000`, `50`, `true`, `rate-limit`, `1000`, `80`, `1000`, `2000`, `1500`, `3000`, `168`, `168`, `30000`, `5000` | rate limiting prod |
| `SEED_ON_START`, `SEED_FORCE`, `SEED_LOCK_ID`, `SEED_LOCK_WAIT_SECONDS`, `SEED_LOCK_RETRY_MS` | `apps/backend/.env.production.example` | `true`, `false`, `87456321`, `90`, `2000` | seed |
| `BACKUP_INTERNAL_API_TOKEN`, `BACKUP_INTERNAL_ALLOWED_CIDRS`, `BACKUP_INTERNAL_TRUST_PROXY`, `BACKUP_INTERNAL_TRUSTED_PROXY_CIDRS` | `apps/backend/.env.production.example` | placeholder, localhost, `false`, CIDRs privados | backup interno |
| `PRISMA_RECONNECT_TIMEOUT_MS`, `PRISMA_RECONNECT_BACKOFF_MS`, `BACKUP_LOCK_BACKOFF_BASE_MS`, `BACKUP_LOCK_BACKOFF_MAX_MS`, `BACKUP_LOCK_MAX_ATTEMPTS` | `apps/backend/.env.production.example` | `60000`, `1000`, `1000`, `30000`, `30` | reconnect/lock |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `LOG_LEVEL` | `apps/backend/.env.production.example` | DSN exemplo, `production`, `warn` | observabilidade |
| `UPLOAD_DESTINATION`, `MAX_FILE_SIZE`, `ALLOWED_FILE_TYPES` | `apps/backend/.env.production.example` | `/app/uploads`, `5242880`, mimes de imagem | uploads |
| `CSP_ADVANCED`, `SECURITY_HEADERS_ENABLED`, `CSRF_PROTECTION_ENABLED`, `CORS_MAX_AGE` | `apps/backend/.env.production.example` | `true`, `true`, `true`, `86400` | segurança HTTP |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `EMAIL_FROM_NAME` | `apps/backend/.env.production.example` | placeholders SMTP | email |
| `ADMIN_DEFAULT_PASSWORD`, `SYSTEM_MASTER_KEY` | `apps/backend/.env.production.example` | vazios | parecem legados |
| `REDIS_URL`, `CACHE_TTL` | `apps/backend/.env.production.example` | `redis://redis-host:6379`, `3600` | inconsistente com runtime real |
| `AUDIT_LOG_RETENTION_DAYS`, `NOTIFICATION_READ_RETENTION_DAYS`, `SYSTEM_RETENTION_DELETE_LIMIT`, `SECURITY_SCAN_ENABLED` | `apps/backend/.env.production.example` | `180`, `30`, `5000`, `true` | retenção/segurança |
| `MAINTENANCE_BYPASS_TOKEN` | `apps/backend/.env.production.example` | placeholder | bypass manutenção |

`Mapa consolidado principal`

| variável | definida em env auditado | usada no código | usada em docker | usada em scripts | runtime | build |
|---|---|---|---|---|---|---|
| `DATABASE_URL` | sim | sim | sim | sim | sim | não |
| `JWT_SECRET` | sim | sim | sim | sim | sim | não |
| `ENCRYPTION_KEY` | sim | sim | sim | sim | sim | não |
| `NEXT_PUBLIC_API_URL` | sim | frontend sim | sim | sim | parcial | sim |
| `REDIS_HOST/PORT/PASSWORD/DB` | sim no dev, não no prod example | sim | sim | sim | sim | não |
| `REDIS_URL` | sim no prod example | não | não | não | não | não |
| `SMTP_PASS` | sim | sim | não | não | sim | não |
| `SMTP_PASSWORD` | não | sim no secret manager | não | não | parcial | não |
| `UPLOADS_DIR`, `BACKUP_DIR` | não | sim | sim | sim | sim | não |
| `INSTALL_ADMIN_EMAIL/PASSWORD` | não | sim no seed | sim em compose prod | sim | bootstrap | não |
| `APP_VERSION/GIT_SHA/BUILD_TIME` | não | sim/parcial | sim | sim | info | build |

# 3️⃣ Variáveis Usadas mas Ausentes

Ausentes nos 3 envs auditados, com indicação quando já são injetadas por Docker/installer.

| variável | onde aparece | risco | recomendação |
|---|---|---|---|
| `SMTP_PASSWORD` | [secret-manager.service.ts](D:/Usuarios/Servidor/GORInformatica/Documents/GitHub/Projeto-menu-multitenant-seguro/apps/backend/src/common/services/secret-manager.service.ts#L70), [secret-manager.nest.service.ts](D:/Usuarios/Servidor/GORInformatica/Documents/GitHub/Projeto-menu-multitenant-seguro/apps/backend/src/common/services/secret-manager.nest.service.ts#L110) | alto: secret manager carrega um nome que o email service não usa | padronizar tudo para `SMTP_PASSWORD` e adaptar [email.service.ts](D:/Usuarios/Servidor/GORInformatica/Documents/GitHub/Projeto-menu-multitenant-seguro/apps/backend/src/email/email.service.ts#L81) |
| `UPLOADS_DIR`, `BACKUP_DIR` | [paths.service.ts](D:/Usuarios/Servidor/GORInformatica/Documents/GitHub/Projeto-menu-multitenant-seguro/apps/backend/src/core/common/paths/paths.service.ts#L95), [docker-entrypoint.sh](D:/Usuarios/Servidor/GORInformatica/Documents/GitHub/Projeto-menu-multitenant-seguro/apps/backend/docker-entrypoint.sh#L10), [install.sh](D:/Usuarios/Servidor/GORInformatica/Documents/GitHub/Projeto-menu-multitenant-seguro/install/install.sh#L458) | alto em boot manual/native | documentar nos envs oficiais; hoje só Docker/installer injeta |
| `INSTALL_ADMIN_EMAIL`, `INSTALL_ADMIN_PASSWORD` | seeds em `prisma/seeds/defaults.ts`, compose prod, [install.sh](D:/Usuarios/Servidor/GORInformatica/Documents/GitHub/Projeto-menu-multitenant-seguro/install/install.sh#L1147) | alto no primeiro bootstrap | incluir no env de bootstrap, não no runtime permanente |
| `APP_BASE_DIR`, `PROJECT_ROOT`, `IS_DOCKER` | update/dashboard/maintenance/paths | médio: update e paths mudam de comportamento por ambiente | documentar como vars de runtime infra, não de app funcional |
| `REQUIRE_SECRET_MANAGER`, `SECRET_PROVIDER`, `AWS_REGION`, `AWS_SECRET_ACCESS_KEY`, `AZURE_CLIENT_ID`, `VAULT_ADDR`, `GOOGLE_APPLICATION_CREDENTIALS` | [main.ts](D:/Usuarios/Servidor/GORInformatica/Documents/GitHub/Projeto-menu-multitenant-seguro/apps/backend/src/main.ts#L16) e secret manager | alto: produção pode ligar provider sem contrato de config | criar seção própria de secrets provider nos envs |
| `RATE_LIMITING_ENABLED`, `RATE_LIMIT_WHITELIST_IPS`, `RATE_LIMIT_HIGH_VOLUME_LIMIT`, `RATE_LIMIT_SENSITIVE_OPERATION_LIMIT` | `rate-limit-config.service.ts` e `security-throttler.guard.ts` | médio: política incompleta e defaults implícitos | documentar e validar |
| `OPS_ALERTS_LOCK_ID`, `OPS_ALERTS_USE_ADVISORY_LOCK` | `system-operational-alerts.service.ts` | médio: comportamento de lock muda sem contrato explícito | adicionar aos envs oficiais |
| `TOKEN_CLEANUP_LOCK_ID`, `TOKEN_CLEANUP_USE_ADVISORY_LOCK` | `token-cleanup.service.ts` | médio: jobs concorrentes podem divergir por ambiente | documentar e validar |
| `MAX_WEBSOCKET_CONNECTIONS` | `notification.gateway.ts` | médio: limite invisível em produção | documentar como limite operacional |
| `ENABLE_MODULE_UPLOAD` | `module-installer.controller.ts` | médio: feature pode habilitar sem rastreio documental | documentar como feature flag |
| `SEED_MASTER_TENANT_*`, `SEED_SUPER_ADMIN_NAME`, `SEED_TENANT_ADMIN_*`, `SEED_TENANT_USER_*`, `USER_DEFAULT_PASSWORD` | `prisma/seeds/defaults.ts` | médio: seed fica dependente de defaults hardcoded | documentar em env de bootstrap/teste |
| `APP_VERSION`, `GIT_SHA`, `BUILD_TIME` | Dockerfiles, update/dashboard | baixo: diagnóstico incompleto fora do Docker | manter como build metadata, não como env funcional |
| `BACKUP_ENV_FILE`, `BACKUP_ENV_SCOPE`, `BACKUP_EXECUTION_MODE`, `BACKUP_ACTIVE_DATABASE_NAME`, `BACKUP_STAGING_DB_PREFIX`, `BACKUP_MAX_SIZE`, `BACKUP_RESTORE_PROTECTED_TABLES` | backup service/config | médio/alto: backup/restore muda por ambiente sem contrato | documentar todos no bloco de backup |
| `PG_DUMP_BIN`, `PG_RESTORE_BIN`, `PSQL_BIN`, `PG_CREATEDB_BIN`, `PG_DROPDB_BIN`, `PNPM_BIN` | backup/update scripts de runtime | médio em native | documentar como overrides de infraestrutura |
| `UPDATE_ALLOW_LEGACY_INPLACE_API`, `UPDATE_HEALTH_TIMEOUT` | update services | médio | documentar para evitar comportamento divergente em rollout |

# 4️⃣ Variáveis Mortas

Mortas no runtime atual: estão nos envs auditados, mas não encontrei uso no código principal, Docker ou scripts operacionais.

| variável | onde definida | motivo provável | recomendação |
|---|---|---|---|
| `BACKEND_URL` | `.env.example` | legado de documentação/proxy | remover ou mover para doc |
| `HOST` | `apps/backend/.env.example`, `apps/backend/.env.production.example` | sobra de configuração não consumida pelo Nest atual | remover se não houver bind explícito |
| `SSL_KEY_PATH`, `SSL_CERT_PATH` | backend dev/prod examples | TLS não é carregado via runtime atual | remover ou implementar uso real |
| `UPLOAD_DESTINATION`, `ALLOWED_FILE_TYPES` | backend dev/prod examples | upload real usa outros paths/configs | remover ou religar ao código |
| `LOGO_CACHE_TTL` | backend dev example | drift de feature | remover ou implementar |
| `UPLOADS_ROOT`, `SECURE_UPLOADS_DIR` | backend dev example | paths reais vêm de `UPLOADS_DIR`/`LOGOS_UPLOAD_DIR` | remover |
| `SECURE_FILES_SOFT_DELETE`, `SECURE_FILES_RETENTION_DAYS` | backend dev example | parecem planejadas, não ativas | remover ou implementar |
| `SYSTEM_MASTER_KEY` | backend prod example | legado | remover |
| `SECURITY_SCAN_ENABLED` | backend prod example | flag sem consumidor runtime | remover |
| `REDIS_URL`, `CACHE_TTL` | backend prod example | drift de arquitetura anterior | substituir pelo bloco Redis real |
| `MAX_MODULE_FILE_SIZE`, `MODULES_TEMP_DIR`, `MODULES_INSTALL_DIR` | backend dev example | config documentada, mas não consumida no fluxo atual | remover ou implementar |

# 5️⃣ Duplicações e Inconsistências

| problema | evidência | impacto técnico |
|---|---|---|
| escopo root vs backend misturado | `.env.example` mistura proxy/DB/segredos de app | dificulta 12-Factor e induz fonte de verdade dupla |
| `REDIS_URL` vs `REDIS_HOST/PORT/USERNAME/PASSWORD/DB` | env prod usa `REDIS_URL`; runtime usa split vars em [app.module.ts](D:/Usuarios/Servidor/GORInformatica/Documents/GitHub/Projeto-menu-multitenant-seguro/apps/backend/src/app.module.ts#L61) | produção pode parecer configurada e mesmo assim subir com Redis errado |
| `SMTP_PASS` vs `SMTP_PASSWORD` | [email.service.ts](D:/Usuarios/Servidor/GORInformatica/Documents/GitHub/Projeto-menu-multitenant-seguro/apps/backend/src/email/email.service.ts#L81) vs secret managers | quebra integração com secret manager |
| `BACKUP_ADMIN_DATABASE_URL` vs `BACKUP_DATABASE_ADMIN_URL` | alias lido em backup config | naming drift aumenta erro operacional |
| frontend usa `NEXT_PUBLIC_API_URL` como build e compose tenta tratá-la como runtime | [apps/frontend/Dockerfile](D:/Usuarios/Servidor/GORInformatica/Documents/GitHub/Projeto-menu-multitenant-seguro/apps/frontend/Dockerfile#L14), [apps/frontend/src/lib/api.ts](D:/Usuarios/Servidor/GORInformatica/Documents/GitHub/Projeto-menu-multitenant-seguro/apps/frontend/src/lib/api.ts#L33), `docker-compose*.yml` | imagem pode ser promovida entre ambientes apontando para API errada |
| carga de env fragmentada | [app.module.ts](D:/Usuarios/Servidor/GORInformatica/Documents/GitHub/Projeto-menu-multitenant-seguro/apps/backend/src/app.module.ts#L43) não fixa `envFilePath`; [backup.service.ts](D:/Usuarios/Servidor/GORInformatica/Documents/GitHub/Projeto-menu-multitenant-seguro/apps/backend/src/backup/backup.service.ts#L1242) e scripts procuram vários arquivos | update/restore/native podem ler arquivos diferentes do backend |
| instalador injeta variáveis não documentadas | [install.sh](D:/Usuarios/Servidor/GORInformatica/Documents/GitHub/Projeto-menu-multitenant-seguro/install/install.sh#L458) | quem sobe manualmente não sabe o contrato real |
| `ENCRYPTION_KEY` duplicada e malformada no dev example | última linha de `apps/backend/.env.example` | confunde manutenção e parsing humano |

# 6️⃣ Problemas de Segurança

| variável / área | risco | motivo | recomendação |
|---|---|---|---|
| `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY` em `docker-compose.dev.yml` | alto | segredos hardcoded em arquivo versionado | mover para `.env.development.local` não versionado |
| `DATABASE_URL`, `JWT_SECRET`, `SENTRY_DSN`, `MAINTENANCE_BYPASS_TOKEN` em `apps/backend/.env.staging` | alto | arquivo de ambiente versionado com valores sensíveis ou semi-reais | remover do git e manter apenas `.env.staging.example` |
| backup copia `.env`/`.env.production` para artefato | alto | [backup.service.ts](D:/Usuarios/Servidor/GORInformatica/Documents/GitHub/Projeto-menu-multitenant-seguro/apps/backend/src/backup/backup.service.ts#L1237) faz snapshot do arquivo de env | não incluir env em backup ou criptografar separado com KMS |
| `INSTALL_ADMIN_PASSWORD` default `123456` | alto | [install.sh](D:/Usuarios/Servidor/GORInformatica/Documents/GitHub/Projeto-menu-multitenant-seguro/install/install.sh#L951) usa senha fraca por padrão | exigir valor explícito ou gerar aleatória |
| segredos em compose prod como env comum | médio | `JWT_SECRET`, `ENCRYPTION_KEY`, `DATABASE_URL`, `REDIS_PASSWORD` trafegam como env, não como secret | usar Docker secrets, secret manager ou arquivo root-only com permissão restrita |
| `BACKUP_INTERNAL_API_TOKEN`, `MAINTENANCE_BYPASS_TOKEN` com placeholders copiados dos exemplos | médio | risco operacional se equipe promover sem trocar | deixar vazios e validar obrigatoriedade em produção |
| `SMTP_PASS` em examples | baixo | não é vazamento real, mas incentiva guardar credencial no env local e não em secret store | padronizar `SMTP_PASSWORD` e secret manager |

# 7️⃣ Compatibilidade Docker

| variável | build ARG | runtime ENV | secret | docker-compose | motivo |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | sim, frontend | não como contrato primário | não | `build.args` | valor vai para bundle client-side |
| `APP_VERSION`, `GIT_SHA`, `BUILD_TIME` | sim | opcional | não | `build.args` | metadados de imagem/build |
| `DATABASE_URL` | não | sim | idealmente sim | `environment` ou `secrets` | conexão de banco é runtime |
| `JWT_SECRET`, `ENCRYPTION_KEY` | não | sim | sim | secret | segredo puro de runtime |
| `REDIS_PASSWORD` | não | sim | sim | secret | segredo puro |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_DB`, `REDIS_USERNAME` | não | sim | não | `environment` | topologia do runtime |
| `FRONTEND_URL`, `NODE_ENV`, `PORT` | não | sim | não | `environment` | comportamento do app |
| `UPLOADS_DIR`, `BACKUP_DIR`, `APP_BASE_DIR`, `IS_DOCKER` | não | sim | não | `environment` | paths e modo de execução |
| `SMTP_PASSWORD`, `WEB_PUSH_PRIVATE_KEY`, `BACKUP_INTERNAL_API_TOKEN`, `MAINTENANCE_BYPASS_TOKEN` | não | sim | sim | secret | segredos operacionais |
| `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DOMAIN`, `LETSENCRYPT_*`, `VIRTUAL_HOST`, `IMAGE_*` | não | não para app | `DB_PASSWORD` sim | compose/install | pertencem ao stack, não ao backend |

Conclusão Docker: backend está próximo do modelo correto; o maior problema é o frontend, porque `NEXT_PUBLIC_API_URL` precisa ser tratado como build-time, ou substituído por um `config.js` servido em runtime.

# 8️⃣ Estrutura Ideal de ENVs

| arquivo | papel | versionar | observação |
|---|---|---|---|
| `.env.example` | contrato do stack Docker/infra | sim | só `DOMAIN`, `DB_*`, `IMAGE_*`, `LETSENCRYPT_*` |
| `.env.local` | overrides locais do desenvolvedor | não | máquina individual |
| `apps/backend/.env.example` | contrato canônico do backend | sim | todas as vars reais do runtime |
| `apps/backend/.env.development` | dev local | não | localhost, segredos fake |
| `apps/backend/.env.production` | produção | não | só no servidor ou secret store |
| `apps/backend/.env.test` | testes/CI | não | banco/redis efêmeros |
| `apps/frontend/.env.example` | contrato build-time do frontend | sim | `NEXT_PUBLIC_*` e similares |
| `apps/frontend/.env.local` | dev frontend | não | local only |

Papel ideal:

- root: infra/compose
- backend: runtime server-side
- frontend: build-time client/SSR
- secrets: fora do git, preferencialmente em secret manager

# 9️⃣ .env.example Recomendado

Abaixo, o arquivo canônico recomendado para o backend. No root, deixe apenas variáveis de infra/compose.

```env
# Runtime
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:5000
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/multitenant_db?schema=public
BACKUP_ADMIN_DATABASE_URL=

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_USERNAME=
REDIS_PASSWORD=
REDIS_DB=0

# Auth
JWT_SECRET=
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
JWT_EXPIRES_IN=7d
ENCRYPTION_KEY=

# Email
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=noreply@example.com
EMAIL_FROM_NAME=Sistema Multitenant

# Web Push
WEB_PUSH_PUBLIC_KEY=
WEB_PUSH_PRIVATE_KEY=
WEB_PUSH_SUBJECT=mailto:suporte@example.com

# Logging / Observability
LOG_LEVEL=info
SENTRY_DSN=

# Paths
UPLOADS_DIR=./uploads
BACKUP_DIR=./backups
LOGOS_UPLOAD_DIR=./uploads/logos
APP_BASE_DIR=
PROJECT_ROOT=
IS_DOCKER=false

# Uploads
MAX_SECURE_FILE_SIZE=10485760
ALLOWED_SECURE_MIME_TYPES=image/jpeg,image/png,image/webp,image/gif,application/pdf

# Rate limit
RATE_LIMITING_ENABLED=true
GLOBAL_RATE_LIMIT_TTL=60000
GLOBAL_RATE_LIMIT_LIMIT=100
RATE_LIMIT_REDIS_ENABLED=true
RATE_LIMIT_REDIS_PREFIX=rate-limit
RATE_LIMIT_REDIS_CONNECT_TIMEOUT=1000
RATE_LIMIT_ANON_LIMIT=120
RATE_LIMIT_USER_LIMIT=1000
RATE_LIMIT_TENANT_LIMIT=2000
RATE_LIMIT_API_KEY_LIMIT=1500
RATE_LIMIT_DASHBOARD_LIMIT=2500
RATE_LIMIT_HIGH_VOLUME_LIMIT=500
RATE_LIMIT_SENSITIVE_OPERATION_LIMIT=30
RATE_LIMIT_WHITELIST_IPS=

# Retention / alerts
AUDIT_LOG_RETENTION_DAYS=180
NOTIFICATION_READ_RETENTION_DAYS=30
SYSTEM_RETENTION_DELETE_LIMIT=5000
OPS_ALERTS_USE_ADVISORY_LOCK=true
OPS_ALERTS_LOCK_ID=98542174
OPS_ALERT_WINDOW_MINUTES=5
OPS_ALERT_COOLDOWN_MINUTES=15
OPS_ALERT_5XX_RATE_THRESHOLD=10
OPS_ALERT_MIN_REQUEST_SAMPLE=25
OPS_ALERT_ROUTE_LATENCY_MS_THRESHOLD=1500
OPS_ALERT_MIN_ROUTE_SAMPLE=8
OPS_ALERT_DENIED_SPIKE_THRESHOLD=15
OPS_ALERT_MIN_DENIED_SAMPLE=12
OPS_ALERT_JOB_FAILURE_STORM_THRESHOLD=4
OPS_ALERT_INFRA_DEGRADED_MIN_CONSECUTIVE=3
OPS_ALERT_REDIS_REQUIRED=false
TOKEN_CLEANUP_USE_ADVISORY_LOCK=true
TOKEN_CLEANUP_LOCK_ID=98542173
CRON_WATCHDOG_REPEATED_FAILURE_THRESHOLD=3
MAX_WEBSOCKET_CONNECTIONS=1000

# Backup / restore
BACKUP_INTERNAL_API_TOKEN=
BACKUP_INTERNAL_ALLOWED_CIDRS=127.0.0.1/32,::1/128
BACKUP_INTERNAL_TRUST_PROXY=false
BACKUP_INTERNAL_TRUSTED_PROXY_CIDRS=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
BACKUP_ENV_FILE=
BACKUP_ENV_SCOPE=project
BACKUP_EXECUTION_MODE=auto
BACKUP_ACTIVE_DATABASE_NAME=
BACKUP_STAGING_DB_PREFIX=restore_stage
BACKUP_MAX_SIZE=2147483648
BACKUP_RESTORE_PROTECTED_TABLES=
PRISMA_RECONNECT_TIMEOUT_MS=60000
PRISMA_RECONNECT_BACKOFF_MS=1000
BACKUP_LOCK_BACKOFF_BASE_MS=1000
BACKUP_LOCK_BACKOFF_MAX_MS=30000
BACKUP_LOCK_MAX_ATTEMPTS=30

# Secrets provider
REQUIRE_SECRET_MANAGER=false
SECRET_PROVIDER=
AWS_REGION=
AWS_SECRET_ACCESS_KEY=
AZURE_CLIENT_ID=
VAULT_ADDR=
GOOGLE_APPLICATION_CREDENTIALS=

# Bootstrap / seed
SEED_ON_START=false
SEED_FORCE=false
SEED_LOCK_ID=87456321
SEED_LOCK_WAIT_SECONDS=90
SEED_LOCK_RETRY_MS=2000
INSTALL_ADMIN_EMAIL=
INSTALL_ADMIN_PASSWORD=
USER_DEFAULT_PASSWORD=

# Features
ENABLE_MODULE_UPLOAD=false
UPDATE_ALLOW_LEGACY_INPLACE_API=false
UPDATE_HEALTH_TIMEOUT=120
```

# 🔟 .env.development Recomendado

```env
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:5000

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/multitenant_dev?schema=public
BACKUP_ADMIN_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres?schema=public

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

JWT_SECRET=dev-only-change-me-dev-only-change-me
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
JWT_EXPIRES_IN=7d
ENCRYPTION_KEY=dev-only-32bytes-minimum-change-me

SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=dev@example.com
EMAIL_FROM_NAME=Multitenant Dev

WEB_PUSH_PUBLIC_KEY=
WEB_PUSH_PRIVATE_KEY=
WEB_PUSH_SUBJECT=mailto:dev@example.com

LOG_LEVEL=debug
SENTRY_DSN=

UPLOADS_DIR=./uploads
BACKUP_DIR=./backups
LOGOS_UPLOAD_DIR=./uploads/logos
IS_DOCKER=false

RATE_LIMITING_ENABLED=true
GLOBAL_RATE_LIMIT_TTL=60000
GLOBAL_RATE_LIMIT_LIMIT=200
RATE_LIMIT_REDIS_ENABLED=false
RATE_LIMIT_ANON_LIMIT=200
RATE_LIMIT_USER_LIMIT=2000
RATE_LIMIT_TENANT_LIMIT=4000
RATE_LIMIT_API_KEY_LIMIT=2500
RATE_LIMIT_DASHBOARD_LIMIT=4000
RATE_LIMIT_HIGH_VOLUME_LIMIT=1000
RATE_LIMIT_SENSITIVE_OPERATION_LIMIT=100

AUDIT_LOG_RETENTION_DAYS=30
NOTIFICATION_READ_RETENTION_DAYS=7
SYSTEM_RETENTION_DELETE_LIMIT=1000
OPS_ALERTS_USE_ADVISORY_LOCK=false
TOKEN_CLEANUP_USE_ADVISORY_LOCK=false
MAX_WEBSOCKET_CONNECTIONS=1000

BACKUP_INTERNAL_API_TOKEN=dev-backup-token
BACKUP_INTERNAL_ALLOWED_CIDRS=127.0.0.1/32,::1/128
BACKUP_INTERNAL_TRUST_PROXY=false
BACKUP_EXECUTION_MODE=auto
BACKUP_MAX_SIZE=2147483648

SEED_ON_START=true
SEED_FORCE=false
INSTALL_ADMIN_EMAIL=admin@local.test
INSTALL_ADMIN_PASSWORD=change-me-now
ENABLE_MODULE_UPLOAD=false
REQUIRE_SECRET_MANAGER=false
UPDATE_HEALTH_TIMEOUT=120
```

# 1️⃣1️⃣ .env.production Recomendado

```env
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://app.example.com

DATABASE_URL=
BACKUP_ADMIN_DATABASE_URL=

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_USERNAME=
REDIS_PASSWORD=
REDIS_DB=0

JWT_SECRET=
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
JWT_EXPIRES_IN=7d
ENCRYPTION_KEY=

SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=noreply@example.com
EMAIL_FROM_NAME=Sistema Multitenant

WEB_PUSH_PUBLIC_KEY=
WEB_PUSH_PRIVATE_KEY=
WEB_PUSH_SUBJECT=mailto:suporte@example.com

LOG_LEVEL=warn
SENTRY_DSN=

UPLOADS_DIR=/app/uploads
BACKUP_DIR=/app/backups
LOGOS_UPLOAD_DIR=/app/uploads/logos
IS_DOCKER=true

RATE_LIMITING_ENABLED=true
GLOBAL_RATE_LIMIT_TTL=60000
GLOBAL_RATE_LIMIT_LIMIT=100
RATE_LIMIT_REDIS_ENABLED=true
RATE_LIMIT_REDIS_PREFIX=rate-limit
RATE_LIMIT_REDIS_CONNECT_TIMEOUT=1000
RATE_LIMIT_ANON_LIMIT=80
RATE_LIMIT_USER_LIMIT=1000
RATE_LIMIT_TENANT_LIMIT=2000
RATE_LIMIT_API_KEY_LIMIT=1500
RATE_LIMIT_DASHBOARD_LIMIT=3000
RATE_LIMIT_HIGH_VOLUME_LIMIT=500
RATE_LIMIT_SENSITIVE_OPERATION_LIMIT=30

AUDIT_LOG_RETENTION_DAYS=180
NOTIFICATION_READ_RETENTION_DAYS=30
SYSTEM_RETENTION_DELETE_LIMIT=5000
OPS_ALERTS_USE_ADVISORY_LOCK=true
OPS_ALERTS_LOCK_ID=98542174
TOKEN_CLEANUP_USE_ADVISORY_LOCK=true
TOKEN_CLEANUP_LOCK_ID=98542173
MAX_WEBSOCKET_CONNECTIONS=1000

BACKUP_INTERNAL_API_TOKEN=
BACKUP_INTERNAL_ALLOWED_CIDRS=127.0.0.1/32,::1/128
BACKUP_INTERNAL_TRUST_PROXY=false
BACKUP_INTERNAL_TRUSTED_PROXY_CIDRS=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
BACKUP_ENV_SCOPE=project
BACKUP_EXECUTION_MODE=auto
BACKUP_MAX_SIZE=2147483648
PRISMA_RECONNECT_TIMEOUT_MS=60000
PRISMA_RECONNECT_BACKOFF_MS=1000
BACKUP_LOCK_BACKOFF_BASE_MS=1000
BACKUP_LOCK_BACKOFF_MAX_MS=30000
BACKUP_LOCK_MAX_ATTEMPTS=30

REQUIRE_SECRET_MANAGER=true
SECRET_PROVIDER=aws
AWS_REGION=us-east-1

SEED_ON_START=false
SEED_FORCE=false
ENABLE_MODULE_UPLOAD=false
UPDATE_ALLOW_LEGACY_INPLACE_API=false
UPDATE_HEALTH_TIMEOUT=120
```

# 1️⃣2️⃣ Configuração Dinâmica

Arquitetura recomendada:

```text
cache (Redis)
  -> banco (system_settings / tenant_settings)
    -> ENV fallback
      -> default de código somente para desenvolvimento
```

Implementação:

- secrets nunca vão para banco nem painel; ficam em secret manager/ENV.
- configs funcionais vão para `system_settings` e `tenant_settings`.
- leitura via `ConfigFacade`: `get(key, tenantId?)`.
- algoritmo: tenta cache, fallback no banco, fallback no env, grava cache.
- invalidar cache por chave quando admin alterar configuração.
- manter prefixos: `security.*`, `notifications.*`, `features.*`, `limits.*`, `integrations.*`.

# 1️⃣3️⃣ Variáveis para Painel Admin

Podem ir para painel:

- `ENABLE_MODULE_UPLOAD`
- `MAX_WEBSOCKET_CONNECTIONS`
- `AUDIT_LOG_RETENTION_DAYS`
- `NOTIFICATION_READ_RETENTION_DAYS`
- `SYSTEM_RETENTION_DELETE_LIMIT`
- `GLOBAL_RATE_LIMIT_LIMIT`
- `RATE_LIMIT_HIGH_VOLUME_LIMIT`
- `RATE_LIMIT_SENSITIVE_OPERATION_LIMIT`
- `OPS_ALERT_*`
- URLs externas não sensíveis
- feature flags, toggles, limites funcionais

Não podem ir para painel:

- `DATABASE_URL`
- `JWT_SECRET`
- `ENCRYPTION_KEY`
- `REDIS_PASSWORD`
- `SMTP_PASSWORD`
- `WEB_PUSH_PRIVATE_KEY`
- `BACKUP_INTERNAL_API_TOKEN`
- `MAINTENANCE_BYPASS_TOKEN`
- `AWS_SECRET_ACCESS_KEY`
- `AZURE_CLIENT_ID` com segredo associado
- `VAULT_ADDR` quando fizer parte da infra sensível
- `UPLOADS_DIR`, `BACKUP_DIR`, `APP_BASE_DIR`, `PROJECT_ROOT`, `IS_DOCKER`
- `NODE_ENV`, `PORT`, `FRONTEND_URL`

# 1️⃣4️⃣ Schema de Validação

Exemplo principal com Zod:

```ts
import { z } from 'zod';

const intFromString = (fallback?: number) =>
  z.coerce.number().int().optional().transform((v) => v ?? fallback);

const boolFromString = (fallback?: boolean) =>
  z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v == null ? fallback : v === 'true'));

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']),
  PORT: intFromString(4000),
  FRONTEND_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().min(32),
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: intFromString(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: intFromString(0),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: intFromString(587),
  SMTP_SECURE: boolFromString(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  RATE_LIMITING_ENABLED: boolFromString(true),
  GLOBAL_RATE_LIMIT_TTL: intFromString(60000),
  GLOBAL_RATE_LIMIT_LIMIT: intFromString(100),
  UPLOADS_DIR: z.string().min(1),
  BACKUP_DIR: z.string().min(1),
  REQUIRE_SECRET_MANAGER: boolFromString(false),
  SECRET_PROVIDER: z.enum(['aws', 'azure', 'vault', 'google']).optional(),
});

export type AppEnv = z.infer<typeof envSchema>;
export const env = envSchema.parse(process.env);
```

Equivalente com Joi:

```ts
import Joi from 'joi';

export const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'staging', 'production').required(),
  PORT: Joi.number().integer().default(4000),
  FRONTEND_URL: Joi.string().uri().required(),
  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  ENCRYPTION_KEY: Joi.string().min(32).required(),
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().integer().default(6379),
  SMTP_PASSWORD: Joi.string().allow('').optional(),
}).unknown(false);
```

Equivalente com envsafe:

```ts
import { envsafe, str, num, bool } from 'envsafe';

export const env = envsafe({
  NODE_ENV: str({ choices: ['development', 'test', 'staging', 'production'] }),
  PORT: num({ default: 4000 }),
  FRONTEND_URL: str(),
  DATABASE_URL: str(),
  JWT_SECRET: str(),
  ENCRYPTION_KEY: str(),
  REDIS_HOST: str(),
  REDIS_PORT: num({ default: 6379 }),
  RATE_LIMITING_ENABLED: bool({ default: true }),
  UPLOADS_DIR: str(),
  BACKUP_DIR: str(),
});
```

# 1️⃣5️⃣ Melhorias Arquiteturais

- Definir um único contrato canônico de backend em `apps/backend/.env.example` e parar de usar exemplos divergentes como fonte de verdade.
- Separar definitivamente `root/.env*` para infra/compose e `apps/backend/.env*` para runtime do Nest.
- Padronizar nomes: `SMTP_PASSWORD` e remover `SMTP_PASS`; remover `REDIS_URL` se o runtime continuar splitado.
- Remover `apps/backend/.env.staging` do git e substituir por `.env.staging.example`.
- Remover segredos hardcoded de `docker-compose.dev.yml`.
- Parar de incluir snapshot de `.env` nos backups, ou criptografá-lo com chave externa/KMS.
- Exigir senha admin explícita ou gerar aleatória no instalador; nunca usar `123456`.
- Adicionar validação de env na subida do app e falhar rápido em produção.
- Corrigir frontend para build-time puro de `NEXT_PUBLIC_*` ou migrar para `runtime config endpoint`.
- Documentar variáveis injetadas pelo instalador: `UPLOADS_DIR`, `BACKUP_DIR`, `INSTALL_ADMIN_*`, `REQUIRE_SECRET_MANAGER`, `APP_VERSION`.
- Migrar segredos de produção para secret manager e usar ENV apenas como ponte de bootstrap.
- Criar testes de smoke para configuração: `env completeness`, `docker parity`, `production bootstrap`.

Se você quiser, no próximo passo eu posso transformar esta auditoria em um checklist executável e depois gerar um plano de correção priorizado por severidade e esforço.
