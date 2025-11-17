# 🛡️ Arquitetura de Segurança

Este documento detalha todos os mecanismos de segurança implementados no sistema.

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Autenticação](#autenticação)
3. [Isolamento Multitenant](#isolamento-multitenant)
4. [Controle de Acesso (RBAC)](#controle-de-acesso-rbac)
5. [Validação de Dados](#validação-de-dados)
6. [Segurança HTTP](#segurança-http)
7. [Prevenção de Vulnerabilidades](#prevenção-de-vulnerabilidades)
8. [Fluxo de Requisição](#fluxo-de-requisição)

## Visão Geral

O sistema implementa múltiplas camadas de segurança:

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ • Armazenamento Seguro de Token                      │  │
│  │ • Validação no Cliente                               │  │
│  │ • Proteção de Rotas                                  │  │
│  │ • Tratamento de Erros                                │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTPS
┌─────────────────────────────────────────────────────────────┐
│                         Backend                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. CORS Validation                                   │  │
│  │ 2. ValidationPipe (class-validator)                  │  │
│  │ 3. JwtAuthGuard (Passport JWT)                       │  │
│  │ 4. RolesGuard (RBAC)                                 │  │
│  │ 5. TenantInterceptor (Isolamento)                    │  │
│  │ 6. Controller (Lógica de Negócio)                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                       PostgreSQL                             │
│  • Senhas com Hash Bcrypt                                   │
│  • Índices para Performance                                 │
│  • Constraints de Unicidade                                 │
└─────────────────────────────────────────────────────────────┘
```

## Autenticação

### 1. Hash de Senhas com Bcrypt

**Implementação**: `backend/src/auth/auth.service.ts`

```typescript
// Ao criar usuário
const hashedPassword = await bcrypt.hash(password, 10);

// Ao fazer login
const isPasswordValid = await bcrypt.compare(password, user.password);
```

**Características**:
- Salt rounds: 10 (2^10 = 1024 iterações)
- Algoritmo: Bcrypt (resistente a ataques de força bruta)
- Senhas nunca são armazenadas em texto plano

### 2. JWT (JSON Web Token)

**Implementação**: `backend/src/auth/auth.service.ts`

**Payload do Token**:
```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "role": "ADMIN",
  "tenantId": "tenant-id",
  "iat": 1705315200,
  "exp": 1705920000
}
```

**Características**:
- Algoritmo: HS256 (HMAC SHA-256)
- Expiração: 7 dias (configurável)
- Secret: Armazenado em variável de ambiente
- Validação: Em todas as rotas protegidas

### 3. JWT Strategy

**Implementação**: `backend/src/auth/strategies/jwt.strategy.ts`

```typescript
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  async validate(payload: any) {
    // Valida se o usuário ainda existe
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenantId,
    };
  }
}
```

**Características**:
- Extração: Bearer Token do header Authorization
- Validação: Verifica se o usuário ainda existe no banco
- Anexa: Dados do usuário ao objeto `request`

## Isolamento Multitenant

### 1. TenantInterceptor

**Implementação**: `backend/src/common/interceptors/tenant.interceptor.ts`

```typescript
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Se não é SUPER_ADMIN, injeta tenantId
    if (user && user.role !== 'SUPER_ADMIN' && !skipIsolation) {
      request.tenantId = user.tenantId;
    }

    return next.handle();
  }
}
```

**Características**:
- **Global**: Aplicado em todas as rotas protegidas
- **Automático**: Injeta `tenantId` no request
- **Condicional**: SUPER_ADMIN não tem filtro
- **Decorator**: `@SkipTenantIsolation()` para rotas específicas

### 2. Uso no Service

```typescript
// Exemplo de uso do tenantId injetado
async findAll(request: Request) {
  const tenantId = request.tenantId;
  
  return this.prisma.resource.findMany({
    where: {
      tenantId: tenantId, // Filtra automaticamente
    },
  });
}
```

### 3. Prevenção de IDOR

**IDOR** (Insecure Direct Object Reference): Acesso não autorizado a recursos de outros tenants.

**Prevenção**:
```typescript
async findOne(id: string, request: Request) {
  const resource = await this.prisma.resource.findUnique({
    where: { id },
  });

  // Verifica se o recurso pertence ao tenant do usuário
  if (resource.tenantId !== request.tenantId) {
    throw new ForbiddenException('Acesso negado');
  }

  return resource;
}
```

## Controle de Acesso (RBAC)

### 1. Roles Disponíveis

```typescript
enum Role {
  SUPER_ADMIN,  // Acesso total, sem filtro de tenant
  ADMIN,        // Administrador do tenant
  USER,         // Usuário comum do tenant
  CLIENT,       // Cliente do tenant
}
```

### 2. RolesGuard

**Implementação**: `backend/src/common/guards/roles.guard.ts`

```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<Role[]>(ROLES_KEY, ...);
    const { user } = context.switchToHttp().getRequest();

    if (!requiredRoles) {
      return true; // Sem restrição de role
    }

    const hasRole = requiredRoles.some((role) => user.role === role);
    
    if (!hasRole) {
      throw new ForbiddenException('Sem permissão');
    }

    return true;
  }
}
```

### 3. Uso em Controllers

```typescript
@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantsController {
  
  @Get()
  @Roles(Role.SUPER_ADMIN)  // Apenas SUPER_ADMIN
  @SkipTenantIsolation()    // Sem filtro de tenant
  async findAll() {
    return this.tenantsService.findAll();
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)  // Apenas SUPER_ADMIN
  async create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }
}
```

### 4. Matriz de Permissões

| Rota | SUPER_ADMIN | ADMIN | USER | CLIENT |
|------|-------------|-------|------|--------|
| GET /tenants | ✅ | ❌ | ❌ | ❌ |
| POST /tenants | ✅ | ❌ | ❌ | ❌ |
| GET /dashboard | ✅ | ✅ | ✅ | ✅ |
| GET /configuracoes | ✅ | ✅ | ❌ | ❌ |

## Validação de Dados

### 1. ValidationPipe Global

**Implementação**: `backend/src/main.ts`

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,           // Remove campos não esperados
    forbidNonWhitelisted: true, // Rejeita campos extras
    transform: true,            // Transforma tipos automaticamente
  }),
);
```

### 2. DTOs com class-validator

**Exemplo**: `backend/src/tenants/dto/create-tenant.dto.ts`

```typescript
export class CreateTenantDto {
  @IsEmail({}, { message: 'Email inválido' })
  @IsNotEmpty({ message: 'Email é obrigatório' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'CNPJ/CPF é obrigatório' })
  @MinLength(11, { message: 'CNPJ/CPF deve ter no mínimo 11 caracteres' })
  cnpjCpf: string;

  @IsString()
  @IsNotEmpty({ message: 'Nome fantasia é obrigatório' })
  @MinLength(3, { message: 'Nome fantasia deve ter no mínimo 3 caracteres' })
  nomeFantasia: string;

  @IsString()
  @Matches(/^[\d\s\(\)\-\+]+$/, { message: 'Telefone inválido' })
  telefone: string;
}
```

**Características**:
- Validação de tipos
- Validação de formatos (email, telefone)
- Validação de tamanho (min/max)
- Mensagens de erro customizadas
- Validação automática antes do controller

## Segurança HTTP

### 1. CORS

**Implementação**: `backend/src/main.ts`

```typescript
app.enableCors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
});
```

**Características**:
- Apenas o frontend autorizado pode acessar
- Suporte a credenciais (cookies)
- Métodos HTTP específicos

### 2. SameSite Cookies (Opcional)

Para usar cookies em vez de Bearer Token:

```typescript
// No login
res.cookie('jwt', token, {
  httpOnly: true,      // Não acessível via JavaScript
  secure: true,        // Apenas HTTPS
  sameSite: 'strict',  // Previne CSRF
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
});
```

### 3. HTTPS Obrigatório

Em produção, sempre usar HTTPS:

```typescript
// Redirecionar HTTP para HTTPS
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}
```

## Prevenção de Vulnerabilidades

### 1. SQL Injection

**Proteção**: Prisma ORM com prepared statements

```typescript
// ✅ SEGURO - Prisma usa prepared statements
await prisma.user.findUnique({
  where: { email: userInput },
});

// ❌ INSEGURO - Nunca fazer isso
await prisma.$queryRaw`SELECT * FROM users WHERE email = ${userInput}`;
```

### 2. XSS (Cross-Site Scripting)

**Proteção**: React escapa automaticamente

```tsx
// ✅ SEGURO - React escapa automaticamente
<div>{userInput}</div>

// ❌ INSEGURO - Nunca usar dangerouslySetInnerHTML com input do usuário
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

### 3. CSRF (Cross-Site Request Forgery)

**Proteção**: SameSite cookies + CORS

```typescript
// Cookies com SameSite=Strict
res.cookie('jwt', token, {
  sameSite: 'strict',
});

// CORS configurado para aceitar apenas o frontend
app.enableCors({
  origin: 'https://seu-frontend.com',
});
```

### 4. Brute Force

**Proteção**: Rate Limiting (a implementar)

```typescript
// Exemplo com @nestjs/throttler
@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60,      // 60 segundos
      limit: 10,    // 10 requisições
    }),
  ],
})
```

### 5. Exposição de Informações Sensíveis

**Proteção**: Mensagens de erro genéricas

```typescript
// ✅ CORRETO
throw new UnauthorizedException('Credenciais inválidas');

// ❌ ERRADO
throw new UnauthorizedException('Senha incorreta para o email admin@example.com');
```

## Fluxo de Requisição

### Requisição Protegida Completa

```
1. Cliente envia requisição
   ↓
2. CORS valida origem
   ↓
3. ValidationPipe valida dados
   ↓
4. JwtAuthGuard valida token
   ↓
5. RolesGuard verifica permissões
   ↓
6. TenantInterceptor injeta tenantId
   ↓
7. Controller executa lógica
   ↓
8. Service filtra por tenantId
   ↓
9. Prisma executa query
   ↓
10. Resposta retorna ao cliente
```

### Exemplo Prático

```typescript
// 1. Cliente faz requisição
GET /resources/123
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

// 2. CORS valida origem
✅ Origin: http://localhost:5000 (permitido)

// 3. ValidationPipe valida params
✅ ID é um UUID válido

// 4. JwtAuthGuard valida token
✅ Token válido, usuário: { id: 'user-1', role: 'USER', tenantId: 'tenant-1' }

// 5. RolesGuard verifica permissões
✅ Rota não requer role específica

// 6. TenantInterceptor injeta tenantId
✅ request.tenantId = 'tenant-1'

// 7. Controller chama service
const resource = await this.service.findOne(id, request);

// 8. Service filtra por tenantId
const resource = await prisma.resource.findUnique({
  where: { id: '123' },
});

// Verifica se pertence ao tenant
if (resource.tenantId !== request.tenantId) {
  throw new ForbiddenException();
}

// 9. Retorna recurso
return resource;
```

## Checklist de Segurança

### Backend
- [x] Senhas com hash Bcrypt
- [x] JWT com expiração
- [x] Validação de token em rotas protegidas
- [x] Isolamento multitenant automático
- [x] Guards de roles (RBAC)
- [x] Validação rigorosa de dados
- [x] CORS configurado
- [x] Prevenção de IDOR
- [x] Mensagens de erro genéricas
- [ ] Rate limiting (a implementar)
- [ ] Logs de auditoria (a implementar)
- [ ] Refresh token (a implementar)

### Frontend
- [x] Armazenamento seguro de token
- [x] Validação no cliente
- [x] Proteção de rotas
- [x] Tratamento de erros
- [x] Redirecionamento em token expirado
- [x] Visibilidade condicional de UI
- [ ] Implementação real do Electron Keytar (simulado)

### Infraestrutura
- [ ] HTTPS em produção
- [ ] Variáveis de ambiente seguras
- [ ] Backup de banco de dados
- [ ] Monitoramento de segurança
- [ ] Testes de penetração

