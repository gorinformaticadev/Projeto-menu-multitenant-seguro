# Proteção CSRF - Documentação

## 🛡️ Visão Geral

Este projeto implementa proteção robusta contra **Cross-Site Request Forgery (CSRF)** utilizando o padrão **Double Submit Cookie**.

## 🔧 Implementação

### Arquitetura

**Componentes principais:**
- `CsrfGuard` - Guard principal que intercepta todas as requisições
- `SkipCsrf` decorator - Permite isentar rotas específicas da proteção
- Cookie `XSRF-TOKEN` - Armazena o token CSRF
- Header `X-CSRF-Token` ou `X-XSRF-Token` - Enviado pelo frontend

### Padrão Double Submit Cookie

1. **Backend** gera token CSRF aleatório e envia via cookie
2. **Frontend** lê cookie e envia token no header da requisição
3. **Backend** valida se token do header = token do cookie

## 🎯 Funcionamento

### Métodos Protegidos
- **POST, PUT, PATCH, DELETE** - Validam token CSRF obrigatoriamente
- **GET, HEAD, OPTIONS** - Apenas geram token (não validam)

### Fluxo de Trabalho

```
1. Cliente acessa página GET → Backend gera token CSRF
2. Token armazenado no cookie XSRF-TOKEN
3. Cliente faz requisição POST/PUT → Envia token no header
4. Backend compara token do header com token do cookie
5. Se iguais → Requisição aprovada
6. Se diferentes → ForbiddenException
```

## ⚙️ Configuração

### Cookie Settings

```typescript
response.cookie('XSRF-TOKEN', token, {
  httpOnly: false,     // Permite acesso via JavaScript
  secure: true,        // Apenas HTTPS em produção
  sameSite: 'strict',  // Proteção adicional
  path: '/',
  maxAge: 24 * 60 * 60 * 1000 // 24 horas
});
```

### Registro Global

```typescript
// app.module.ts
providers: [
  {
    provide: APP_GUARD,
    useClass: CsrfGuard,
  },
]
```

## 🚫 Isentando Rotas

Para rotas públicas ou APIs que não precisam de proteção CSRF:

```typescript
import { SkipCsrf } from '@core/common/decorators/skip-csrf.decorator';

@Controller('auth')
export class AuthController {
  @Post('login')
  @SkipCsrf() // Isenta esta rota da proteção CSRF
  async login(@Body() loginDto: LoginDto) {
    // ...
  }
}
```

## 🌐 Frontend Integration

### Exemplo de implementação no frontend:

```javascript
// Axios interceptor para adicionar token CSRF automaticamente
axios.interceptors.request.use((config) => {
  const csrfToken = getCookie('XSRF-TOKEN');
  if (csrfToken) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}
```

## 🔍 Debugging

### Headers esperados:
```
Request Headers:
  X-CSRF-Token: abc123...
  Content-Type: application/json

Cookies:
  XSRF-TOKEN: abc123...
```

### Erros Comuns:

**403 Forbidden - Token CSRF ausente**
- Cookie XSRF-TOKEN não foi enviado
- Header X-CSRF-Token/X-XSRF-Token não foi incluído

**403 Forbidden - Token CSRF inválido**
- Token do header não corresponde ao token do cookie
- Token expirado ou corrompido

## 📊 Testes

### Teste manual:
1. Faça uma requisição GET para qualquer endpoint
2. Verifique se o cookie XSRF-TOKEN foi definido
3. Faça uma requisição POST incluindo o header X-CSRF-Token
4. Verifique se a requisição é aceita

### Teste automatizado:
```typescript
describe('CSRF Protection', () => {
  it('should reject POST without CSRF token', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/users')
      .send({ name: 'test' });
    
    expect(response.status).toBe(403);
  });

  it('should accept POST with valid CSRF token', async () => {
    // Primeiro obter token via GET
    const getResponse = await request(app.getHttpServer()).get('/');
    const csrfToken = getResponse.headers['set-cookie']
      ?.find(cookie => cookie.includes('XSRF-TOKEN'))
      ?.split('XSRF-TOKEN=')[1]
      ?.split(';')[0];

    // Depois fazer POST com token
    const postResponse = await request(app.getHttpServer())
      .post('/api/users')
      .set('X-CSRF-Token', csrfToken)
      .send({ name: 'test' });
    
    expect(postResponse.status).toBe(201);
  });
});
```

## 🔒 Boas Práticas

### 1. Rotas Públicas
- Use `@SkipCsrf()` apenas para endpoints verdadeiramente públicos
- APIs RESTful devem manter proteção CSRF

### 2. SPA Applications
- Configure interceptors para adicionar token automaticamente
- Armazene token em estado global da aplicação

### 3. Mobile Apps
- CSRF geralmente não é necessário para APIs mobile
- Considere isentar endpoints específicos para apps móveis

### 4. Microservices
- Mantenha proteção em serviços que servem web frontends
- Considere isentar serviços internos de microservices

## 📈 Monitoramento

### Métricas importantes:
- Taxa de requisições bloqueadas por CSRF
- Padrões de uso de tokens CSRF
- Tentativas suspeitas de bypass

### Logging:
```typescript
// Em produção, considere logar tentativas de CSRF
if (process.env.NODE_ENV === 'production') {
  this.logger.warn(`CSRF violation attempt from IP: ${request.ip}`);
}
```

## 🆘 Troubleshooting

### Problemas Comuns:

**Token não gerado:**
- Verifique se método HTTP é GET/HEAD/OPTIONS
- Confirme que rota não está marcada com @SkipCsrf()

**Token expirado:**
- Tokens têm duração de 24 horas
- Cliente deve fazer nova requisição GET para renovar

**SameSite issues:**
- Em ambiente de desenvolvimento, verifique configuração de SameSite
- Em produção, certifique-se de usar HTTPS

---

*Implementação baseada em melhores práticas de segurança web*
*Última atualização: Janeiro 2024*# Proteção CSRF - Documentação

## 🛡️ Visão Geral

Este projeto implementa proteção robusta contra **Cross-Site Request Forgery (CSRF)** utilizando o padrão **Double Submit Cookie**.

## 🔧 Implementação

### Arquitetura

**Componentes principais:**
- `CsrfGuard` - Guard principal que intercepta todas as requisições
- `SkipCsrf` decorator - Permite isentar rotas específicas da proteção
- Cookie `XSRF-TOKEN` - Armazena o token CSRF
- Header `X-CSRF-Token` ou `X-XSRF-Token` - Enviado pelo frontend

### Padrão Double Submit Cookie

1. **Backend** gera token CSRF aleatório e envia via cookie
2. **Frontend** lê cookie e envia token no header da requisição
3. **Backend** valida se token do header = token do cookie

## 🎯 Funcionamento

### Métodos Protegidos
- **POST, PUT, PATCH, DELETE** - Validam token CSRF obrigatoriamente
- **GET, HEAD, OPTIONS** - Apenas geram token (não validam)

### Fluxo de Trabalho

```
1. Cliente acessa página GET → Backend gera token CSRF
2. Token armazenado no cookie XSRF-TOKEN
3. Cliente faz requisição POST/PUT → Envia token no header
4. Backend compara token do header com token do cookie
5. Se iguais → Requisição aprovada
6. Se diferentes → ForbiddenException
```

## ⚙️ Configuração

### Cookie Settings

```typescript
response.cookie('XSRF-TOKEN', token, {
  httpOnly: false,     // Permite acesso via JavaScript
  secure: true,        // Apenas HTTPS em produção
  sameSite: 'strict',  // Proteção adicional
  path: '/',
  maxAge: 24 * 60 * 60 * 1000 // 24 horas
});
```

### Registro Global

```typescript
// app.module.ts
providers: [
  {
    provide: APP_GUARD,
    useClass: CsrfGuard,
  },
]
```

## 🚫 Isentando Rotas

Para rotas públicas ou APIs que não precisam de proteção CSRF:

```typescript
import { SkipCsrf } from '@core/common/decorators/skip-csrf.decorator';

@Controller('auth')
export class AuthController {
  @Post('login')
  @SkipCsrf() // Isenta esta rota da proteção CSRF
  async login(@Body() loginDto: LoginDto) {
    // ...
  }
}
```

## 🌐 Frontend Integration

### Exemplo de implementação no frontend:

```javascript
// Axios interceptor para adicionar token CSRF automaticamente
axios.interceptors.request.use((config) => {
  const csrfToken = getCookie('XSRF-TOKEN');
  if (csrfToken) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}
```

## 🔍 Debugging

### Headers esperados:
```
Request Headers:
  X-CSRF-Token: abc123...
  Content-Type: application/json

Cookies:
  XSRF-TOKEN: abc123...
```

### Erros Comuns:

**403 Forbidden - Token CSRF ausente**
- Cookie XSRF-TOKEN não foi enviado
- Header X-CSRF-Token/X-XSRF-Token não foi incluído

**403 Forbidden - Token CSRF inválido**
- Token do header não corresponde ao token do cookie
- Token expirado ou corrompido

## 📊 Testes

### Teste manual:
1. Faça uma requisição GET para qualquer endpoint
2. Verifique se o cookie XSRF-TOKEN foi definido
3. Faça uma requisição POST incluindo o header X-CSRF-Token
4. Verifique se a requisição é aceita

### Teste automatizado:
```typescript
describe('CSRF Protection', () => {
  it('should reject POST without CSRF token', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/users')
      .send({ name: 'test' });
    
    expect(response.status).toBe(403);
  });

  it('should accept POST with valid CSRF token', async () => {
    // Primeiro obter token via GET
    const getResponse = await request(app.getHttpServer()).get('/');
    const csrfToken = getResponse.headers['set-cookie']
      ?.find(cookie => cookie.includes('XSRF-TOKEN'))
      ?.split('XSRF-TOKEN=')[1]
      ?.split(';')[0];

    // Depois fazer POST com token
    const postResponse = await request(app.getHttpServer())
      .post('/api/users')
      .set('X-CSRF-Token', csrfToken)
      .send({ name: 'test' });
    
    expect(postResponse.status).toBe(201);
  });
});
```

## 🔒 Boas Práticas

### 1. Rotas Públicas
- Use `@SkipCsrf()` apenas para endpoints verdadeiramente públicos
- APIs RESTful devem manter proteção CSRF

### 2. SPA Applications
- Configure interceptors para adicionar token automaticamente
- Armazene token em estado global da aplicação

### 3. Mobile Apps
- CSRF geralmente não é necessário para APIs mobile
- Considere isentar endpoints específicos para apps móveis

### 4. Microservices
- Mantenha proteção em serviços que servem web frontends
- Considere isentar serviços internos de microservices

## 📈 Monitoramento

### Métricas importantes:
- Taxa de requisições bloqueadas por CSRF
- Padrões de uso de tokens CSRF
- Tentativas suspeitas de bypass

### Logging:
```typescript
// Em produção, considere logar tentativas de CSRF
if (process.env.NODE_ENV === 'production') {
  this.logger.warn(`CSRF violation attempt from IP: ${request.ip}`);
}
```

## 🆘 Troubleshooting

### Problemas Comuns:

**Token não gerado:**
- Verifique se método HTTP é GET/HEAD/OPTIONS
- Confirme que rota não está marcada com @SkipCsrf()

**Token expirado:**
- Tokens têm duração de 24 horas
- Cliente deve fazer nova requisição GET para renovar

**SameSite issues:**
- Em ambiente de desenvolvimento, verifique configuração de SameSite
- Em produção, certifique-se de usar HTTPS

---

*Implementação baseada em melhores práticas de segurança web*
*Última atualização: Janeiro 2024*