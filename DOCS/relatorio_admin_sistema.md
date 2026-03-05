# Relatorio Administrativo - Update/Rollback Atomico (Native)

## Objetivo aplicado

Foi implementado o fluxo atomico para instalacao nativa (PM2), com separacao entre codigo por release e estado persistente:

- `BASE_DIR/releases/<versao>`
- `BASE_DIR/shared`
- `BASE_DIR/current` (symlink para release ativa)
- `BASE_DIR/previous` (symlink para release anterior)

Com isso, o update deixa de fazer checkout in-place e passa a trabalhar em release limpa, com troca atomica de symlink e rollback rapido.

## Scripts entregues

- `install/update-native.sh`
  - Fluxo padrao: atomico (`releases/current/shared`)
  - Compatibilidade: `--legacy-inplace`
  - Lock concorrente via `shared/locks/update.lock` (`flock`)
  - Backup obrigatorio pre-swap (DB + uploads + env snapshot)
  - Healthcheck pos-swap
  - Rollback automatico com marcador de log: `ROLLBACK_COMPLETED`
  - Retencao de releases ao final

- `install/rollback-native.sh`
  - Rollback manual para `previous` (padrao) ou release especifica
  - `--list` para listar releases
  - Reinicio PM2 + healthcheck
  - Reversao automatica se o rollback manual falhar no healthcheck

- `install/release-retention.sh`
  - Mantem `current` e `previous`
  - Mantem os ultimos `N` releases (default `5`)
  - Remove releases antigas restantes

## Estrutura e paths canonicos

No startup do update atomico, o script garante:

- `UPLOADS_DIR=${BASE_DIR}/shared/uploads`
- `BACKUP_DIR=${BASE_DIR}/shared/backups`
- `APP_BASE_DIR=${BASE_DIR}`

Esses valores sao persistidos em `shared/.env`.

No release alvo, o script cria links para `shared`:

- `release/.env -> shared/.env`
- `release/apps/backend/.env -> shared/.env`
- `release/uploads -> shared/uploads`
- `release/backups -> shared/backups`
- `release/apps/frontend/.env.local -> shared/.env.frontend.local` (quando existir)

## Fluxo update atomico (resumo)

1. Resolve `BASE_DIR` e adquire lock.
2. Faz bootstrap automatico de instalacao legacy para estrutura de releases, quando necessario.
3. Resolve/cria release alvo (`tarball GitHub` preferencial, fallback para `git clone`).
4. Gera `VERSION` e `BUILD_INFO.json` no release.
5. Faz build/migrations/seed no release alvo sem derrubar producao.
6. Executa backup obrigatorio pre-swap:
   - `database.dump` (pg_dump)
   - `uploads.tar.gz`
   - `.env.snapshot`
   - `manifest.json`
7. Atualiza symlinks (`previous` e `current`) de forma atomica.
8. Reinicia PM2 apontando para `BASE_DIR/current`.
9. Executa healthcheck de backend/frontend.
10. Em falha: rollback automatico para `previous`, reinicio e log `ROLLBACK_COMPLETED`.
11. Aplica retencao de releases.

## Fluxo rollback manual (resumo)

1. `bash install/rollback-native.sh --list` para visualizar releases.
2. `bash install/rollback-native.sh --to previous` (padrao) ou `--to <release>`.
3. Script troca `current`, reinicia PM2 e valida healthcheck.
4. Se healthcheck falhar, o script reverte o rollback para a release anterior.

## Compatibilidade com painel administrativo

- O endpoint atual continua chamando `install/update-native.sh`.
- Logs de etapas permanecem claros no stdout/stderr (`STEP x/10` + mensagens de erro).
- `ROLLBACK_COMPLETED` continua sendo emitido para o backend detectar rollback automatico.

## Observacoes operacionais

- O modelo funciona sem depender de `.git` no diretorio ativo (usa tarball por padrao quando possivel).
- `shared` preserva dados de cliente entre versoes.
- Lock evita updates concorrentes.
