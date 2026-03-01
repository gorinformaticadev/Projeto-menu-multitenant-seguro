

# teste de notificação com token pelo terminal

TOKEN='COLOQUE AQUI SEU TOKEN'
API='https://seu dominio.com.br/api'

curl -X POST "$API/notifications" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Teste de Notificação","description":"Mensagem de teste","type":"info"}'


# Para obter token de login

API='https://SEuDominio.com.br/api'
EMAIL='SEUEMAILDeLogin@gmail.com'
SENHA='Senha de login'

RESP=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$SENHA\"}")

echo "$RESP"

TOKEN=$(printf '%s' "$RESP" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
echo "TOKEN tamanho: ${#TOKEN}"

