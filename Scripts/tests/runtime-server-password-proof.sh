#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/multitenant/gorpluggor/apps/backend}"
API_BASE="${API_BASE:-http://127.0.0.1:4000/api}"
PM2_APP="${PM2_APP:-gorpluggor-backend}"
TWOFA_CODE="${TWOFA_CODE:-}"

RESP_FILE="$(mktemp)"
NEW_ERR_FILE="$(mktemp)"
TMP_LOGIN_META="$(mktemp)"
TMP_USER_META="$(mktemp)"
FAILURES=0

cleanup() {
  rm -f "$RESP_FILE" "$NEW_ERR_FILE" "$TMP_LOGIN_META" "$TMP_USER_META"
}
trap cleanup EXIT

info() { echo "[INFO] $*"; }
ok() { echo "[OK] $*"; }
fail() {
  echo "[FAIL] $*"
  FAILURES=$((FAILURES + 1))
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[FATAL] Comando obrigatorio ausente: $1"
    exit 1
  fi
}

http_call() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  local token="${4:-}"

  local -a args
  args=(-sS -o "$RESP_FILE" -w "%{http_code}" -X "$method" "$url")

  if [[ -n "$token" ]]; then
    args+=(-H "Authorization: Bearer $token")
  fi

  if [[ -n "$body" ]]; then
    args+=(-H "Content-Type: application/json" -d "$body")
  fi

  curl "${args[@]}"
}

expect_code() {
  local label="$1"
  local code="$2"
  local expected_csv="$3"

  IFS=',' read -r -a expected <<<"$expected_csv"
  local match=0
  for value in "${expected[@]}"; do
    if [[ "$code" == "$value" ]]; then
      match=1
      break
    fi
  done

  if [[ "$match" -eq 1 ]]; then
    ok "$label (HTTP $code)"
  else
    fail "$label (HTTP $code, esperado: $expected_csv)"
    echo "--- resposta ---"
    cat "$RESP_FILE" || true
    echo
    echo "----------------"
  fi
}

require_cmd curl
require_cmd node
require_cmd pm2

if [[ ! -d "$APP_DIR" ]]; then
  echo "[FATAL] Diretorio APP_DIR nao encontrado: $APP_DIR"
  exit 1
fi

cd "$APP_DIR"
if [[ ! -f ".env" ]]; then
  echo "[FATAL] Arquivo .env nao encontrado em $APP_DIR"
  exit 1
fi

set -a
source .env
set +a

ADMIN_EMAIL="${ADMIN_EMAIL:-${INSTALL_ADMIN_EMAIL:-}}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-${INSTALL_ADMIN_PASSWORD:-}}"

if [[ -z "${ADMIN_EMAIL:-}" || -z "${ADMIN_PASSWORD:-}" ]]; then
  echo "[FATAL] Credenciais de admin ausentes (INSTALL_ADMIN_EMAIL / INSTALL_ADMIN_PASSWORD)."
  exit 1
fi

ERR_LOG="$HOME/.pm2/logs/${PM2_APP}-error.log"
ERR_OFFSET=0
if [[ -f "$ERR_LOG" ]]; then
  ERR_OFFSET="$(wc -c <"$ERR_LOG" | tr -d ' ')"
fi

info "Reiniciando backend com --update-env..."
pm2 restart "$PM2_APP" --update-env >/dev/null
ok "PM2 restart concluido"

info "Aguardando healthcheck do backend..."
HEALTH_OK=0
for _ in $(seq 1 40); do
  if curl -fsS "$API_BASE/health" >/dev/null 2>&1; then
    HEALTH_OK=1
    break
  fi
  sleep 2
done

if [[ "$HEALTH_OK" -eq 1 ]]; then
  ok "Backend respondeu em $API_BASE/health"
else
  fail "Backend nao respondeu ao healthcheck"
  pm2 logs "$PM2_APP" --lines 120 --nostream || true
  echo "[FATAL] Fluxo interrompido por indisponibilidade do backend."
  exit 1
fi

info "Executando login real..."
LOGIN_BODY="$(node -e "const [email,password]=process.argv.slice(1);process.stdout.write(JSON.stringify({ email, password }));" "$ADMIN_EMAIL" "$ADMIN_PASSWORD")"
LOGIN_CODE="$(http_call "POST" "$API_BASE/auth/login" "$LOGIN_BODY")"
expect_code "Login inicial" "$LOGIN_CODE" "200,401"

ACCESS_TOKEN=""
if [[ "$LOGIN_CODE" == "200" ]]; then
  node - <<'NODE' "$RESP_FILE" >"$TMP_LOGIN_META"
const fs = require('fs');
const p = process.argv[2];
let r = {};
try { r = JSON.parse(fs.readFileSync(p, 'utf8')); } catch {}
const token = r.accessToken || r.token || r?.data?.accessToken || r?.data?.token || '';
const requiresTwoFactor = Boolean(r.requiresTwoFactor || r.twoFactorRequired || r?.data?.requiresTwoFactor || r?.challenge === '2fa');
console.log(token);
console.log(requiresTwoFactor ? '1' : '0');
NODE

  mapfile -t LOGIN_META <"$TMP_LOGIN_META"
  ACCESS_TOKEN="${LOGIN_META[0]:-}"
  REQUIRES_2FA="${LOGIN_META[1]:-0}"

  if [[ -z "$ACCESS_TOKEN" && "$REQUIRES_2FA" == "1" ]]; then
    if [[ -z "$TWOFA_CODE" ]]; then
      fail "Login exige 2FA e TWOFA_CODE nao foi informado para o teste runtime."
    else
      info "Login exige 2FA; tentando /auth/login-2fa..."
      LOGIN_2FA_BODY="$(node -e "const [email,password,code]=process.argv.slice(1);process.stdout.write(JSON.stringify({ email, password, code }));" "$ADMIN_EMAIL" "$ADMIN_PASSWORD" "$TWOFA_CODE")"
      LOGIN_2FA_CODE="$(http_call "POST" "$API_BASE/auth/login-2fa" "$LOGIN_2FA_BODY")"
      expect_code "Login com 2FA" "$LOGIN_2FA_CODE" "200"
      if [[ "$LOGIN_2FA_CODE" == "200" ]]; then
        ACCESS_TOKEN="$(node -e "const fs=require('fs');const r=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(r.accessToken||r.token||r?.data?.accessToken||r?.data?.token||'');" "$RESP_FILE" 2>/dev/null || true)"
      fi
    fi
  fi
else
  fail "Login retornou 401 com credenciais atuais"
fi

if [[ -z "$ACCESS_TOKEN" ]]; then
  echo "[FATAL] Sem access token. Nao e possivel validar fluxo de update."
  exit 1
fi
ok "Access token obtido"

info "Buscando usuario alvo para update..."
USERS_CODE="$(http_call "GET" "$API_BASE/users" "" "$ACCESS_TOKEN")"
expect_code "Listagem de usuarios" "$USERS_CODE" "200"

if [[ "$USERS_CODE" != "200" ]]; then
  echo "[FATAL] Sem listagem de usuarios, interrompendo."
  exit 1
fi

node - <<'NODE' "$RESP_FILE" "$ADMIN_EMAIL" >"$TMP_USER_META"
const fs = require('fs');
const p = process.argv[2];
const adminEmail = String(process.argv[3] || '').toLowerCase();
let r = {};
try { r = JSON.parse(fs.readFileSync(p, 'utf8')); } catch {}
let list = [];
if (Array.isArray(r)) list = r;
else if (Array.isArray(r.data)) list = r.data;
else if (Array.isArray(r.users)) list = r.users;
else if (Array.isArray(r.items)) list = r.items;
const candidate = list.find((u) => u?.id && String(u.email || '').toLowerCase() !== adminEmail) || list.find((u) => u?.id);
if (!candidate) {
  process.exit(1);
}
console.log(String(candidate.id));
console.log(String(candidate.email || ''));
NODE

mapfile -t USER_META <"$TMP_USER_META"
TARGET_USER_ID="${USER_META[0]:-}"
TARGET_USER_EMAIL="${USER_META[1]:-}"

if [[ -z "$TARGET_USER_ID" ]]; then
  echo "[FATAL] Nenhum usuario alvo encontrado para testar update."
  exit 1
fi
ok "Usuario alvo: $TARGET_USER_ID ($TARGET_USER_EMAIL)"

NOW_TAG="$(date +%s)"
STRONG_PASSWORD="SenhaRuntime!${NOW_TAG}Aa9"

info "Teste 1/4: update sem campo password..."
BODY_NO_PASSWORD="$(printf '{"name":"Runtime No Password %s"}' "$NOW_TAG")"
CODE_NO_PASSWORD="$(http_call "PATCH" "$API_BASE/users/$TARGET_USER_ID" "$BODY_NO_PASSWORD" "$ACCESS_TOKEN")"
expect_code "Update sem password" "$CODE_NO_PASSWORD" "200"

info "Teste 2/4: update com password vazio..."
BODY_EMPTY_PASSWORD="$(printf '{"name":"Runtime Empty Password %s","password":""}' "$NOW_TAG")"
CODE_EMPTY_PASSWORD="$(http_call "PATCH" "$API_BASE/users/$TARGET_USER_ID" "$BODY_EMPTY_PASSWORD" "$ACCESS_TOKEN")"
expect_code "Update com password vazio" "$CODE_EMPTY_PASSWORD" "200"

info "Teste 3/4: update com password fraca..."
BODY_WEAK_PASSWORD='{"password":"fraca"}'
CODE_WEAK_PASSWORD="$(http_call "PATCH" "$API_BASE/users/$TARGET_USER_ID" "$BODY_WEAK_PASSWORD" "$ACCESS_TOKEN")"
expect_code "Update com password fraca" "$CODE_WEAK_PASSWORD" "400"

info "Teste 4/4: update com password forte..."
BODY_STRONG_PASSWORD="$(printf '{"password":"%s"}' "$STRONG_PASSWORD")"
CODE_STRONG_PASSWORD="$(http_call "PATCH" "$API_BASE/users/$TARGET_USER_ID" "$BODY_STRONG_PASSWORD" "$ACCESS_TOKEN")"
expect_code "Update com password forte" "$CODE_STRONG_PASSWORD" "200"

if [[ -f "$ERR_LOG" ]]; then
  CURRENT_ERR_SIZE="$(wc -c <"$ERR_LOG" | tr -d ' ')"
  if [[ "$CURRENT_ERR_SIZE" -gt "$ERR_OFFSET" ]]; then
    tail -c "+$((ERR_OFFSET + 1))" "$ERR_LOG" >"$NEW_ERR_FILE" || true
  else
    : >"$NEW_ERR_FILE"
  fi
else
  : >"$NEW_ERR_FILE"
fi

if grep -E -q "UnknownElementException.*CustomConstraint|CustomConstraint element" "$NEW_ERR_FILE"; then
  fail "Erro CustomConstraint reapareceu apos restart/fluxos."
else
  ok "Erro CustomConstraint NAO reapareceu nos novos logs."
fi

echo
echo "========== RESUMO RUNTIME =========="
echo "Health: $([[ "$HEALTH_OK" -eq 1 ]] && echo OK || echo FAIL)"
echo "Login: $([[ -n "$ACCESS_TOKEN" ]] && echo OK || echo FAIL)"
echo "Update sem password: HTTP $CODE_NO_PASSWORD"
echo "Update password vazio: HTTP $CODE_EMPTY_PASSWORD"
echo "Update password fraca: HTTP $CODE_WEAK_PASSWORD"
echo "Update password forte: HTTP $CODE_STRONG_PASSWORD"
echo "CustomConstraint no novo log: $([[ "$FAILURES" -eq 0 ]] && echo NAO || (grep -E -q "CustomConstraint" "$NEW_ERR_FILE" && echo SIM || echo NAO))"
echo "===================================="
echo
echo "------ Trecho novo do error.log ------"
tail -n 120 "$NEW_ERR_FILE" || true
echo "--------------------------------------"

if [[ "$FAILURES" -gt 0 ]]; then
  echo "[RESULTADO] FALHA ($FAILURES verificacoes falharam)"
  exit 1
fi

echo "[RESULTADO] SUCESSO (todas as verificacoes passaram)"
