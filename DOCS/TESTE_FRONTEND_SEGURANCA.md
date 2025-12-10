# 🧪 Guia de Teste - Frontend de Segurança

## ⚡ Teste Rápido (5 minutos)

### 1️⃣ Iniciar Aplicação

```bash
# Terminal 1 - Backend
cd backend
npm run start:dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

**Aguarde até ver:**
- Backend: `🚀 Backend rodando em http://localhost:4000`
- Frontend: `✓ Ready in X ms`

### 2️⃣ Fazer Login como SUPER_ADMIN

1. Abra: http://localhost:5000
2. Faça login com credenciais de SUPER_ADMIN
3. Você deve ver o dashboard

### 3️⃣ Testar Menu

**Verifique se aparecem:**
- ✅ Dashboard
- ✅ Empresas
- ✅ Usuários
- ✅ **Logs de Auditoria** (NOVO)
- ✅ Configurações

---

## 🧪 TESTE 1: Logs de Auditoria (3 minutos)

### Passo 1: Acessar Logs
1. Clique em **"Logs de Auditoria"** no menu
2. A página deve carregar

### Passo 2: Verificar Estatísticas
Você deve ver 3 cards no topo:
- **Total de Logs:** Número total
- **Ação Mais Comum:** LOGIN_SUCCESS (provavelmente)
- **Usuários Ativos:** Número de usuários

### Passo 3: Verificar Lista de Logs
Você deve ver logs como:
```
[LOGIN_SUCCESS] 18/11/2024 12:30:45
João Silva (joao@example.com) [SUPER_ADMIN]
IP: ::1
▼ Ver detalhes
```

### Passo 4: Testar Filtros
1. Digite "LOGIN" no campo **Ação**
2. Clique em **Buscar**
3. Deve mostrar apenas logs de login

### Passo 5: Testar Detalhes
1. Clique em **"Ver detalhes"** em um log
2. Deve expandir mostrando JSON com detalhes

### Passo 6: Testar Paginação
1. Se houver mais de 20 logs, você verá botões de paginação
2. Clique em **"Próxima"**
3. Deve carregar próxima página

✅ **Resultado Esperado:**
- Página carrega sem erros
- Estatísticas aparecem
- Logs aparecem
- Filtros funcionam
- Detalhes expandem
- Paginação funciona

---

## 🧪 TESTE 2: Configurações de Segurança (5 minutos)

### Passo 1: Acessar Configurações
1. Clique em **"Configurações"** no menu
2. Clique em **"Segurança"** (ou acesse `/configuracoes/seguranca`)
3. A página deve carregar

### Passo 2: Verificar Aviso
Você deve ver um aviso amarelo:
```
⚠️ Atenção!
Alterações nas configurações de segurança afetam todo o sistema.
```

### Passo 3: Verificar Seções
Você deve ver 4 seções:
1. **Rate Limiting**
2. **Política de Senha**
3. **Tokens e Sessão**
4. **Autenticação 2FA**

### Passo 4: Testar Edição - Rate Limiting
1. Altere **"Tentativas de Login"** de `5` para `3`
2. Altere **"Janela de Tempo"** de `1` para `2`
3. **NÃO SALVE AINDA**

### Passo 5: Testar Edição - Política de Senha
1. Altere **"Tamanho Mínimo"** de `8` para `10`
2. Clique no switch **"Exigir Caractere Especial"** para desativar
3. **NÃO SALVE AINDA**

### Passo 6: Testar Edição - Tokens
1. Altere **"Access Token"** de `15m` para `30m`
2. Altere **"Timeout de Sessão"** de `30` para `60`
3. **NÃO SALVE AINDA**

### Passo 7: Testar Edição - 2FA
1. Clique no switch **"Habilitar 2FA"** para ativar
2. O switch **"Tornar Obrigatório"** deve ficar habilitado
3. **NÃO SALVE AINDA**

### Passo 8: Salvar Alterações
1. Clique no botão **"Salvar Alterações"** (topo ou rodapé)
2. Deve aparecer um toast verde: **"Configurações salvas"**
3. Aguarde 2 segundos

### Passo 9: Verificar Persistência
1. Recarregue a página (F5)
2. Verifique se todas as alterações foram mantidas:
   - Tentativas de Login: `3`
   - Janela de Tempo: `2`
   - Tamanho Mínimo: `10`
   - Caractere Especial: Desativado
   - Access Token: `30m`
   - Timeout: `60`
   - 2FA: Ativado

✅ **Resultado Esperado:**
- Página carrega sem erros
- Todas as seções aparecem
- Campos são editáveis
- Switches funcionam
- Salvar funciona
- Toast aparece
- Alterações persistem após reload

---

## 🧪 TESTE 3: Restrição de Acesso (2 minutos)

### Passo 1: Fazer Logout
1. Clique no botão **"Sair"** no menu

### Passo 2: Login como ADMIN ou USER
1. Faça login com usuário ADMIN ou USER
2. Você deve ver o dashboard

### Passo 3: Verificar Menu
O menu **NÃO deve mostrar:**
- ❌ Logs de Auditoria
- ❌ Submenu "Segurança" em Configurações

### Passo 4: Tentar Acessar Diretamente
1. Digite na URL: `http://localhost:5000/logs`
2. Deve redirecionar para `/dashboard`

3. Digite na URL: `http://localhost:5000/configuracoes/seguranca`
4. Deve redirecionar para `/dashboard`

✅ **Resultado Esperado:**
- ADMIN/USER não veem os menus
- Acesso direto redireciona para dashboard
- Sem erros no console

---

## 🧪 TESTE 4: Integração Backend (3 minutos)

### Passo 1: Verificar Logs no Banco
```bash
cd backend
npx prisma studio
```

1. Abra tabela **audit_logs**
2. Deve ter logs de:
   - LOGIN_SUCCESS
   - LOGIN_FAILED (se testou senha errada)

### Passo 2: Verificar Configurações no Banco
1. Abra tabela **security_config**
2. Deve ter 1 registro com as configurações que você salvou
3. Verifique se os valores estão corretos:
   - loginMaxAttempts: 3
   - passwordMinLength: 10
   - twoFactorEnabled: true

### Passo 3: Testar Rate Limiting
```powershell
# Tentar login 4 vezes (deve bloquear na 4ª, pois mudamos para 3)
for ($i=1; $i -le 4; $i++) {
  Write-Host "Tentativa $i"
  curl -X POST http://localhost:4000/auth/login `
    -H "Content-Type: application/json" `
    -d '{"email":"test@test.com","password":"wrong"}'
}
```

✅ **Resultado Esperado:**
- Tentativas 1-3: `{"message":"Credenciais inválidas"}`
- Tentativa 4: `{"message":"Too Many Requests"}` ✅ BLOQUEADO!

---

## ✅ Checklist Final

Marque cada item após testar:

### Logs de Auditoria
- [ ] Página carrega sem erros
- [ ] Estatísticas aparecem
- [ ] Logs aparecem na lista
- [ ] Filtros funcionam
- [ ] Detalhes expandem
- [ ] Paginação funciona
- [ ] Apenas SUPER_ADMIN acessa

### Configurações de Segurança
- [ ] Página carrega sem erros
- [ ] Aviso aparece
- [ ] Todas as 4 seções aparecem
- [ ] Campos são editáveis
- [ ] Switches funcionam
- [ ] Salvar funciona
- [ ] Toast de sucesso aparece
- [ ] Alterações persistem após reload
- [ ] Apenas SUPER_ADMIN acessa

### Restrição de Acesso
- [ ] ADMIN não vê "Logs de Auditoria"
- [ ] USER não vê "Logs de Auditoria"
- [ ] Acesso direto redireciona
- [ ] Sem erros no console

### Integração
- [ ] Logs salvos no banco
- [ ] Configurações salvas no banco
- [ ] Rate limiting funciona com novos valores

---

## 🆘 Problemas Comuns

### Página em branco
**Solução:**
1. Abra DevTools (F12) → Console
2. Veja o erro
3. Verifique se backend está rodando
4. Verifique se você é SUPER_ADMIN

### "Cannot find module"
**Solução:**
```bash
cd frontend
npm install
npm run dev
```

### Configurações não salvam
**Solução:**
1. Verifique console do navegador (F12)
2. Verifique se você é SUPER_ADMIN
3. Verifique se backend está rodando
4. Veja logs do backend no terminal

### Rate limiting não funciona
**Solução:**
1. Aguarde 1 minuto entre testes
2. Verifique se as configurações foram salvas
3. Reinicie o backend

### Logs não aparecem
**Solução:**
1. Faça login/logout algumas vezes para gerar logs
2. Verifique se há logs no banco (Prisma Studio)
3. Verifique console do navegador

---

## 🎯 Após Validar

Se todos os itens estiverem ✅:

**PARABÉNS! 🎉**

Você implementou com sucesso:
- ✅ Headers de Segurança (Helmet)
- ✅ Rate Limiting
- ✅ Logs de Auditoria (Backend + Frontend)
- ✅ Configurações de Segurança (Backend + Frontend)

**Próximas opções:**
1. **Fase 3:** Refresh Tokens
2. **Fase 7:** Validação de Senha Robusta
3. **Fase 8:** Autenticação 2FA

**Me avise qual fase você quer implementar agora!** 🚀
