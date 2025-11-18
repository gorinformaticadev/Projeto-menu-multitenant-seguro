# ✅ FASE 5 IMPLEMENTADA - Monitoramento com Sentry

## 🎯 O que foi implementado

### 1. Backend - Sentry
- ✅ SentryService para captura de erros
- ✅ SentryExceptionFilter global
- ✅ Captura automática de exceções 500+
- ✅ Contexto do usuário nos erros
- ✅ Filtros para dados sensíveis
- ✅ Performance monitoring
- ✅ Profiling

### 2. Frontend - Sentry
- ✅ Configuração client-side
- ✅ Configuração server-side
- ✅ Configuração edge
- ✅ Filtros para dados sensíveis
- ✅ Captura automática de erros

### 3. Proteção de Dados Sensíveis
- ✅ Senhas filtradas
- ✅ Tokens filtrados
- ✅ Headers de autenticação removidos
- ✅ Cookies removidos

## 📁 Arquivos Criados/Modificados

### Backend
- ✅ `backend/src/common/services/sentry.service.ts` - Serviço
- ✅ `backend/src/common/services/sentry.module.ts` - Módulo
- ✅ `backend/src/common/filters/sentry-exception.filter.ts` - Filtro
- ✅ `backend/src/main.ts` - Inicialização
- ✅ `backend/src/app.module.ts` - Registro
- ✅ `backend/.env.example` - Variável SENTRY_DSN

### Frontend
- ✅ `frontend/sentry.client.config.ts` - Config client
- ✅ `frontend/sentry.server.config.ts` - Config server
- ✅ `frontend/sentry.edge.config.ts` - Config edge
- ✅ `frontend/.env.example` - Variável SENTRY_DSN

## 🔧 Como Configurar

### 1. Criar Conta no Sentry

1. Acesse: https://sentry.io/
2. Crie uma conta gratuita
3. Crie um novo projeto:
   - **Backend:** Node.js / Express
   - **Frontend:** Next.js

### 2. Obter DSN

Após criar o projeto, copie o DSN:
```
https://abc123@o123456.ingest.sentry.io/7890123
```

### 3. Configurar Backend

```bash
# backend/.env
SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/7890123
NODE_ENV=production
```

### 4. Configurar Frontend

```bash
# frontend/.env.local
NEXT_PUBLIC_SENTRY_DSN=https://xyz789@o123456.ingest.sentry.io/7890456
```

### 5. Reiniciar Aplicações

```bash
# Backend
cd backend
npm run start:prod

# Frontend
cd frontend
npm run build
npm start
```

## 🧪 Como Testar

### Teste 1: Erro no Backend

```bash
# Criar endpoint de teste (temporário)
# backend/src/app.controller.ts
@Get('test-error')
testError() {
  throw new Error('Teste de erro no Sentry');
}

# Fazer requisição
curl http://localhost:4000/test-error
```

**Resultado esperado:**
- Erro capturado no Sentry
- Dashboard mostra o erro
- Stack trace completo
- Contexto HTTP

### Teste 2: Erro no Frontend

```tsx
// Adicionar botão de teste (temporário)
<button onClick={() => {
  throw new Error('Teste de erro no Sentry');
}}>
  Testar Erro
</button>
```

**Resultado esperado:**
- Erro capturado no Sentry
- Dashboard mostra o erro
- Stack trace completo
- Contexto do navegador

### Teste 3: Verificar Filtros de Dados Sensíveis

```bash
# Fazer login com senha
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"SenhaSecreta123!"}'

# Forçar erro (senha errada)
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"errada"}'
```

**Verificar no Sentry:**
- ✅ Senha deve aparecer como `[FILTERED]`
- ✅ Headers de autorização removidos
- ✅ Cookies removidos

### Teste 4: Contexto do Usuário

```bash
# Fazer login
TOKEN=$(curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"senha"}' \
  | jq -r '.accessToken')

# Forçar erro autenticado
curl http://localhost:4000/test-error \
  -H "Authorization: Bearer $TOKEN"
```

**Verificar no Sentry:**
- ✅ Erro deve incluir dados do usuário:
  - ID
  - Email
  - Role

## 📊 Dashboard do Sentry

### O que você verá:

1. **Issues (Problemas)**
   - Lista de erros capturados
   - Frequência de ocorrência
   - Última ocorrência
   - Usuários afetados

2. **Performance**
   - Tempo de resposta das APIs
   - Transações mais lentas
   - Gargalos de performance

3. **Releases**
   - Erros por versão
   - Comparação entre versões

4. **Alerts**
   - Notificações por email/Slack
   - Alertas de spike de erros

## 🔒 Dados Filtrados

### Backend
```typescript
// Antes de enviar para Sentry
{
  "email": "user@example.com",
  "password": "SenhaSecreta123!",
  "refreshToken": "abc123xyz789"
}

// Depois do filtro
{
  "email": "user@example.com",
  "password": "[FILTERED]",
  "refreshToken": "[FILTERED]"
}
```

### Headers Removidos
- `authorization`
- `cookie`

## 📈 Métricas Importantes

### Erros para Monitorar
- **500 Internal Server Error** - Bugs no código
- **401 Unauthorized** - Problemas de autenticação
- **403 Forbidden** - Problemas de permissão
- **Database errors** - Problemas no banco

### Performance
- **Tempo de resposta** - APIs lentas
- **Taxa de erro** - % de requisições com erro
- **Throughput** - Requisições por segundo

## ⚙️ Configurações Avançadas

### Sample Rate (Taxa de Amostragem)

```typescript
// Desenvolvimento: 100% dos erros
tracesSampleRate: 1.0

// Produção: 10% dos erros (economiza quota)
tracesSampleRate: 0.1
```

### Ambientes

```typescript
environment: process.env.NODE_ENV
// "development", "staging", "production"
```

### Releases

```typescript
// Rastrear versão da aplicação
release: "1.0.0"
```

### Breadcrumbs (Rastros)

```typescript
// Adicionar rastro de ações do usuário
sentryService.addBreadcrumb(
  'Usuário fez login',
  'auth',
  { email: 'user@example.com' }
);
```

## 🔔 Alertas

### Configurar no Sentry:

1. **Ir em Alerts → Create Alert**
2. **Escolher tipo:**
   - Issues: Novos erros
   - Metric: Taxa de erro alta
   - Crash Free: % de sessões sem crash

3. **Configurar condições:**
   - Erro ocorre X vezes em Y minutos
   - Taxa de erro > Z%

4. **Configurar notificações:**
   - Email
   - Slack
   - PagerDuty
   - Webhook

## ✅ Checklist de Validação

- [ ] Conta Sentry criada
- [ ] Projetos criados (backend + frontend)
- [ ] DSN configurado no .env
- [ ] Backend captura erros 500+
- [ ] Frontend captura erros
- [ ] Dados sensíveis filtrados
- [ ] Contexto do usuário incluído
- [ ] Dashboard mostra erros
- [ ] Alertas configurados

## 🎯 Próximos Passos

### Integração com CI/CD
```bash
# Enviar source maps para Sentry
sentry-cli releases new 1.0.0
sentry-cli releases files 1.0.0 upload-sourcemaps ./dist
sentry-cli releases finalize 1.0.0
```

### Outras Fases
- FASE 8: Autenticação 2FA
- FASE 10: Políticas CSP Avançadas

---

**Status:** ✅ FASE 5 CONCLUÍDA  
**Próxima:** Escolha a próxima fase!  
**Tempo gasto:** ~15 minutos
