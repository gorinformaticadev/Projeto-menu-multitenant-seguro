# 🧪 Guia de Teste - FASE 2

## ⚠️ PASSO 1: Reiniciar Backend (OBRIGATÓRIO)

```bash
# 1. Parar o backend (Ctrl+C no terminal)

# 2. Gerar Prisma Client
cd backend
npx prisma generate

# 3. Reiniciar backend
npm run start:dev
```

**Aguarde até ver:**
```
🚀 Backend rodando em http://localhost:4000
🛡️  Headers de segurança ativados (Helmet)
```

---

## 🧪 TESTE 1: Rate Limiting (2 minutos)

### Windows PowerShell:
```powershell
# Tentar login 6 vezes seguidas
for ($i=1; $i -le 6; $i++) {
  Write-Host "`nTentativa $i" -ForegroundColor Yellow
  curl -X POST http://localhost:4000/auth/login `
    -H "Content-Type: application/json" `
    -d '{"email":"test@test.com","password":"wrong"}' | ConvertFrom-Json
  Start-Sleep -Seconds 1
}
```

### Resultado Esperado:
```
Tentativa 1: {"message":"Credenciais inválidas","statusCode":401}
Tentativa 2: {"message":"Credenciais inválidas","statusCode":401}
Tentativa 3: {"message":"Credenciais inválidas","statusCode":401}
Tentativa 4: {"message":"Credenciais inválidas","statusCode":401}
Tentativa 5: {"message":"Credenciais inválidas","statusCode":401}
Tentativa 6: {"message":"Too Many Requests","statusCode":429} ✅ BLOQUEADO!
```

---

## 🧪 TESTE 2: Logs de Auditoria (3 minutos)

### 1. Fazer Login com Sucesso
```bash
# Substitua com suas credenciais reais
curl -X POST http://localhost:4000/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"admin@example.com","password":"SUA_SENHA"}'
```

**Copie o `accessToken` retornado**

### 2. Consultar Logs (apenas SUPER_ADMIN)
```bash
# Substitua SEU_TOKEN pelo token copiado
curl http://localhost:4000/audit-logs `
  -H "Authorization: Bearer SEU_TOKEN"
```

### Resultado Esperado:
```json
{
  "data": [
    {
      "id": "uuid...",
      "action": "LOGIN_SUCCESS",
      "userId": "uuid...",
      "tenantId": "uuid...",
      "ipAddress": "::1",
      "userAgent": "curl/...",
      "details": "{\"email\":\"admin@example.com\"}",
      "createdAt": "2024-11-18T..."
    },
    {
      "action": "LOGIN_FAILED",
      "details": "{\"email\":\"test@test.com\",\"reason\":\"user_not_found\"}"
    }
  ],
  "meta": {
    "total": 7,
    "page": 1,
    "limit": 50,
    "totalPages": 1
  }
}
```

### 3. Consultar Estatísticas
```bash
curl http://localhost:4000/audit-logs/stats `
  -H "Authorization: Bearer SEU_TOKEN"
```

---

## 🧪 TESTE 3: Configurações de Segurança (2 minutos)

### 1. Obter Configurações Atuais
```bash
curl http://localhost:4000/security-config `
  -H "Authorization: Bearer SEU_TOKEN_SUPER_ADMIN"
```

### Resultado Esperado:
```json
{
  "id": "uuid...",
  "loginMaxAttempts": 5,
  "loginWindowMinutes": 1,
  "globalMaxRequests": 100,
  "globalWindowMinutes": 1,
  "passwordMinLength": 8,
  "passwordRequireUppercase": true,
  "passwordRequireLowercase": true,
  "passwordRequireNumbers": true,
  "passwordRequireSpecial": true,
  "accessTokenExpiresIn": "15m",
  "refreshTokenExpiresIn": "7d",
  "twoFactorEnabled": false,
  "twoFactorRequired": false,
  "sessionTimeout": 30
}
```

### 2. Atualizar Configurações
```bash
curl -X PUT http://localhost:4000/security-config `
  -H "Authorization: Bearer SEU_TOKEN_SUPER_ADMIN" `
  -H "Content-Type: application/json" `
  -d '{
    "loginMaxAttempts": 3,
    "passwordMinLength": 10
  }'
```

---

## 🧪 TESTE 4: Verificar Banco de Dados

### Abrir Prisma Studio:
```bash
cd backend
npx prisma studio
```

### Verificar Tabelas:
1. **audit_logs** - Deve ter registros de LOGIN_SUCCESS e LOGIN_FAILED
2. **security_config** - Deve ter 1 registro com as configurações
3. **refresh_tokens** - Vazia por enquanto (Fase 3)

---

## ✅ Checklist de Validação

Marque cada item após testar:

- [ ] Backend reiniciou sem erros
- [ ] Rate limiting funciona (6ª tentativa bloqueada)
- [ ] Logs de login aparecem no banco
- [ ] API `/audit-logs` retorna logs (SUPER_ADMIN)
- [ ] API `/audit-logs/stats` retorna estatísticas
- [ ] API `/security-config` retorna configurações
- [ ] API PUT `/security-config` atualiza configurações
- [ ] Apenas SUPER_ADMIN acessa as APIs de logs e config
- [ ] Tabelas criadas no Prisma Studio

---

## 🆘 Problemas Comuns

### Erro: "Cannot find module '@nestjs/throttler'"
```bash
cd backend
npm install @nestjs/throttler
```

### Erro: "Property 'auditLog' does not exist"
```bash
cd backend
npx prisma generate
npm run start:dev
```

### Erro: "Forbidden" ao acessar logs
- Certifique-se de estar usando token de SUPER_ADMIN
- Verifique se o usuário tem role SUPER_ADMIN no banco

### Rate limiting não funciona
- Aguarde 1 minuto entre testes
- Verifique se ThrottlerModule está configurado no app.module.ts

---

## 🎯 Após Validar

Se todos os itens estiverem ✅:

**Opção A (Recomendado):** Criar frontend para Configurações e Logs  
**Opção B:** Continuar com Fase 3 - Refresh Tokens

**Me avise qual opção prefere!**
