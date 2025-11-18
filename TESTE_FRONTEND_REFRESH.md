# 🧪 Guia de Teste - Frontend Refresh Tokens

## ⚡ Teste Rápido (5 minutos)

### 1️⃣ Configurar Token Curto (Para Teste)

```bash
# backend/.env
JWT_ACCESS_EXPIRES_IN="30s"  # 30 segundos
JWT_REFRESH_EXPIRES_IN="5m"  # 5 minutos
```

### 2️⃣ Reiniciar Backend

```bash
cd backend
npm run start:dev
```

### 3️⃣ Iniciar Frontend

```bash
cd frontend
npm run dev
```

### 4️⃣ Fazer Login

1. Acesse: http://localhost:5000
2. Faça login
3. Abra DevTools (F12) → Application → Session Storage
4. Verifique:
   - ✅ `@App:token` existe
   - ✅ `@App:refreshToken` existe

### 5️⃣ Aguardar Expiração

1. Aguarde 30 segundos
2. Clique em qualquer menu (ex: Logs)
3. Observe:
   - ✅ Página carrega normalmente
   - ✅ Sem erro 401
   - ✅ Token foi renovado automaticamente

### 6️⃣ Verificar Renovação

1. Abra DevTools → Application → Session Storage
2. Copie o `@App:token` atual
3. Aguarde 30 segundos
4. Clique em outro menu
5. Verifique que o token mudou (foi renovado)

### 7️⃣ Testar Logout

1. Clique em "Sair"
2. Verifique Session Storage:
   - ✅ Tokens foram removidos
3. Abra Prisma Studio:
   - ✅ Refresh token foi removido do banco

---

## ✅ Checklist

- [ ] Login salva 2 tokens
- [ ] Token renova automaticamente após 30s
- [ ] Página carrega sem erro
- [ ] Token muda após renovação
- [ ] Logout remove tokens
- [ ] Refresh token removido do banco

---

## 🎯 Sucesso!

Se todos os itens estiverem ✅, o sistema de refresh tokens está funcionando perfeitamente!

**Lembre-se:** Em produção, use `JWT_ACCESS_EXPIRES_IN="15m"`
