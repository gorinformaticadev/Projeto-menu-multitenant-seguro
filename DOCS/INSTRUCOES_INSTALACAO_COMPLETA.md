# Instruções Completas de Instalação - Checklist de Segurança

**Data**: 10/12/2024  
**Versão**: 1.0  
**Status**: Implementação Parcial - Requer Instalação Manual

## 🚨 ATENÇÃO: Passos Obrigatórios

As implementações foram concluídas no código, mas **É NECESSÁRIO** executar os seguintes passos para ativar as funcionalidades:

### ✅ Tarefas Obrigatórias (em ordem)

1. **Parar o backend** (se estiver rodando)
2. **Instalar dependências**
3. **Aplicar migração do Prisma**
4. **Regenerar Prisma Client**
5. **Reiniciar backend**
6. **Testar funcionalidades**

---

## 📋 Passo a Passo Detalhado

### Passo 1: Parar o Backend

```powershell
# Se o backend estiver rodando, pare-o
# Ctrl+C no terminal ou feche o processo
```

### Passo 2: Instalar Novas Dependências

```powershell
cd backend

# Instalar dependências de produção
npm install nodemailer

# Instalar dependências de desenvolvimento
npm install --save-dev @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint eslint-plugin-security husky
```

**Dependências Adicionadas**:
- `nodemailer`: Envio de emails
- `eslint-plugin-security`: Análise de segurança de código
- `husky`: Git hooks para automação

### Passo 3: Aplicar Migração do Prisma

```powershell
# Aplicar migração que adiciona campos de segurança
npx prisma migrate dev

# Se perguntado sobre o nome da migração, pressione Enter (já está definido)
```

**Campos Adicionados ao Banco**:

**Tabela `users`**:
- `emailVerified` (Boolean)
- `emailVerificationToken` (String)
- `emailVerificationExpires` (DateTime)
- `passwordHistory` (String - JSON)
- `lastPasswordChange` (DateTime)

**Tabela `security_config`**:
- `twoFactorRequiredForAdmins` (Boolean)
- `twoFactorSuggested` (Boolean)
- `emailVerificationRequired` (Boolean)
- `emailVerificationLevel` (String)
- `passwordReuseLimit` (Integer)

### Passo 4: Regenerar Prisma Client

```powershell
npx prisma generate
```

Isto regenerará o client do Prisma com os novos campos, eliminando erros de TypeScript.

### Passo 5: Configurar SMTP (Opcional mas Recomendado)

Editar `backend/.env` e adicionar:

```bash
# Configurações de Email
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="seu-email@gmail.com"
SMTP_PASS="sua-senha-de-app-do-gmail"
EMAIL_FROM="noreply@seudominio.com"
EMAIL_FROM_NAME="Sistema Multitenant"
```

**Como obter senha de app do Gmail**:
1. https://myaccount.google.com/apppasswords
2. Selecionar "App" → "Outro" → "Sistema Multitenant"
3. Copiar senha gerada (16 caracteres)

**Se não configurar SMTP**:
- Sistema funcionará, mas emails não serão enviados
- Verificação de email ficará desabilitada
- Logs indicarão "Email service desabilitado"

### Passo 6: Iniciar Backend

```powershell
npm run start:dev
```

Aguardar mensagens de confirmação:
- ✅ `Prisma schema loaded`
- ✅ `Backend rodando em http://localhost:4000`
- ✅ `Email service configurado` (se SMTP configurado)

### Passo 7: Verificar Instalação

```powershell
# Executar script de verificação de segurança
.\scripts\security-check.ps1
```

**Resultado esperado**:
```
✅ APROVADO: Sistema passou em todas as verificações!
```

---

## 🔒 Novas Funcionalidades Disponíveis

### 1. Sistema de Verificação de Email

**Endpoints**:
- `POST /auth/email/send-verification` - Enviar email (3 req/hora)
- `POST /auth/email/verify` - Verificar com token
- `GET /auth/email/status` - Status de verificação

**Configuração** (via `SecurityConfig`):
```sql
UPDATE security_config SET
  email_verification_required = true,
  email_verification_level = 'SOFT'; -- SOFT | MODERATE | STRICT
```

**Níveis**:
- `SOFT`: Apenas aviso, acesso completo
- `MODERATE`: Funções limitadas até verificação
- `STRICT`: Bloqueio total

### 2. 2FA Obrigatório para Admins

**Configuração**:
```sql
UPDATE security_config SET
  two_factor_required_for_admins = true;
```

**Comportamento**:
- Admins sem 2FA ativado não conseguem fazer login
- Erro: "2FA é obrigatório para sua conta"
- Log de auditoria: `LOGIN_2FA_REQUIRED`

### 3. Política de Reutilização de Senha

**Configuração**:
```sql
UPDATE security_config SET
  password_reuse_limit = 5; -- Últimas 5 senhas
```

**Comportamento**:
- Sistema mantém hash das últimas N senhas
- Impede reutilização ao trocar senha
- Erro: "Esta senha já foi utilizada recentemente"

### 4. ESLint com Regras de Segurança

**Executar**:
```powershell
npm run lint          # Verificar problemas
npm run lint:fix      # Corrigir automaticamente
```

**Regras Ativas**:
- `security/detect-eval-with-expression`: Bloqueia `eval()`
- `security/detect-unsafe-regex`: ReDoS protection
- `security/detect-possible-timing-attacks`: Timing attacks
- E mais 10+ regras de segurança

### 5. Scripts de Automação

**Security Check Completo**:
```powershell
.\scripts\security-check.ps1
```

Verifica:
- ✅ Vulnerabilidades npm
- ✅ Problemas de código (ESLint)
- ✅ Variáveis sensíveis
- ✅ Arquivos sensíveis commitados
- ✅ Configurações de segurança

**Integração CI/CD**:
```yaml
# .github/workflows/security.yml
- name: Security Check
  run: |
    cd backend
    npm run security:check
```

---

## 🧪 Testes de Verificação

### Teste 1: Email Verification

```powershell
# 1. Login como admin
$login = Invoke-RestMethod -Uri "http://localhost:4000/auth/login" -Method POST `
  -Body (@{ email = "admin@system.com"; password = "Admin@123456" } | ConvertTo-Json) `
  -ContentType "application/json"

$token = $login.accessToken

# 2. Solicitar email de verificação
Invoke-RestMethod -Uri "http://localhost:4000/auth/email/send-verification" -Method POST `
  -Headers @{ Authorization = "Bearer $token" }

# 3. Verificar status
Invoke-RestMethod -Uri "http://localhost:4000/auth/email/status" -Method GET `
  -Headers @{ Authorization = "Bearer $token" }
```

### Teste 2: 2FA Obrigatório para Admins

```sql
-- Ativar 2FA obrigatório
UPDATE security_config SET two_factor_required_for_admins = true;
```

```powershell
# Tentar login como admin SEM 2FA ativado
Invoke-RestMethod -Uri "http://localhost:4000/auth/login" -Method POST `
  -Body (@{ email = "admin@system.com"; password = "Admin@123456" } | ConvertTo-Json) `
  -ContentType "application/json"

# Resultado esperado: Erro 401
# "2FA é obrigatório para sua conta"
```

### Teste 3: Política de Senha

```powershell
# Criar usuário e trocar senha 2x para a mesma
# Resultado: Segunda tentativa deve falhar
# "Esta senha já foi utilizada recentemente"
```

### Teste 4: ESLint Security

```powershell
cd backend
npm run lint

# Deve retornar sem erros se código está seguro
```

---

## 📊 Estrutura de Arquivos Criados

```
backend/
├── src/
│   ├── email/
│   │   ├── email.service.ts          # ✅ NOVO - Serviço de email
│   │   └── email.module.ts           # ✅ NOVO
│   ├── auth/
│   │   ├── email-verification.service.ts  # ✅ NOVO
│   │   └── dto/verify-email.dto.ts   # ✅ NOVO
│   ├── common/services/
│   │   └── password-history.service.ts    # ✅ NOVO
│   └── ...
├── scripts/
│   └── security-check.ps1            # ✅ NOVO - Automação
├── .eslintrc.json                    # ✅ NOVO - Configuração ESLint
├── prisma/
│   └── migrations/
│       └── 20251210182215_add_email_verification_and_password_history/
│           └── migration.sql         # ✅ CRIADA
└── ...

DOCS/
├── CHECKLIST_SEMANAL_SEGURANCA.md    # ✅ NOVO
├── GUIA_VERIFICACAO_EMAIL.md         # ✅ NOVO
├── RESUMO_IMPLEMENTACAO_SECURITY_CHECKLIST.md  # ✅ NOVO
└── INSTRUCOES_INSTALACAO_COMPLETA.md # ✅ ESTE ARQUIVO
```

---

## ⚠️ Problemas Conhecidos e Soluções

### Problema 1: Erros de TypeScript após implementação

**Causa**: Prisma Client não regenerado

**Solução**:
```powershell
npx prisma generate
```

### Problema 2: Migração falha

**Causa**: Backend rodando e bloqueando banco

**Solução**:
```powershell
# 1. Parar backend (Ctrl+C)
# 2. Aplicar migração
npx prisma migrate dev
# 3. Reiniciar backend
npm run start:dev
```

### Problema 3: Emails não enviados

**Causa**: SMTP não configurado ou credenciais inválidas

**Solução**:
- Verificar configurações SMTP no `.env`
- Testar credenciais do Gmail
- Verificar logs: `Email service desabilitado`

### Problema 4: ESLint não encontrado

**Causa**: Dependências não instaladas

**Solução**:
```powershell
npm install --save-dev eslint eslint-plugin-security @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

---

## 🎯 Checklist Pós-Instalação

- [ ] Backend parado
- [ ] Dependências instaladas (`npm install`)
- [ ] Migração aplicada (`npx prisma migrate dev`)
- [ ] Prisma regenerado (`npx prisma generate`)
- [ ] SMTP configurado no `.env` (opcional)
- [ ] Backend reiniciado
- [ ] Security check executado (`.\scripts\security-check.ps1`)
- [ ] Teste de email verification realizado
- [ ] Teste de 2FA obrigatório realizado
- [ ] ESLint executado sem erros
- [ ] Documentação revisada

---

## 📞 Suporte

**Documentação Relacionada**:
- `GUIA_VERIFICACAO_EMAIL.md` - Detalhes do sistema de email
- `CHECKLIST_SEMANAL_SEGURANCA.md` - Rotina de segurança
- `RESUMO_IMPLEMENTACAO_SECURITY_CHECKLIST.md` - Visão geral

**Em caso de problemas**:
1. Verificar logs do backend
2. Consultar documentação específica
3. Executar `.\scripts\security-check.ps1` para diagnóstico

---

**Última atualização**: 10/12/2024  
**Versão**: 1.0
