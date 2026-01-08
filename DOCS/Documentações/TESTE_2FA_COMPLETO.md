# 🧪 Guia de Teste - Autenticação 2FA Completa

## 📋 Pré-requisitos

- ✅ Backend rodando em `http://localhost:4000`
- ✅ Frontend rodando em `http://localhost:3000`
- ✅ Google Authenticator instalado no celular
- ✅ Usuário de teste criado no sistema

## 🎯 Cenários de Teste

### Cenário 1: Ativar 2FA pela primeira vez

**Objetivo:** Verificar que um usuário consegue ativar o 2FA

**Passos:**

1. **Fazer Login**
   - Acessar: `http://localhost:3000/login`
   - Email: `admin@system.com`
   - Senha: `admin123`
   - Clicar em "Entrar"
   - ✅ Deve redirecionar para dashboard

2. **Acessar Perfil**
   - Clicar em "Meu Perfil" no menu lateral
   - ✅ Deve abrir página de perfil

3. **Verificar Status Inicial**
   - Rolar até "Autenticação de Dois Fatores"
   - ✅ Status deve mostrar "2FA Desativado"
   - ✅ Badge deve mostrar "Inativo"
   - ✅ Deve ter botão "Ativar 2FA"

4. **Gerar QR Code**
   - Clicar em "Ativar 2FA"
   - ✅ Deve mostrar QR Code
   - ✅ Deve mostrar secret em texto
   - ✅ Deve ter instruções claras

5. **Escanear QR Code**
   - Abrir Google Authenticator no celular
   - Clicar em "+" ou "Adicionar conta"
   - Escanear o QR Code
   - ✅ Deve adicionar conta "Sistema Multitenant (admin@system.com)"
   - ✅ Deve mostrar código de 6 dígitos

6. **Ativar 2FA**
   - Digitar o código de 6 dígitos do app
   - Clicar em "Confirmar"
   - ✅ Deve mostrar toast "2FA ativado!"
   - ✅ Status deve mudar para "2FA Ativado"
   - ✅ Badge deve mostrar "Ativo"
   - ✅ QR Code deve desaparecer

**Resultado Esperado:** ✅ 2FA ativado com sucesso

---

### Cenário 2: Login com 2FA

**Objetivo:** Verificar que o login exige código 2FA

**Passos:**

1. **Fazer Logout**
   - Clicar em "Sair" no menu
   - ✅ Deve redirecionar para login

2. **Tentar Login Normal**
   - Email: `admin@system.com`
   - Senha: `admin123`
   - Clicar em "Entrar"
   - ✅ NÃO deve entrar direto
   - ✅ Deve mostrar tela de código 2FA

3. **Verificar Tela 2FA**
   - ✅ Deve mostrar título "Autenticação de Dois Fatores"
   - ✅ Deve ter input para código
   - ✅ Deve ter botão "← Voltar"
   - ✅ Deve ter botão "Entrar"

4. **Inserir Código Correto**
   - Abrir Google Authenticator
   - Ver código atual (ex: 123456)
   - Digitar no campo
   - Clicar em "Entrar"
   - ✅ Deve mostrar toast "Login realizado com sucesso!"
   - ✅ Deve redirecionar para dashboard

**Resultado Esperado:** ✅ Login com 2FA funcionando

---

### Cenário 3: Código 2FA Inválido

**Objetivo:** Verificar que códigos inválidos são rejeitados

**Passos:**

1. **Fazer Logout**
   - Clicar em "Sair"

2. **Fazer Login**
   - Email: `admin@system.com`
   - Senha: `admin123`
   - Clicar em "Entrar"
   - ✅ Deve mostrar tela 2FA

3. **Inserir Código Errado**
   - Digitar: `000000`
   - Clicar em "Entrar"
   - ✅ Deve mostrar toast de erro
   - ✅ Deve permanecer na tela 2FA
   - ✅ Campo deve ficar limpo

4. **Inserir Código Correto**
   - Abrir Google Authenticator
   - Digitar código correto
   - Clicar em "Entrar"
   - ✅ Deve fazer login com sucesso

**Resultado Esperado:** ✅ Validação de código funcionando

---

### Cenário 4: Voltar da Tela 2FA

**Objetivo:** Verificar que é possível voltar para login

**Passos:**

1. **Fazer Logout**
   - Clicar em "Sair"

2. **Fazer Login**
   - Email: `admin@system.com`
   - Senha: `admin123`
   - Clicar em "Entrar"
   - ✅ Deve mostrar tela 2FA

3. **Clicar em Voltar**
   - Clicar em "← Voltar"
   - ✅ Deve voltar para tela de login
   - ✅ Campos devem estar limpos
   - ✅ Deve poder fazer login novamente

**Resultado Esperado:** ✅ Navegação funcionando

---

### Cenário 5: Desativar 2FA

**Objetivo:** Verificar que é possível desativar o 2FA

**Passos:**

1. **Fazer Login com 2FA**
   - Email: `admin@system.com`
   - Senha: `admin123`
   - Código 2FA do app
   - ✅ Deve entrar no sistema

2. **Acessar Perfil**
   - Clicar em "Meu Perfil"
   - Rolar até "Autenticação de Dois Fatores"
   - ✅ Status deve mostrar "2FA Ativado"

3. **Desativar 2FA**
   - Abrir Google Authenticator
   - Ver código atual
   - Digitar no campo "Digite o código do seu app para desativar"
   - Clicar em "Desativar 2FA"
   - Confirmar ação no popup
   - ✅ Deve mostrar toast "2FA desativado"
   - ✅ Status deve mudar para "2FA Desativado"
   - ✅ Badge deve mostrar "Inativo"

4. **Verificar Login Normal**
   - Fazer logout
   - Fazer login com email e senha
   - ✅ NÃO deve pedir código 2FA
   - ✅ Deve entrar direto no dashboard

**Resultado Esperado:** ✅ Desativação funcionando

---

### Cenário 6: Múltiplos Usuários

**Objetivo:** Verificar que 2FA é individual por usuário

**Passos:**

1. **Usuário 1 com 2FA**
   - Login: `admin@system.com`
   - Ativar 2FA
   - Fazer logout

2. **Usuário 2 sem 2FA**
   - Login: `user@empresa1.com` / `user123`
   - ✅ NÃO deve pedir código 2FA
   - ✅ Deve entrar direto

3. **Verificar Perfil Usuário 2**
   - Acessar "Meu Perfil"
   - ✅ Status deve mostrar "2FA Desativado"
   - ✅ Pode ativar independentemente

4. **Voltar para Usuário 1**
   - Fazer logout
   - Login: `admin@system.com`
   - ✅ DEVE pedir código 2FA
   - ✅ 2FA ainda está ativo

**Resultado Esperado:** ✅ 2FA individual por usuário

---

### Cenário 7: Código Expirando

**Objetivo:** Verificar que códigos antigos não funcionam

**Passos:**

1. **Fazer Login**
   - Email: `admin@system.com`
   - Senha: `admin123`
   - ✅ Tela 2FA aparece

2. **Ver Código no App**
   - Abrir Google Authenticator
   - Anotar código atual (ex: 123456)
   - NÃO digitar ainda

3. **Esperar Código Expirar**
   - Aguardar ~30 segundos
   - Ver código mudar no app (ex: 789012)

4. **Tentar Código Antigo**
   - Digitar código antigo (123456)
   - Clicar em "Entrar"
   - ✅ Deve dar erro (código inválido)

5. **Usar Código Novo**
   - Digitar código novo (789012)
   - Clicar em "Entrar"
   - ✅ Deve fazer login com sucesso

**Resultado Esperado:** ✅ Códigos expiram corretamente

---

### Cenário 8: Rate Limiting

**Objetivo:** Verificar proteção contra brute force

**Passos:**

1. **Fazer Login**
   - Email: `admin@system.com`
   - Senha: `admin123`
   - ✅ Tela 2FA aparece

2. **Tentar Múltiplos Códigos Errados**
   - Digitar: `000000` → Erro
   - Digitar: `111111` → Erro
   - Digitar: `222222` → Erro
   - Digitar: `333333` → Erro
   - Digitar: `444444` → Erro
   - Digitar: `555555` → Erro (6ª tentativa)
   - ✅ Deve bloquear temporariamente

3. **Aguardar 1 Minuto**
   - Esperar rate limit resetar

4. **Tentar Código Correto**
   - Digitar código correto do app
   - ✅ Deve funcionar normalmente

**Resultado Esperado:** ✅ Rate limiting funcionando

---

## 🔍 Verificações no Backend

### Verificar no Banco de Dados

```bash
# Abrir Prisma Studio
cd backend
npx prisma studio
```

**Verificar tabela User:**
- Campo `twoFactorSecret` deve estar preenchido (quando ativo)
- Campo `twoFactorEnabled` deve ser `true` (quando ativo)

**Verificar tabela AuditLog:**
- Deve ter logs de:
  - `LOGIN_2FA_SUCCESS` - Login com 2FA bem-sucedido
  - `LOGIN_2FA_FAILED` - Tentativa com código errado
  - `USER_UPDATED` - Quando ativa/desativa 2FA

### Verificar Logs do Backend

```bash
# Ver logs em tempo real
cd backend
npm run start:dev
```

**Logs esperados:**
```
[2FA] Gerando QR Code para usuário: admin@system.com
[2FA] 2FA ativado para usuário: admin@system.com
[2FA] Login 2FA bem-sucedido: admin@system.com
[2FA] Login 2FA falhou: admin@system.com (código inválido)
[2FA] 2FA desativado para usuário: admin@system.com
```

---

## ✅ Checklist Final

### Funcionalidades Básicas
- [ ] Ativar 2FA gera QR Code
- [ ] QR Code pode ser escaneado
- [ ] Código do app funciona
- [ ] Login exige código 2FA
- [ ] Código inválido é rejeitado
- [ ] Desativar 2FA funciona

### Navegação
- [ ] Botão voltar funciona
- [ ] Transições são suaves
- [ ] Toasts aparecem corretamente
- [ ] Loading states funcionam

### Segurança
- [ ] Secret não é exposto após ativação
- [ ] Códigos expiram após 30s
- [ ] Rate limiting funciona
- [ ] Logs de auditoria são criados
- [ ] 2FA é individual por usuário

### UI/UX
- [ ] Instruções são claras
- [ ] Erros são descritivos
- [ ] Interface é responsiva
- [ ] Funciona em mobile

### Compatibilidade
- [ ] Google Authenticator funciona
- [ ] Microsoft Authenticator funciona
- [ ] Authy funciona

---

## 🐛 Problemas Comuns

### Problema: QR Code não aparece

**Solução:**
1. Verificar se backend está rodando
2. Verificar console do navegador
3. Verificar se usuário está autenticado
4. Verificar endpoint `/auth/2fa/generate`

### Problema: Código sempre inválido

**Solução:**
1. Verificar se relógio do servidor está sincronizado
2. Verificar se relógio do celular está sincronizado
3. Tentar código anterior ou próximo (janela de tolerância)
4. Verificar logs do backend

### Problema: Não pede 2FA no login

**Solução:**
1. Verificar se 2FA está realmente ativo no banco
2. Verificar campo `twoFactorEnabled` do usuário
3. Fazer logout completo e tentar novamente
4. Limpar cache do navegador

### Problema: Erro ao ativar 2FA

**Solução:**
1. Verificar se código está correto
2. Verificar se tem 6 dígitos
3. Tentar código mais recente
4. Verificar logs do backend

---

## 📊 Métricas de Sucesso

### Todos os testes passaram? ✅

**Parabéns!** Seu sistema de 2FA está funcionando perfeitamente!

**Próximos passos:**
1. Testar em produção
2. Documentar para usuários finais
3. Treinar equipe de suporte
4. Monitorar logs de auditoria

### Alguns testes falharam? ❌

**Não se preocupe!** Siga os passos:
1. Identificar qual cenário falhou
2. Verificar logs do backend
3. Verificar console do navegador
4. Consultar seção "Problemas Comuns"
5. Testar novamente

---

**Status:** 🧪 Guia de Teste Completo  
**Cenários:** 8 cenários principais  
**Tempo estimado:** 30-45 minutos  
**Nível:** Completo (básico + avançado)

