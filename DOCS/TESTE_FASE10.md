# 🧪 Teste da FASE 10 - Políticas CSP Avançadas

## 🎯 Objetivo

Verificar que as políticas CSP avançadas estão funcionando corretamente.

---

## ⚙️ Pré-requisitos

- ✅ Backend rodando
- ✅ FASE 10 implementada
- ✅ Navegador com DevTools

---

## 🧪 Testes

### Teste 1: Verificar Headers CSP

**Objetivo:** Confirmar que o header CSP está sendo enviado

**Passos:**

```bash
# Verificar headers
curl -I http://localhost:4000/auth/login
```

**Resultado esperado:**
```
HTTP/1.1 200 OK
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-...'; ...
```

**✅ Passou se:**
- Header `Content-Security-Policy` está presente
- Contém `nonce-` com valor aleatório
- Contém todas as diretivas

---

### Teste 2: CSP Básico (Sem CSP_ADVANCED)

**Objetivo:** Verificar que CSP básico funciona por padrão

**Passos:**

1. **Verificar .env**
   ```bash
   # Deve estar comentado ou false
   # CSP_ADVANCED=false
   ```

2. **Reiniciar backend**
   ```bash
   cd backend
   npm run start:dev
   ```

3. **Verificar headers**
   ```bash
   curl -I http://localhost:4000/auth/login
   ```

**Resultado esperado:**
- CSP básico do Helmet (FASE 1)
- Sem nonce
- Políticas mais simples

---

### Teste 3: Ativar CSP Avançado

**Objetivo:** Ativar e testar CSP avançado

**Passos:**

1. **Editar .env**
   ```bash
   echo "CSP_ADVANCED=true" >> backend/.env
   ```

2. **Reiniciar backend**
   ```bash
   cd backend
   npm run start:dev
   ```

3. **Verificar logs**
   ```
   🚀 Backend rodando em http://localhost:4000
   🛡️  Headers de segurança ativados (Helmet)
   ```

4. **Verificar headers**
   ```bash
   curl -I http://localhost:4000/auth/login
   ```

**Resultado esperado:**
- Header CSP mais detalhado
- Contém nonce único
- Contém report-uri

---

### Teste 4: Testar Violação CSP

**Objetivo:** Verificar que violações são detectadas e reportadas

**Passos:**

1. **Criar arquivo de teste**
   ```html
   <!-- test-csp-violation.html -->
   <!DOCTYPE html>
   <html>
   <head>
     <title>Teste CSP</title>
   </head>
   <body>
     <h1>Teste de Violação CSP</h1>
     
     <!-- Script externo não autorizado -->
     <script src="https://evil.com/malicious.js"></script>
     
     <!-- Script inline sem nonce -->
     <script>
       console.log('Este script será bloqueado!');
     </script>
   </body>
   </html>
   ```

2. **Abrir no navegador**
   - Abrir DevTools (F12)
   - Ir para Console
   - Carregar o arquivo

**Resultado esperado:**
```
Refused to load the script 'https://evil.com/malicious.js' because it violates the following Content Security Policy directive: "script-src 'self' 'nonce-...'".

Refused to execute inline script because it violates the following Content Security Policy directive: "script-src 'self' 'nonce-...'". Either the 'unsafe-inline' keyword, a hash ('sha256-...'), or a nonce ('nonce-...') is required to enable inline execution.
```

---

### Teste 5: Verificar Relatórios CSP

**Objetivo:** Confirmar que violações são enviadas para o backend

**Passos:**

1. **Monitorar logs do backend**
   ```bash
   cd backend
   npm run start:dev
   # Deixar rodando e observar logs
   ```

2. **Causar violação CSP**
   - Abrir página com script não autorizado
   - Navegador envia relatório para `/api/csp-report`

3. **Ver logs**
   ```
   🚨 CSP Violation Detected: {
     documentUri: 'http://localhost:4000/...',
     violatedDirective: 'script-src',
     effectiveDirective: 'script-src',
     blockedUri: 'https://evil.com/malicious.js',
     sourceFile: 'http://localhost:4000/test.html',
     lineNumber: 10,
     columnNumber: 5
   }
   ```

**Resultado esperado:**
- ✅ Log de violação aparece
- ✅ Contém detalhes da violação
- ✅ Endpoint `/api/csp-report` funciona

---

### Teste 6: Modo Report-Only

**Objetivo:** Testar CSP sem bloquear (modo seguro)

**Passos:**

1. **Editar middleware**
   ```typescript
   // backend/src/common/middleware/csp.middleware.ts
   
   // Comentar linha:
   // res.setHeader('Content-Security-Policy', cspHeader);
   
   // Descomentar linha:
   res.setHeader('Content-Security-Policy-Report-Only', cspHeader);
   ```

2. **Reiniciar backend**

3. **Testar violação**
   - Carregar script não autorizado
   - Script DEVE executar (não bloqueado)
   - Mas violação DEVE ser reportada

**Resultado esperado:**
- ✅ Scripts executam normalmente
- ✅ Violações são reportadas
- ✅ Nada é bloqueado

**Benefício:**
- Testar CSP em produção sem quebrar
- Coletar violações reais
- Ajustar políticas antes de enforçar

---

### Teste 7: Verificar Nonce Único

**Objetivo:** Confirmar que nonce é único por requisição

**Passos:**

1. **Fazer múltiplas requisições**
   ```bash
   curl -I http://localhost:4000/auth/login | grep nonce
   curl -I http://localhost:4000/auth/login | grep nonce
   curl -I http://localhost:4000/auth/login | grep nonce
   ```

2. **Comparar nonces**

**Resultado esperado:**
```
script-src 'self' 'nonce-ABC123...'
script-src 'self' 'nonce-XYZ789...'
script-src 'self' 'nonce-DEF456...'
```

**✅ Passou se:**
- Cada requisição tem nonce diferente
- Nonces são aleatórios
- Nonces têm tamanho adequado (~24 chars)

---

### Teste 8: Verificar Políticas Específicas

**Objetivo:** Testar cada diretiva CSP

**Testes:**

#### A) default-src
```html
<!-- Deve bloquear -->
<iframe src="https://external.com"></iframe>
```

#### B) script-src
```html
<!-- Deve bloquear -->
<script src="https://cdn.external.com/lib.js"></script>

<!-- Deve permitir -->
<script src="/js/app.js"></script>
```

#### C) style-src
```html
<!-- Deve permitir (unsafe-inline) -->
<style>body { color: red; }</style>

<!-- Deve permitir (Google Fonts) -->
<link href="https://fonts.googleapis.com/css?family=Roboto" rel="stylesheet">
```

#### D) img-src
```html
<!-- Deve permitir -->
<img src="/logo.png">
<img src="data:image/png;base64,...">
<img src="https://example.com/image.jpg">
```

#### E) frame-src
```html
<!-- Deve bloquear -->
<iframe src="https://youtube.com/embed/..."></iframe>
```

---

### Teste 9: Ferramentas de Validação

**Objetivo:** Usar ferramentas online para validar CSP

**A) Security Headers:**

1. Acessar: https://securityheaders.com/
2. Inserir: `http://localhost:4000` (ou seu domínio)
3. Clicar em "Scan"

**Resultado esperado:**
- Nota A ou A+
- CSP presente e válido
- Todas as diretivas corretas

**B) CSP Evaluator:**

1. Acessar: https://csp-evaluator.withgoogle.com/
2. Copiar seu CSP header
3. Colar e analisar

**Resultado esperado:**
- Sem erros críticos
- Avisos apenas para unsafe-inline (necessário)
- Recomendações seguidas

---

### Teste 10: Teste de Integração

**Objetivo:** Verificar que CSP não quebra funcionalidades

**Checklist:**

- [ ] Login funciona normalmente
- [ ] Dashboard carrega
- [ ] Imagens aparecem
- [ ] Estilos aplicados
- [ ] Scripts executam
- [ ] API calls funcionam
- [ ] Sentry funciona
- [ ] Nenhum erro no console

**Se algo quebrar:**
1. Ver erro no console
2. Identificar recurso bloqueado
3. Adicionar exceção no CSP
4. Testar novamente

---

## ✅ Checklist Final

### Configuração
- [ ] CSP_ADVANCED configurado no .env
- [ ] Backend reiniciado
- [ ] Headers CSP aparecem

### Funcionalidade
- [ ] Nonce é gerado
- [ ] Nonce é único por requisição
- [ ] Violações são bloqueadas
- [ ] Relatórios são enviados
- [ ] Logs aparecem no backend

### Segurança
- [ ] Scripts externos bloqueados
- [ ] Scripts inline sem nonce bloqueados
- [ ] Frames bloqueados
- [ ] Recursos não autorizados bloqueados
- [ ] HTTPS upgrade funciona (produção)

### Integração
- [ ] Aplicação funciona normalmente
- [ ] Sem erros inesperados
- [ ] Sentry funciona
- [ ] API calls funcionam

---

## 🐛 Problemas Comuns

### Problema: CSP não aparece

**Solução:**
1. Verificar `CSP_ADVANCED=true` no .env
2. Reiniciar backend
3. Limpar cache do navegador
4. Verificar logs do backend

### Problema: Tudo está bloqueado

**Solução:**
1. Usar modo Report-Only
2. Coletar violações
3. Ajustar políticas
4. Testar novamente

### Problema: Nonce não funciona

**Solução:**
1. Verificar que nonce está no header
2. Verificar que nonce é único
3. Usar hash como alternativa
4. Ou remover scripts inline

### Problema: Sentry bloqueado

**Solução:**
1. Adicionar `https://*.sentry.io` em connect-src
2. Já está no código por padrão
3. Verificar SENTRY_DSN no .env

---

## 📊 Resultados Esperados

### Headers CSP Completos
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-ABC123';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' data: https: blob:;
  font-src 'self' data: https://fonts.gstatic.com;
  connect-src 'self' http://localhost:5000 https://*.sentry.io;
  frame-src 'none';
  frame-ancestors 'none';
  object-src 'none';
  media-src 'self';
  worker-src 'self' blob:;
  manifest-src 'self';
  base-uri 'self';
  form-action 'self';
  report-uri /api/csp-report;
```

### Logs de Violação
```
[Nest] 12345  - 18/11/2025, 10:30:00   WARN [CspReportController] 🚨 CSP Violation Detected: {
  documentUri: 'http://localhost:4000/test.html',
  violatedDirective: 'script-src',
  effectiveDirective: 'script-src',
  blockedUri: 'https://evil.com/malicious.js',
  sourceFile: 'http://localhost:4000/test.html',
  lineNumber: 10,
  columnNumber: 5
}
```

---

**Status:** ✅ FASE 10 TESTÁVEL  
**Testes:** 10 cenários  
**Tempo estimado:** 30-45 minutos  
**Nível:** Completo (básico + avançado)

