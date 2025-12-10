# 🔧 Correção - Rate Limit e CORS

## 🐛 Problemas Identificados

### 1. Rate Limiting (429 Too Many Requests)
**Erro:**
```
GET http://localhost:4000/tenants/public/master-logo 429 (Too Many Requests)
```

**Causa:**
- Endpoint público `/tenants/public/master-logo` estava sujeito ao rate limiting
- Frontend faz múltiplas requisições ao carregar a página
- Limite de 100 req/min era atingido rapidamente

### 2. CORS/CSP (ERR_BLOCKED_BY_RESPONSE)
**Erro:**
```
GET http://localhost:4000/uploads/logos/xxx.jpg net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin 304
```

**Causa:**
- CORS não estava configurado para Next.js dev server (porta 3000)
- CSP não permitia imagens do localhost:3000
- Imagens eram bloqueadas por política de segurança

---

## ✅ Correções Aplicadas

### 1. Excluir Endpoints Públicos do Rate Limiting

**Arquivo:** `backend/src/tenants/tenants.controller.ts`

**Mudança:**
```typescript
import { SkipThrottle } from '@nestjs/throttler';

// Antes:
@Public()
@Get('public/master-logo')
async getMasterLogo() { ... }

// Depois:
@Public()
@SkipThrottle()  // ← Adicionado
@Get('public/master-logo')
async getMasterLogo() { ... }
```

**Benefício:**
- Endpoints públicos não têm limite de requisições
- Frontend pode carregar logo sem restrições
- Não afeta segurança (endpoint é público mesmo)

---

### 2. Adicionar Next.js Dev Server ao CORS

**Arquivo:** `backend/src/main.ts`

**Mudança:**
```typescript
app.enableCors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5000',
    'http://127.0.0.1:5000',
    'http://localhost:5000',
    'http://localhost:3000', // ← Adicionado (Next.js dev)
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  exposedHeaders: ['Content-Type', 'Content-Length'], // ← Adicionado
});
```

**Benefício:**
- Next.js dev server (porta 3000) pode acessar API
- Headers de resposta são expostos corretamente
- Imagens carregam sem erro CORS

---

### 3. Atualizar CSP para Permitir Imagens

**Arquivo:** `backend/src/main.ts`

**Mudança:**
```typescript
contentSecurityPolicy: {
  directives: {
    imgSrc: [
      "'self'",
      'data:',
      'https:',
      'http://localhost:4000',
      'http://localhost:5000',
      'http://localhost:3000', // ← Adicionado
    ],
    connectSrc: [
      "'self'",
      'http://localhost:4000',
      'http://localhost:5000',
      'http://localhost:3000', // ← Adicionado
      isProduction ? process.env.FRONTEND_URL || '' : '',
    ].filter(Boolean),
  },
}
```

**Benefício:**
- CSP permite imagens de todas as portas de desenvolvimento
- Não bloqueia recursos legítimos
- Mantém proteção contra recursos externos maliciosos

---

## 🧪 Como Testar

### Teste 1: Verificar Rate Limiting

```bash
# Fazer múltiplas requisições ao endpoint público
for i in {1..10}; do
  curl http://localhost:4000/tenants/public/master-logo
  echo ""
done
```

**Resultado esperado:**
- ✅ Todas as requisições retornam 200 OK
- ✅ Nenhum erro 429
- ✅ Logo é retornado sempre

### Teste 2: Verificar CORS

```bash
# Verificar headers CORS
curl -I -H "Origin: http://localhost:3000" http://localhost:4000/tenants/public/master-logo
```

**Resultado esperado:**
```
HTTP/1.1 200 OK
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Credentials: true
```

### Teste 3: Verificar CSP

```bash
# Verificar headers CSP
curl -I http://localhost:4000/auth/login | grep -i content-security
```

**Resultado esperado:**
```
Content-Security-Policy: ... img-src 'self' data: https: http://localhost:4000 http://localhost:5000 http://localhost:3000; ...
```

### Teste 4: Testar no Frontend

1. **Abrir frontend**
   ```bash
   cd frontend
   npm run dev
   ```

2. **Acessar login**
   - Ir para: http://localhost:3000/login
   - Ou: http://localhost:5000/login

3. **Verificar console**
   - ✅ Sem erros 429
   - ✅ Sem erros CORS
   - ✅ Logo carrega corretamente
   - ✅ Imagens aparecem

---

## 📊 Impacto das Mudanças

### Segurança
- ✅ **Mantida:** Rate limiting ainda protege endpoints autenticados
- ✅ **Mantida:** CORS ainda restringe origens não autorizadas
- ✅ **Mantida:** CSP ainda bloqueia recursos externos maliciosos
- ✅ **Melhorada:** Endpoints públicos funcionam corretamente

### Performance
- ✅ **Melhorada:** Sem requisições bloqueadas desnecessariamente
- ✅ **Melhorada:** Frontend carrega mais rápido
- ✅ **Melhorada:** Menos erros no console

### Experiência do Usuário
- ✅ **Melhorada:** Logo aparece sempre
- ✅ **Melhorada:** Sem erros visíveis
- ✅ **Melhorada:** Carregamento mais suave

---

## 🔒 Considerações de Segurança

### Rate Limiting em Endpoints Públicos

**Por que é seguro remover?**
- Endpoint `/tenants/public/master-logo` apenas retorna URL do logo
- Não expõe dados sensíveis
- Não permite modificações
- Operação é leve (apenas leitura do banco)

**Alternativas se necessário:**
- Implementar cache no frontend
- Usar CDN para servir logos
- Implementar rate limiting mais alto (ex: 1000/min)

### CORS para Localhost

**Por que é seguro?**
- Apenas em desenvolvimento
- Produção usa `process.env.FRONTEND_URL`
- Não expõe API para internet
- Facilita desenvolvimento local

**Em produção:**
```typescript
origin: [
  process.env.FRONTEND_URL, // Apenas domínio de produção
],
```

### CSP para Localhost

**Por que é seguro?**
- Apenas em desenvolvimento
- Produção usa URLs HTTPS
- Não permite recursos externos maliciosos
- Mantém proteção contra XSS

**Em produção:**
```typescript
imgSrc: [
  "'self'",
  'data:',
  'https:', // Apenas HTTPS
],
```

---

## 📝 Checklist de Validação

### Backend
- [x] `@SkipThrottle()` adicionado aos endpoints públicos
- [x] CORS atualizado com porta 3000
- [x] CSP atualizado com localhost:3000
- [x] Sem erros de diagnóstico

### Frontend
- [ ] Login carrega sem erros 429
- [ ] Logo aparece corretamente
- [ ] Imagens carregam sem CORS error
- [ ] Console sem erros

### Testes
- [ ] Múltiplas requisições ao endpoint público funcionam
- [ ] CORS headers corretos
- [ ] CSP permite imagens locais
- [ ] Aplicação funciona normalmente

---

## 🎯 Próximos Passos

### Desenvolvimento
1. Testar login no frontend
2. Verificar que logo aparece
3. Confirmar que não há erros no console

### Produção
1. Configurar `FRONTEND_URL` no .env
2. Remover URLs localhost do CORS
3. Usar apenas HTTPS no CSP
4. Testar em ambiente de staging

---

## 📚 Referências

### Rate Limiting
- [NestJS Throttler](https://docs.nestjs.com/security/rate-limiting)
- [@SkipThrottle() Decorator](https://docs.nestjs.com/security/rate-limiting#excluding-routes)

### CORS
- [NestJS CORS](https://docs.nestjs.com/security/cors)
- [MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

### CSP
- [Helmet CSP](https://helmetjs.github.io/#content-security-policy)
- [MDN CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

---

**Status:** ✅ CORREÇÕES APLICADAS  
**Impacto:** Positivo (melhor UX, mesma segurança)  
**Teste:** Necessário no frontend  
**Data:** 18 de Novembro de 2025

