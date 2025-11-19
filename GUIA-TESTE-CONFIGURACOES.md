# 🧪 Guia de Teste - Configurações de Login e Inatividade

## 🚀 Passo 1: Reiniciar o Backend

**Execute o script:**
```powershell
.\restart-backend-full.ps1
```

**Ou manualmente:**
```bash
# 1. Parar o backend (Ctrl+C)
# 2. Aguardar 5 segundos
# 3. Executar:
cd backend
npx prisma generate
npm run start:dev
```

**Aguarde os logs:**
```
🚀 Backend rodando em http://localhost:4000
🛡️  Headers de segurança ativados (Helmet)
```

---

## 🧪 Teste 1: Configurar Tentativas de Login

### 1.1 Acessar Configurações

1. Abrir `http://localhost:5000`
2. Fazer login como **SUPER_ADMIN**
   - Email: `superadmin@system.com`
   - Senha: `Super@123`
3. Ir em **"Configurações"** (menu lateral)
4. Clicar em **"Segurança"**

### 1.2 Alterar Configurações

Na seção **"Controle de Tentativas de Login"**:

- **Máximo de Tentativas de Login:** `3`
- **Duração do Bloqueio:** `5` minutos

Clicar em **"Salvar Alterações"**

✅ Deve aparecer: "Configurações salvas"

---

## 🧪 Teste 2: Testar Bloqueio de Conta

### 2.1 Fazer Logout

1. Clicar no menu do usuário (canto superior direito)
2. Clicar em **"Sair"**

### 2.2 Tentar Login com Senha Errada

**1ª Tentativa:**
- Email: `superadmin@system.com`
- Senha: `senhaerrada123`
- Clicar em "Entrar"

**Resultado esperado:**
```
❌ Credenciais inválidas. Você tem 2 tentativas restantes.
```

**2ª Tentativa:**
- Email: `superadmin@system.com`
- Senha: `senhaerrada456`
- Clicar em "Entrar"

**Resultado esperado:**
```
❌ Credenciais inválidas. ATENÇÃO: Você tem apenas 1 tentativa restante antes de sua conta ser bloqueada por 5 minutos.
```

**3ª Tentativa:**
- Email: `superadmin@system.com`
- Senha: `senhaerrada789`
- Clicar em "Entrar"

**Resultado esperado:**
```
❌ Conta bloqueada por múltiplas tentativas de login. Tente novamente em 5 minutos ou contate um administrador.
```

### 2.3 Verificar Bloqueio

Tentar login com senha **correta**:
- Email: `superadmin@system.com`
- Senha: `Super@123`

**Resultado esperado:**
```
❌ Conta bloqueada por múltiplas tentativas de login. Tente novamente em X minuto(s) ou contate um administrador.
```

### 2.4 Desbloquear Manualmente (Opcional)

**Opção 1: Aguardar 5 minutos**
- Aguardar o tempo configurado
- Tentar login novamente
- Deve funcionar normalmente

**Opção 2: Desbloquear via Admin**
1. Fazer login com outro SUPER_ADMIN
2. Ir em "Usuários"
3. Encontrar o usuário bloqueado (badge vermelho "Bloqueado")
4. Clicar em "Desbloquear"
5. Tentar login novamente
6. Deve funcionar normalmente

---

## 🧪 Teste 3: Configurar Logout por Inatividade

### 3.1 Alterar Configuração

1. Login como SUPER_ADMIN
2. Ir em **"Configurações"** → **"Segurança"**
3. Na seção **"Tokens e Sessão"**:
   - **Logout por Inatividade:** `2` minutos (para teste rápido)
4. Clicar em **"Salvar Alterações"**
5. **IMPORTANTE:** Recarregar a página (Ctrl+Shift+R)

### 3.2 Testar Aviso de Inatividade

1. Ficar **sem mover o mouse** e **sem pressionar teclas**
2. Aguardar **1 minuto**

**Resultado esperado:**
```
⚠️ Sessão expirando
Você será deslogado em 1 minuto por inatividade. Mova o mouse ou pressione uma tecla para continuar.
```

### 3.3 Testar Reset de Timer

1. Após aparecer o aviso, **mover o mouse** ou **pressionar uma tecla**
2. Timer deve resetar
3. Aguardar mais 1 minuto
4. Aviso deve aparecer novamente

### 3.4 Testar Logout Automático

1. Ficar **completamente inativo** por **2 minutos**
2. Não mover mouse, não pressionar teclas

**Resultado esperado:**
```
❌ Sessão expirada
Você foi deslogado por inatividade.
```

3. Deve ser redirecionado para a tela de login

---

## 🧪 Teste 4: Verificar Logs de Auditoria

### 4.1 Acessar Logs

1. Login como SUPER_ADMIN
2. Ir em **"Logs de Auditoria"** (menu lateral)

### 4.2 Verificar Eventos

Deve aparecer os seguintes eventos:

- **LOGIN_FAILED** - Tentativas de login com senha errada
- **ACCOUNT_LOCKED** - Conta bloqueada após 3 tentativas
- **LOGIN_BLOCKED** - Tentativas de login com conta bloqueada
- **ACCOUNT_UNLOCKED** - Conta desbloqueada (se foi desbloqueada manualmente)
- **LOGIN_SUCCESS** - Login bem-sucedido após desbloquear
- **LOGOUT** - Logout manual ou automático

### 4.3 Verificar Detalhes

Clicar em um evento **ACCOUNT_LOCKED** e verificar:
```json
{
  "email": "superadmin@system.com",
  "attempts": 3,
  "maxAttempts": 3,
  "lockDurationMinutes": 5,
  "lockedUntil": "2024-11-19T12:05:00.000Z"
}
```

---

## ✅ Checklist de Testes

### Configuração de Tentativas de Login
- [ ] Consegue alterar "Máximo de Tentativas"
- [ ] Consegue alterar "Duração do Bloqueio"
- [ ] Configurações são salvas com sucesso
- [ ] Mensagens de erro mostram tentativas restantes
- [ ] Conta é bloqueada após atingir o limite
- [ ] Mensagem de bloqueio informa tempo restante
- [ ] Bloqueio expira automaticamente após o tempo
- [ ] Admin pode desbloquear manualmente
- [ ] Logs de auditoria registram todos os eventos

### Configuração de Logout por Inatividade
- [ ] Consegue alterar "Logout por Inatividade"
- [ ] Configuração é salva com sucesso
- [ ] Aviso aparece 1 minuto antes do logout
- [ ] Logout automático funciona após o tempo
- [ ] Timer é resetado ao mover mouse
- [ ] Timer é resetado ao pressionar tecla
- [ ] Timer é resetado ao fazer scroll
- [ ] Redirecionamento para login funciona
- [ ] Toast de notificação aparece

---

## 🎯 Valores Recomendados para Produção

Após os testes, configure valores adequados para produção:

### Tentativas de Login
- **Máximo de Tentativas:** `5` (padrão)
- **Duração do Bloqueio:** `30` minutos (padrão)

### Logout por Inatividade
- **Logout por Inatividade:** `30` minutos (padrão)
- Ou `60` minutos para sistemas com menos risco
- Ou `15` minutos para sistemas de alta segurança

---

## 🐛 Problemas Comuns

### Configurações não salvam
**Solução:** Verificar se está logado como SUPER_ADMIN

### Bloqueio não funciona
**Solução:** Reiniciar o backend após a migration

### Logout por inatividade não funciona
**Solução:** Recarregar a página após salvar configuração

### Mensagens antigas aparecem
**Solução:** Limpar cache do navegador (Ctrl+Shift+Delete)

---

**✅ Testes completos! Sistema pronto para uso.**
