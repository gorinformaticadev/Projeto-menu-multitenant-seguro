# 🧪 Guia de Teste - FASE 3: Refresh Tokens

## ⚡ Teste Rápido (5 minutos)

### 1️⃣ Reiniciar Backend

```bash
# Parar backend (Ctrl+C)
cd backend

# Adicionar variáveis no .env
# JWT_ACCESS_EXPIRES_IN="15m"
# JWT_REFRESH_EXPIRES_IN="7d"

# Reiniciar
npm run start:dev
```

### 2️⃣ Testar Login

```powershell
# Fazer login
$response = curl -X POST http://localhost:4000/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"admin@example.com","password":"SUA_SENHA"}' | ConvertFrom-Json

# Salvar tokens
$accessToken = $response.accessToken
$refreshToken = $response.refreshToken

Write-Host "Access Token: $accessToken"
Write-Host "Refresh Token: $refreshToken"
```

**Resultado Esperado:**
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "a1b2c3d4e5f6...",
  "user": { ... }
}
```

### 3️⃣ Testar Renovação

```powershell
# Renovar token
$newResponse = curl -X POST http://localhost:4000/auth/refresh `
  -H "Content-Type: application/json" `
  -d "{\"refreshToken\":\"$refreshToken\"}" | ConvertFrom-Json

$newAccessToken = $newResponse.accessToken
$newRefreshToken = $newResponse.refreshToken

Write-Host "Novo Access Token: $newAccessToken"
Write-Host "Novo Refresh Token: $newRefreshToken"
```

**Resultado Esperado:**
- ✅ Retorna novos tokens
- ✅ Tokens são diferentes dos anteriores

### 4️⃣ Testar Rotação

```powershell
# Tentar usar refresh token antigo
curl -X POST http://localhost:4000/auth/refresh `
  -H "Content-Type: application/json" `
  -d "{\"refreshToken\":\"$refreshToken\"}"
```

**Resultado Esperado:**
```json
{
  "statusCode": 401,
  "message": "Refresh token inválido"
}
```

### 5️⃣ Testar Logout

```powershell
# Fazer logout
curl -X POST http://localhost:4000/auth/logout `
  -H "Authorization: Bearer $newAccessToken" `
  -H "Content-Type: application/json" `
  -d "{\"refreshToken\":\"$newRefreshToken\"}"
```

**Resultado Esperado:**
```json
{
  "message": "Logout realizado com sucesso"
}
```

### 6️⃣ Verificar Banco

```bash
cd backend
npx prisma studio
```

1. Abra tabela **refresh_tokens**
2. Deve estar vazia (logout removeu)

3. Abra tabela **audit_logs**
4. Deve ter logs de:
   - LOGIN_SUCCESS
   - TOKEN_REFRESHED
   - LOGOUT

---

## ✅ Checklist

- [ ] Login retorna accessToken + refreshToken
- [ ] Refresh renova tokens
- [ ] Refresh token antigo não funciona (rotação)
- [ ] Logout invalida token
- [ ] Logs aparecem no banco
- [ ] Tabela refresh_tokens vazia após logout

---

## 🎯 Próximo Passo

**Atualizar Frontend** para usar refresh tokens automaticamente!

Me avise quando estiver pronto para implementar o frontend.
