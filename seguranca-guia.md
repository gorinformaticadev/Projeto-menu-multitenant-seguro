# 🛡️ Guia de Implementação de Segurança

## 📊 Status Atual da Aplicação

### ✅ JÁ IMPLEMENTADO
- [x] **JWT Tokens** - Autenticação stateless com expiração (7 dias)
- [x] **bcrypt** - Hash seguro de senhas (10 salt rounds)
- [x] **Validation** - ValidationPipe global com class-validator
- [x] **CORS** - Configurado para frontend específico
- [x] **Guards** - JwtAuthGuard e RolesGuard (RBAC)
- [x] **Isolamento Multitenant** - TenantInterceptor automático
- [x] **Validação de Dados** - DTOs com class-validator

### ❌ A IMPLEMENTAR
- [x] **Headers de Segurança** (Helmet) ✅ FASE 1 CONCLUÍDA
- [x] **Rate Limiting** (proteção contra brute force) ✅ FASE 2 CONCLUÍDA
- [x] **Logs de Segurança/Auditoria** ✅ FASE 2 CONCLUÍDA (Backend + Frontend)
- [x] **Configurações de Segurança** ✅ FASE 2 CONCLUÍDA (Backend + Frontend)
- [x] **Refresh Tokens** (tokens de curta duração) ✅ FASE 3 CONCLUÍDA (Backend + Frontend)
- [ ] **Monitoramento** (Sentry)
- [ ] **HTTPS Enforcement**
- [x] **Validação de Senha Robusta** ✅ FASE 7 CONCLUÍDA
- [ ] **Autenticação 2FA**
- [ ] **Sanitização de Inputs**
- [ ] **Políticas CSP**

---

## 🎯 PLANO DE IMPLEMENTAÇÃO (10 FASES)

### FASE 1: Headers de Segurança (Helmet) ⏱️ 10 min
**Prioridade:** 🔴 CRÍTICA  
**Complexidade:** 🟢 BAIXA  
**Impacto:** Proteção contra XSS, clickjacking, MIME sniffing

**O que será feito:**
- Instalar e configurar Helmet.js
- Configurar Content Security Policy (CSP)
- Configurar HSTS (HTTP Strict Transport Security)
- Configurar X-Frame-Options
- Configurar X-Content-Type-Options

**Arquivos afetados:**
- `backend/src/main.ts`

**Como testar:**
```bash
# Verificar headers de segurança
curl -I http://localhost:4000/auth/login
```

---

### FASE 2: Rate Limiting (Proteção Brute Force) ⏱️ 15 min
**Prioridade:** 🔴 CRÍTICA  
**Complexidade:** 🟡 MÉDIA  
**Impacto:** Proteção contra ataques de força bruta

**O que será feito:**
- Configurar @nestjs/throttler globalmente
- Rate limiting específico para login (5 tentativas/minuto)
- Rate limiting específico para registro
- Rate limiting global (100 requisições/minuto)

**Arquivos afetados:**
- `backend/src/app.module.ts`
- `backend/src/auth/auth.controller.ts`

**Como testar:**
```bash
# Tentar fazer login 6 vezes seguidas
for i in {1..6}; do curl -X POST http://localhost:4000/auth/login -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"wrong"}'; done
```

---

### FASE 3: Refresh Tokens ⏱️ 30 min
**Prioridade:** 🟠 ALTA  
**Complexidade:** 🔴 ALTA  
**Impacto:** Segurança aprimorada com tokens de curta duração

**O que será feito:**
- Criar tabela RefreshToken no Prisma
- Access Token: 15 minutos
- Refresh Token: 7 dias
- Endpoint POST /auth/refresh
- Endpoint POST /auth/logout (invalidar refresh token)
- Rotação automática de refresh tokens

**Arquivos afetados:**
- `backend/prisma/schema.prisma`
- `backend/src/auth/auth.service.ts`
- `backend/src/auth/auth.controller.ts`
- `backend/src/auth/dto/refresh-token.dto.ts`
- `frontend/src/lib/api.ts`

**Como testar:**
```bash
# 1. Fazer login e receber access + refresh token
# 2. Esperar 16 minutos
# 3. Tentar usar access token (deve falhar)
# 4. Usar refresh token para obter novo access token
# 5. Fazer logout e tentar usar refresh token (deve falhar)
```

---

### FASE 4: Logs de Auditoria ⏱️ 25 min
**Prioridade:** 🟠 ALTA  
**Complexidade:** 🟡 MÉDIA  
**Impacto:** Rastreabilidade e compliance

**O que será feito:**
- Criar tabela AuditLog no Prisma
- Criar AuditService
- Criar AuditInterceptor
- Logar ações críticas: login, logout, criação/edição/exclusão
- Armazenar: usuário, ação, IP, user-agent, timestamp, detalhes

**Arquivos afetados:**
- `backend/prisma/schema.prisma`
- `backend/src/common/services/audit.service.ts`
- `backend/src/common/interceptors/audit.interceptor.ts`
- `backend/src/app.module.ts`

**Como testar:**
```bash
# 1. Fazer login
# 2. Criar um tenant
# 3. Editar um usuário
# 4. Verificar logs no banco de dados
SELECT * FROM "AuditLog" ORDER BY "createdAt" DESC LIMIT 10;
```

---

### FASE 5: Monitoramento com Sentry ⏱️ 15 min
**Prioridade:** 🟡 MÉDIA  
**Complexidade:** 🟢 BAIXA  
**Impacto:** Detecção proativa de erros

**O que será feito:**
- Configurar Sentry no backend
- Configurar Sentry no frontend
- Capturar exceções automaticamente
- Adicionar contexto do usuário aos erros
- Configurar filtros para não logar dados sensíveis

**Arquivos afetados:**
- `backend/src/main.ts`
- `backend/src/common/filters/sentry-exception.filter.ts`
- `frontend/src/app/layout.tsx`
- `backend/.env.example`
- `frontend/.env.example`

**Como testar:**
```bash
# 1. Criar conta gratuita no Sentry (sentry.io)
# 2. Obter DSN
# 3. Configurar no .env
# 4. Forçar um erro na aplicação
# 5. Verificar erro no dashboard do Sentry
```

---

### FASE 6: HTTPS Enforcement ⏱️ 10 min
**Prioridade:** 🔴 CRÍTICA (Produção)  
**Complexidade:** 🟢 BAIXA  
**Impacto:** Criptografia de dados em trânsito

**O que será feito:**
- Middleware para redirecionar HTTP → HTTPS
- Configurar apenas em produção
- Adicionar documentação de deploy

**Arquivos afetados:**
- `backend/src/main.ts`
- `DEPLOY.md` (novo)

**Como testar:**
```bash
# Em produção:
curl -I http://seu-dominio.com
# Deve retornar 301 redirect para https://
```

---

### FASE 7: Validação de Senha Robusta ⏱️ 20 min
**Prioridade:** 🟠 ALTA  
**Complexidade:** 🟡 MÉDIA  
**Impacto:** Prevenção de senhas fracas

**O que será feito:**
- Criar validador customizado de senha
- Requisitos: mínimo 8 caracteres, 1 maiúscula, 1 minúscula, 1 número, 1 especial
- Aplicar em registro e alteração de senha
- Mensagens de erro claras

**Arquivos afetados:**
- `backend/src/common/validators/password.validator.ts`
- `backend/src/auth/dto/register.dto.ts`
- `backend/src/users/dto/change-password.dto.ts`

**Como testar:**
```bash
# Tentar registrar com senhas fracas:
# "123456" - deve falhar
# "password" - deve falhar
# "Password1!" - deve passar
```

---

### FASE 8: Autenticação 2FA (TOTP) ⏱️ 45 min
**Prioridade:** 🟡 MÉDIA  
**Complexidade:** 🔴 ALTA  
**Impacto:** Camada extra de segurança

**O que será feito:**
- Instalar speakeasy e qrcode
- Adicionar campos twoFactorSecret e twoFactorEnabled no User
- Endpoint POST /auth/2fa/generate (gerar QR code)
- Endpoint POST /auth/2fa/enable (ativar 2FA)
- Endpoint POST /auth/2fa/disable (desativar 2FA)
- Endpoint POST /auth/2fa/verify (verificar código no login)
- Modificar fluxo de login para verificar 2FA

**Arquivos afetados:**
- `backend/prisma/schema.prisma`
- `backend/src/auth/auth.service.ts`
- `backend/src/auth/auth.controller.ts`
- `backend/src/auth/dto/verify-2fa.dto.ts`
- `frontend/src/components/TwoFactorSetup.tsx`
- `frontend/src/components/TwoFactorLogin.tsx`

**Como testar:**
```bash
# 1. Fazer login normalmente
# 2. Acessar configurações e ativar 2FA
# 3. Escanear QR code com Google Authenticator
# 4. Fazer logout
# 5. Fazer login novamente (deve pedir código 2FA)
# 6. Inserir código do app
```

---

### FASE 9: Sanitização de Inputs ⏱️ 15 min
**Prioridade:** 🟠 ALTA  
**Complexidade:** 🟢 BAIXA  
**Impacto:** Prevenção de XSS e injeção

**O que será feito:**
- Configurar class-sanitizer
- Adicionar @Trim() em todos os campos de texto
- Adicionar @Escape() em campos que podem conter HTML
- Criar pipe de sanitização global

**Arquivos afetados:**
- `backend/src/common/pipes/sanitization.pipe.ts`
- Todos os DTOs existentes

**Como testar:**
```bash
# Tentar criar tenant com espaços extras:
# "  Nome Fantasia  " → deve salvar como "Nome Fantasia"
# Tentar injetar script:
# "<script>alert('xss')</script>" → deve ser escapado
```

---

### FASE 10: Políticas CSP Avançadas ⏱️ 20 min
**Prioridade:** 🟡 MÉDIA  
**Complexidade:** 🟡 MÉDIA  
**Impacto:** Proteção avançada contra XSS

**O que será feito:**
- Configurar CSP detalhado no Helmet
- Permitir apenas recursos confiáveis
- Configurar nonce para scripts inline
- Adicionar report-uri para violações

**Arquivos afetados:**
- `backend/src/main.ts`
- `backend/src/common/middleware/csp.middleware.ts`

**Como testar:**
```bash
# Verificar headers CSP
curl -I http://localhost:4000
# Tentar carregar recurso não autorizado no frontend
```

---

## 📋 RESUMO DE PRIORIDADES

### 🔴 CRÍTICAS (Fazer Primeiro)
1. **FASE 1:** Headers de Segurança (Helmet)
2. **FASE 2:** Rate Limiting
3. **FASE 6:** HTTPS Enforcement (para produção)

### 🟠 ALTAS (Fazer em Seguida)
4. **FASE 3:** Refresh Tokens
5. **FASE 4:** Logs de Auditoria
6. **FASE 7:** Validação de Senha Robusta
7. **FASE 9:** Sanitização de Inputs

### 🟡 MÉDIAS (Fazer Depois)
8. **FASE 5:** Monitoramento com Sentry
9. **FASE 8:** Autenticação 2FA
10. **FASE 10:** Políticas CSP Avançadas

---

## 🚀 COMO VAMOS PROCEDER

### Para cada fase:
1. ✅ **Implementação** - Criar/modificar arquivos necessários
2. 🧪 **Testes** - Você testa manualmente
3. ✅ **Validação** - Confirmar que funciona
4. 📝 **Documentação** - Atualizar docs se necessário
5. ➡️ **Próxima Fase** - Avançar para a próxima

### Comandos úteis para testes:

```bash
# Iniciar backend
cd backend
npm run start:dev

# Iniciar frontend
cd frontend
npm run dev

# Ver logs do banco
npx prisma studio

# Testar endpoints
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"senha123"}'
```

---

## 📊 TEMPO ESTIMADO TOTAL

- **Implementação:** ~3-4 horas
- **Testes:** ~2 horas
- **Total:** ~5-6 horas

---

## 🎯 PRÓXIMO PASSO

**Vamos começar pela FASE 1: Headers de Segurança (Helmet)?**

Essa é a mais rápida e já vai adicionar várias proteções importantes!

Digite **"SIM"** para começarmos a FASE 1, ou me diga qual fase você prefere começar primeiro.
