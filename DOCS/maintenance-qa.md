# Maintenance Mode - QA Manual

Roteiro rápido para validar manutenção, whitelist, bloqueios, bypass e headers CORS.

## Variáveis

```bash
export BASE_URL="https://seu-dominio"
export APP_BASE_DIR="/opt/app"            # ajuste conforme instalação
export MAINT_BYPASS_TOKEN="<token-configurado-no-backend>"
export SUPERADMIN_EMAIL="superadmin@dominio.com"
export SUPERADMIN_PASSWORD="senha"
export USER_EMAIL="usuario@dominio.com"
export USER_PASSWORD="senha"
```

## 1) Preparação / ativar maintenance

### Linux

```bash
mkdir -p "$APP_BASE_DIR/shared"
cat > "$APP_BASE_DIR/shared/maintenance.json" <<'JSON'
{
  "enabled": true,
  "reason": "QA maintenance test",
  "startedAt": "2026-03-05T12:00:00Z",
  "etaSeconds": 300,
  "allowedRoles": ["SUPER_ADMIN"],
  "bypassHeader": "X-Maintenance-Bypass"
}
JSON
```

### Windows PowerShell

```powershell
$file = "$env:APP_BASE_DIR\shared\maintenance.json"
New-Item -ItemType Directory -Force -Path (Split-Path $file) | Out-Null
$json = "{`n  \"enabled\": true,`n  \"reason\": \"QA maintenance test\",`n  \"startedAt\": \"2026-03-05T12:00:00Z\",`n  \"etaSeconds\": 300,`n  \"allowedRoles\": [\"SUPER_ADMIN\"],`n  \"bypassHeader\": \"X-Maintenance-Bypass\"`n}"
Set-Content -Path $file -Value $json
```

Validar:

```bash
curl -s "$BASE_URL/api/system/maintenance/state"
```

Esperado (`200`):

```json
{
  "enabled": true,
  "reason": "QA maintenance test",
  "startedAt": "2026-03-05T12:00:00Z",
  "etaSeconds": 300
}
```

Checagem de sanitização (não pode conter `allowedRoles`, `bypassHeader`):

```bash
curl -s "$BASE_URL/api/system/maintenance/state" | jq 'has("allowedRoles") or has("bypassHeader")'
# esperado: false
```

## 2) Obter tokens (SUPER_ADMIN e usuário comum)

```bash
SUPER_TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$SUPERADMIN_EMAIL\",\"password\":\"$SUPERADMIN_PASSWORD\"}" | jq -r '.accessToken')

USER_TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$USER_EMAIL\",\"password\":\"$USER_PASSWORD\"}" | jq -r '.accessToken')
```

## 3) Teste A - rotas permitidas em manutenção

```bash
curl -i "$BASE_URL/api/health"
curl -i "$BASE_URL/api/system/maintenance/state"
curl -i -H "Authorization: Bearer $SUPER_TOKEN" "$BASE_URL/api/system/update/status"
curl -i -H "Authorization: Bearer $SUPER_TOKEN" "$BASE_URL/api/system/update/log?tail=50"
```

Esperado:
- `/api/health`: `200`
- `/api/system/maintenance/state`: `200`
- `/api/system/update/status` e `/log`: `200` com token admin válido (sem token: `401/403`)

## 4) Teste B - rotas bloqueadas

Observacao: no projeto atual, criacao de backup usa POST /api/backups (nao POST /api/backups/run).

```bash
curl -i -H "Authorization: Bearer $SUPER_TOKEN" "$BASE_URL/api/tenants"
curl -i -X POST -H "Authorization: Bearer $SUPER_TOKEN" "$BASE_URL/api/backups"
curl -i "$BASE_URL/logos/<arquivo-existente>"
curl -i "$BASE_URL/secure/<arquivo>"
```

Esperado:
- `/api/tenants`: `503` com body:

```json
{
  "error": "MAINTENANCE_MODE",
  "message": "Sistema em manutencao. Tente novamente em alguns minutos.",
  "reason": "...",
  "etaSeconds": 300
}
```

- `POST /api/backups`: `503`
- `GET /logos/<arquivo-existente>`: `200`
- `GET /secure/<arquivo>`: `403` ou `404` (nunca `200`)

## 5) Teste C - bypass

### SUPER_ADMIN sem header

```bash
curl -i -H "Authorization: Bearer $SUPER_TOKEN" "$BASE_URL/api/tenants"
```

Esperado: `503`

### SUPER_ADMIN com header de bypass

```bash
curl -i \
  -H "Authorization: Bearer $SUPER_TOKEN" \
  -H "X-Maintenance-Bypass: $MAINT_BYPASS_TOKEN" \
  "$BASE_URL/api/tenants"
```

Esperado: volta ao comportamento normal da rota (`200`/`403` conforme regra de auth/role local). Para SUPER_ADMIN em `/api/tenants`, esperado típico: `200`.

### Usuário comum com header de bypass

```bash
curl -i \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "X-Maintenance-Bypass: $MAINT_BYPASS_TOKEN" \
  "$BASE_URL/api/tenants"
```

Esperado: `503` (bypass negado por role).

## 6) Teste D - CORS e headers expostos

> Execute com maintenance OFF para não receber bloqueio 503 nas rotas de backup legado.

```bash
# desligar maintenance rapidamente
rm -f "$APP_BASE_DIR/shared/maintenance.json"

curl -i \
  -H "Origin: https://qa.example.com" \
  -H "Authorization: Bearer $SUPER_TOKEN" \
  "$BASE_URL/api/backup/available"
```

Esperado no response headers:
- `Access-Control-Expose-Headers` contendo:
  - `X-API-Deprecated`
  - `Deprecation`
  - `Link`
  - `Warning`
- Header de depreciação da API legado (`X-API-Deprecated: true`) em rotas `/api/backup/*`.

## 7) Limpeza (final)

```bash
rm -f "$APP_BASE_DIR/shared/maintenance.json"
curl -i "$BASE_URL/api/health"
```

Esperado: sistema volta ao fluxo normal (sem 503 global).

