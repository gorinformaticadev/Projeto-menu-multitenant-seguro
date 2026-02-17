# 🛡️ Headers de Segurança (Helmet)

## ✅ IMPLEMENTADO - FASE 1

Este documento explica todos os headers de segurança configurados no backend.

## 📋 Headers Configurados

### 1. Content-Security-Policy (CSP)
**Proteção:** XSS (Cross-Site Scripting)

```
Content-Security-Policy: 
  default-src 'self';
  style-src 'self' 'unsafe-inline';
  script-src 'self';
  img-src 'self' data: https: http://localhost:4000;
  connect-src 'self' http://localhost:4000 http://localhost:5000;
  font-src 'self' data:;
  object-src 'none';
  media-src 'self';
  frame-src 'none';
```

**O que faz:**
- `default-src 'self'` - Apenas recursos do próprio domínio
- `style-src 'self' 'unsafe-inline'` - Permite estilos inline (necessário para frameworks)
- `script-src 'self'` - Apenas scripts do próprio domínio
- `img-src` - Permite imagens do servidor e data URIs
- `connect-src` - Permite conexões com backend e frontend
- `object-src 'none'` - Bloqueia plugins (Flash, Java)
- `frame-src 'none'` - Previne clickjacking

### 2. Strict-Transport-Security (HSTS)
**Proteção:** Man-in-the-Middle, Downgrade Attacks

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

**O que faz:**
- Força o navegador a usar HTTPS por 1 ano
- Aplica a todos os subdomínios
- Permite inclusão na lista de preload do navegador

### 3. X-Frame-Options
**Proteção:** Clickjacking

```
X-Frame-Options: DENY
```

**O que faz:**
- Impede que o site seja carregado em um iframe
- Previne ataques de clickjacking

### 4. X-Content-Type-Options
**Proteção:** MIME Type Sniffing

```
X-Content-Type-Options: nosniff
```

**O que faz:**
- Impede que o navegador "adivinhe" o tipo de conteúdo
- Força o navegador a respeitar o Content-Type declarado

### 5. X-DNS-Prefetch-Control
**Proteção:** Privacy Leaks

```
X-DNS-Prefetch-Control: off
```

**O que faz:**
- Desabilita DNS prefetching
- Previne vazamento de informações sobre sites visitados

### 6. X-Download-Options
**Proteção:** Drive-by Downloads (IE)

```
X-Download-Options: noopen
```

**O que faz:**
- Impede que o IE abra downloads automaticamente
- Específico para Internet Explorer

### 7. Referrer-Policy
**Proteção:** Information Leakage

```
Referrer-Policy: strict-origin-when-cross-origin
```

**O que faz:**
- Envia referrer completo para mesma origem
- Envia apenas origem para cross-origin
- Não envia referrer em downgrade (HTTPS → HTTP)

### 8. X-Powered-By
**Proteção:** Information Disclosure

```
(Header removido)
```

**O que faz:**
- Remove o header X-Powered-By
- Não expõe a tecnologia usada (Express, NestJS)

## 🧪 Como Testar

### Teste 1: Verificar Headers no Terminal

```bash
# Verificar todos os headers
curl -I http://localhost:4000/auth/login

# Deve retornar algo como:
HTTP/1.1 405 Method Not Allowed
Content-Security-Policy: default-src 'self';style-src 'self' 'unsafe-inline';...
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-DNS-Prefetch-Control: off
X-Download-Options: noopen
Referrer-Policy: strict-origin-when-cross-origin
```

### Teste 2: Verificar no Navegador

1. Abra o navegador (Chrome/Firefox)
2. Acesse: `http://localhost:4000/auth/login`
3. Abra DevTools (F12)
4. Vá em **Network** → Selecione a requisição
5. Vá em **Headers** → Veja **Response Headers**

### Teste 3: Testar CSP (Content Security Policy)

Tente adicionar um script inline no frontend:

```html
<!-- Isso deve ser BLOQUEADO pelo CSP -->
<script>alert('XSS')</script>
```

Você verá um erro no console:
```
Refused to execute inline script because it violates the following 
Content Security Policy directive: "script-src 'self'"
```

### Teste 4: Testar X-Frame-Options

Tente carregar o backend em um iframe:

```html
<!-- Isso deve ser BLOQUEADO -->
<iframe src="http://localhost:4000"></iframe>
```

Você verá um erro no console:
```
Refused to display 'http://localhost:4000' in a frame because it set 
'X-Frame-Options' to 'deny'
```

### Teste 5: Usar Ferramenta Online

1. Acesse: https://securityheaders.com/
2. Digite: `seu-dominio.com` (quando em produção)
3. Veja a nota de segurança (deve ser A ou A+)

## 📊 Comparação Antes vs Depois

### ❌ ANTES (Sem Helmet)
```
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json
```

**Vulnerabilidades:**
- ❌ Expõe tecnologia (Express)
- ❌ Sem proteção XSS
- ❌ Sem proteção Clickjacking
- ❌ Sem HSTS
- ❌ Permite MIME sniffing

### ✅ DEPOIS (Com Helmet)
```
HTTP/1.1 200 OK
Content-Security-Policy: default-src 'self';...
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-DNS-Prefetch-Control: off
X-Download-Options: noopen
Referrer-Policy: strict-origin-when-cross-origin
Content-Type: application/json
```

**Proteções:**
- ✅ Tecnologia oculta
- ✅ Proteção XSS (CSP)
- ✅ Proteção Clickjacking (X-Frame-Options)
- ✅ HSTS ativado
- ✅ MIME sniffing bloqueado
- ✅ Referrer policy configurada

## 🔧 Configuração Personalizada

Se precisar ajustar para casos específicos:

### Permitir Iframe de Domínio Específico

```typescript
frameguard: {
  action: 'sameorigin', // ou 'allow-from', 'https://trusted-domain.com'
}
```

### Permitir Scripts Inline (NÃO RECOMENDADO)

```typescript
contentSecurityPolicy: {
  directives: {
    scriptSrc: ["'self'", "'unsafe-inline'"], // EVITE ISSO!
  },
}
```

### Desabilitar CSP Temporariamente (Desenvolvimento)

```typescript
contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
  directives: { /* ... */ }
} : false,
```

## 🚨 Avisos Importantes

### 1. HSTS em Desenvolvimento
- HSTS força HTTPS
- Em desenvolvimento (HTTP), o navegador pode ignorar
- Em produção, certifique-se de ter HTTPS configurado

### 2. CSP e Estilos Inline
- `'unsafe-inline'` em `style-src` é necessário para alguns frameworks
- Se possível, use classes CSS em vez de estilos inline

### 3. Imagens de Terceiros
- Se precisar carregar imagens de CDNs, adicione em `img-src`:
```typescript
imgSrc: ["'self'", 'data:', 'https:', 'https://cdn.example.com'],
```

### 4. APIs Externas
- Se precisar conectar com APIs externas, adicione em `connect-src`:
```typescript
connectSrc: ["'self'", 'https://api.example.com'],
```

## 📚 Referências

- [Helmet.js Documentation](https://helmetjs.github.io/)
- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [MDN - CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [MDN - HSTS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security)

## ✅ Checklist de Validação

- [ ] Backend inicia sem erros
- [ ] Headers aparecem nas requisições (curl -I)
- [ ] Frontend continua funcionando normalmente
- [ ] Imagens carregam corretamente
- [ ] Login funciona
- [ ] Não há erros de CSP no console do navegador
- [ ] X-Powered-By não aparece nos headers

## 🎯 Próximos Passos

Após validar que tudo está funcionando:
- ✅ FASE 1 concluída
- ➡️ Avançar para FASE 2: Rate Limiting
