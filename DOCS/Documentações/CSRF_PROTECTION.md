# Proteção CSRF Implementada

## ✅ O que foi feito

### Backend

1. **CSRF Guard criado** (`backend/src/common/guards/csrf.guard.ts`)
   - Implementa padrão Double Submit Cookie
   - Gera token CSRF automaticamente para requisições GET
   - Valida token em requisições POST/PUT/DELETE/PATCH

2. **Decorator @SkipCsrf** (`backend/src/common/decorators/skip-csrf.decorator.ts`)
   - Permite pular validação CSRF em rotas específicas
   - Aplicado aos endpoints de login e refresh token

3. **Cookie Parser adicionado**
   - Instalado `cookie-parser` e `@types/cookie-parser`
   - Configurado no `main.ts`

4. **Variável de ambiente**
   - `CSRF_PROTECTION_ENABLED` adicionada ao `.env.example`
   - Por padrão: `false` (desabilitado para não quebrar aplicação existente)

### Endpoints com @SkipCsrf

- `POST /auth/login` - Endpoint público
- `POST /auth/login-2fa` - Endpoint público
- `POST /auth/refresh` - Usa refresh token como autenticação

## 🔧 Como ativar

### 1. Backend

Edite o arquivo `.env`:

```bash
CSRF_PROTECTION_ENABLED="true"
```

Em seguida, ative o guard globalmente no `app.module.ts`:

```typescript
import { CsrfGuard } from './common/guards/csrf.guard';

@Module({
  // ... imports
  providers: [
    // ... outros providers
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
  ],
})
export class AppModule {}
```

### 2. Frontend

Atualize o arquivo `frontend/src/lib/api.ts` para incluir o token CSRF:

```typescript
// Função para obter token CSRF do cookie
const getCsrfToken = (): string | null => {
  if (typeof document === 'undefined') return null;
  
  const matches = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return matches ? decodeURIComponent(matches[1]) : null;
};

// No interceptor de request
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Token de autenticação
    const token = typeof window !== "undefined"
      ? localStorage.getItem("@App:token")
      : null;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Token CSRF para métodos não seguros
    const unsafeMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    if (unsafeMethods.includes(config.method?.toUpperCase() || '')) {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
```

### 3. Configurar CORS para cookies

No `main.ts`, atualize a configuração de CORS:

```typescript
app.enableCors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5000',
    'http://127.0.0.1:5000',
    'http://localhost:5000',
    'http://localhost:3000',
  ],
  credentials: true, // ✅ IMPORTANTE: Permite cookies cross-origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  exposedHeaders: ['Content-Type', 'Content-Length', 'X-Total-Count'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'], // ✅ Permitir header CSRF
  maxAge: parseInt(process.env.CORS_MAX_AGE) || 86400,
});
```

## 🔐 Como funciona

### Double Submit Cookie Pattern

1. **Request inicial (GET)**:
   - Backend gera token CSRF aleatório
   - Envia token via cookie `XSRF-TOKEN` (httpOnly: false)
   
2. **Requests seguintes (POST/PUT/DELETE)**:
   - Frontend lê token do cookie
   - Envia token em header `X-CSRF-Token`
   - Backend compara: cookie === header
   - Se diferente: erro 403

### Por que funciona?

- Cookies são enviados automaticamente pelo navegador
- Mas JavaScript malicioso em outro domínio **NÃO consegue ler cookies** devido a Same-Origin Policy
- Portanto, atacante não consegue enviar header correto
- Request CSRF falhará na validação

## 🧪 Testes

### Teste 1: GET request recebe cookie

```bash
curl -i http://localhost:4000/auth/me \
  -H "Authorization: Bearer SEU_TOKEN"

# Deve retornar header Set-Cookie com XSRF-TOKEN
```

### Teste 2: POST sem CSRF token falha

```bash
curl -X POST http://localhost:4000/users/profile \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test"}'

# Deve retornar 403 Forbidden: "Token CSRF ausente"
```

### Teste 3: POST com CSRF token correto funciona

```bash
# Primeiro, obter o token do cookie (via navegador ou ferramenta)
TOKEN="abc123..."

curl -X POST http://localhost:4000/users/profile \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $TOKEN" \
  -H "Cookie: XSRF-TOKEN=$TOKEN" \
  -d '{"name": "Test"}'

# Deve retornar 200 OK
```

## ⚠️ Avisos Importantes

### 1. Não habilitar em produção sem testar

A proteção CSRF está **desabilitada por padrão** porque requer mudanças no frontend. Teste completamente antes de ativar em produção.

### 2. Compatibilidade com APIs públicas

Se você tem endpoints públicos que precisam aceitar requests de qualquer origem (ex: webhooks), marque-os com `@SkipCsrf()`:

```typescript
@SkipCsrf()
@Post('webhook')
async handleWebhook() { ... }
```

### 3. Aplicações mobile

Apps mobile nativos não usam cookies da mesma forma que navegadores. Considere:
- Desabilitar CSRF para rotas de API mobile
- Usar autenticação baseada apenas em JWT
- Implementar validação de origin/referer

## 📚 Referências

- [OWASP CSRF](https://owasp.org/www-community/attacks/csrf)
- [Double Submit Cookie Pattern](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#double-submit-cookie)
- [SameSite Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)

## 🎯 Status

- ✅ Backend implementado
- ✅ Guards criados
- ✅ Decorators criados
- ✅ Endpoints de login marcados
- ⚠️ **DESABILITADO POR PADRÃO** (requer configuração frontend)
- ⏳ Frontend precisa ser atualizado para enviar token CSRF
- ⏳ Testes precisam ser executados

## 🚀 Próximos passos

1. Testar proteção em desenvolvimento
2. Atualizar frontend conforme instruções acima
3. Executar suite de testes
4. Documentar para equipe
5. Ativar gradualmente em produção
