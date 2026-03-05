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
