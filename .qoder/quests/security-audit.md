# AUDITORIA DE SEGURANÇA - SISTEMA MULTI-TENANT

## RESUMO EXECUTIVO

**Data da Auditoria**: 10/01/2026  
**Sistema Analisado**: Menu Multi-tenant Seguro  
**Arquitetura**: NestJS (Backend) + Next.js (Frontend) + PostgreSQL/Prisma  
**Ambiente**: DEV/Produção  

---

## 1. VULNERABILIDADES ENCONTRADAS

### 1.1 ISOLAMENTO DE TENANT - RISCO ALTO

**Cenário de Exploração**: Um tenant malicioso pode manipular requisições para acessar dados de outros tenants através de ID injection ou falta de validação adequada.

**Código Afetado**: 
- `TenantInterceptor` (apps/backend/src/common/interceptors/tenant.interceptor.ts)
- Controllers que não validam `tenantId` no payload

**Detalhes Técnicos**:
```typescript
// PROBLEMA: SUPER_ADMIN pode pular isolamento completamente
if (user && user.role !== 'SUPER_ADMIN' && !skipIsolation) {
  request.tenantId = user.tenantId;
}
```

**Recomendação Específica**:
```typescript
// Implementar validação rigorosa no TenantInterceptor
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    // SEMPRE validar tenantId mesmo para SUPER_ADMIN
    if (user && !this.reflector.get(SKIP_TENANT_ISOLATION, context.getHandler())) {
      // Validar que tenantId do payload corresponde ao usuário
      const payloadTenantId = request.body?.tenantId || request.query?.tenantId;
      if (payloadTenantId && payloadTenantId !== user.tenantId && user.role !== 'SUPER_ADMIN') {
        throw new ForbiddenException('Acesso negado a dados de outro tenant');
      }
      
      request.tenantId = user.tenantId;
    }
    
    return next.handle();
  }
}
```

### 1.2 AUTORIZAÇÃO REAL (RBAC) - RISCO MÉDIO

**Cenário de Exploração**: Usuários com role inferior podem acessar endpoints protegidos se decorators forem esquecidos ou mal configurados.

**Código Afetado**: 
- `RolesGuard` (apps/backend/src/common/guards/roles.guard.ts)
- Controllers sem `@Roles()` decorator

**Detalhes Técnicos**:
```typescript
// PROBLEMA: Retorna true se não há roles requeridas
if (!requiredRoles) {
  return true; // PODE PERMITIR ACESSO INDEVIDO!
}
```

**Recomendação Específica**:
```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    // POLÍTICA DE SEGURANÇA: Negar por padrão se não especificado
    if (!requiredRoles || requiredRoles.length === 0) {
      throw new ForbiddenException('Acesso negado - permissões não definidas');
    }
    
    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException('Usuário não autenticado');
    }
    
    const hasRole = requiredRoles.some((role) => user.role === role);
    if (!hasRole) {
      throw new ForbiddenException(`Permissão insuficiente. Requer: ${requiredRoles.join(', ')}`);
    }
    
    return true;
  }
}
```

### 1.3 JWT TOKEN MANAGEMENT - RISCO ALTO

**Cenário de Exploração**: Tokens roubados podem ser reutilizados indefinidamente, falta mecanismo de revogação eficaz.

**Código Afetado**: 
- `AuthService` (apps/backend/src/auth/auth.service.ts)
- Falta de blacklisting de tokens

**Detalhes Técnicos**:
- Refresh tokens são armazenados em banco mas não há mecanismo de revogação em tempo real
- Access tokens não podem ser revogados antes da expiração
- Não há controle de sessões ativas por usuário

**Recomendação Específica**:
```typescript
@Injectable()
export class TokenBlacklistService {
  private blacklist = new Set<string>(); // Em produção: usar Redis
  
  async blacklistToken(token: string, expiry: Date): Promise<void> {
    this.blacklist.add(token);
    // Limpar token expirado automaticamente
    setTimeout(() => this.blacklist.delete(token), expiry.getTime() - Date.now());
  }
  
  async isTokenBlacklisted(token: string): Promise<boolean> {
    return this.blacklist.has(token);
  }
}

// No JWT Strategy:
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    private tokenBlacklistService: TokenBlacklistService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }
  
  async validate(payload: any) {
    // Verificar se usuário ainda existe
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub }
    });
    
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuário inativo ou não encontrado');
    }
    
    // Verificar se token foi revogado
    const token = this.extractToken(); // Implementar extração do token
    if (await this.tokenBlacklistService.isTokenBlacklisted(token)) {
      throw new UnauthorizedException('Token revogado');
    }
    
    return user;
  }
}
```

### 1.4 VALIDAÇÃO DE DADOS INSUFICIENTE - RISCO MÉDIO

**Cenário de Exploração**: Payloads malformados podem causar erros de validação ou bypass de regras de negócio.

**Código Afetado**: 
- DTOs espalhados pela aplicação
- Falta de validação customizada para campos sensíveis

**Recomendação Específica**:
```typescript
// Criar validadores customizados para casos específicos
import { ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

@ValidatorConstraint({ name: 'tenantOwnership', async: true })
export class TenantOwnershipValidator implements ValidatorConstraintInterface {
  constructor(private prisma: PrismaService) {}
  
  async validate(value: any, args: ValidationArguments) {
    const object = args.object as any;
    const userId = object.userId;
    const tenantId = object.tenantId;
    
    // Validar que o recurso pertence ao tenant do usuário
    const resource = await this.prisma[args.property].findUnique({
      where: { id: value }
    });
    
    return resource && resource.tenantId === tenantId;
  }
  
  defaultMessage(args: ValidationArguments) {
    return `${args.property} não pertence ao seu tenant`;
  }
}

// Uso nos DTOs:
export class UpdateResourceDto {
  @Validate(TenantOwnershipValidator)
  resourceId: string;
}
```

### 1.5 USO INSEGURO DO PRISMA ORM - RISCO MÉDIO

**Cenário de Exploração**: Queries dinâmicas podem levar a injeção de SQL ou acesso não autorizado a dados.

**Problemas Identificados**:
- Uso de `raw queries` sem sanitização adequada
- Falta de prepared statements em alguns casos
- Queries complexas sem validação de permissões

**Recomendação Específica**:
```typescript
@Injectable()
export class SecurePrismaService {
  constructor(private prisma: PrismaService) {}
  
  // Wrapper seguro para queries com tenant isolation
  async findWithTenant<T>(
    model: any,
    where: any,
    tenantId: string,
    userId: string,
    role: string
  ): Promise<T[]> {
    // SEMPRE incluir tenantId nas queries
    const tenantWhere = role !== 'SUPER_ADMIN' 
      ? { ...where, tenantId } 
      : where;
    
    return this.prisma[model].findMany({
      where: tenantWhere,
      // Adicionar logging de segurança
      select: {
        ...this.getDefaultSelect(model),
        auditTrail: true
      }
    });
  }
  
  // Prevenir injeção de SQL em raw queries
  sanitizeRawQuery(query: string, params: any[]): string {
    // Implementar sanitização rigorosa
    return query.replace(/\$\d+/g, (match, index) => {
      const param = params[parseInt(match.slice(1)) - 1];
      if (typeof param === 'string') {
        return `'${param.replace(/'/g, "''")}'`;
      }
      return String(param);
    });
  }
}
```

### 1.6 SEGURANÇA DO FRONTEND NEXT.JS - RISCO BAIXO

**Cenário de Exploração**: SSR pode expor dados sensíveis no HTML renderizado ou falta de proteção contra XSS.

**Problemas Identificados**:
- Potencial exposição de dados sensíveis em props do SSR
- Falta de sanitização em dangerouslySetInnerHTML

**Recomendação Específica**:
```typescript
// _app.tsx - Implementar proteção global
import { AppProps } from 'next/app';
import Head from 'next/head';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        {/* CSP Headers */}
        <meta httpEquiv="Content-Security-Policy" 
              content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" />
        
        {/* Outros headers de segurança */}
        <meta httpEquiv="X-Frame-Options" content="DENY" />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}

// Componentes - Sanitizar dados antes de renderizar
const SafeHtmlRenderer = ({ html }: { html: string }) => {
  // Sanitizar HTML perigoso
  const sanitizedHtml = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
    ALLOWED_ATTR: []
  });
  
  return <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />;
};
```

### 1.7 CSRF PROTECTION INCOMPLETA - RISCO MÉDIO

**Cenário de Exploração**: Ataques CSRF podem ser executados em endpoints que deveriam estar protegidos.

**Código Afetado**: 
- `CsrfGuard` (apps/backend/src/common/guards/csrf.guard.ts)
- Uso inconsistente de `@SkipCsrf()`

**Recomendação Específica**:
```typescript
@Injectable()
export class EnhancedCsrfGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Ignorar métodos seguros
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return true;
    }
    
    // Verificar se decorator @SkipCsrf está presente
    const skipCsrf = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (skipCsrf) {
      return true;
    }
    
    // Validar CSRF token
    const csrfToken = request.headers['x-csrf-token'] || request.body._csrf;
    if (!csrfToken) {
      throw new ForbiddenException('Token CSRF ausente');
    }
    
    // Validar token contra sessão do usuário
    const sessionCsrf = request.session?.csrfToken;
    if (csrfToken !== sessionCsrf) {
      throw new ForbiddenException('Token CSRF inválido');
    }
    
    return true;
  }
}
```

### 1.8 RATE LIMITING INSUFICIENTE - RISCO MÉDIO

**Cenário de Exploração**: Ataques de força bruta podem explorar limites muito altos em ambiente DEV.

**Configuração Atual**:
```typescript
// apps/backend/src/app.module.ts
{
  name: 'default',
  ttl: 60000, // 1 minuto
  limit: 10000, // MUITO ALTO para produção!
},
{
  name: 'login',
  ttl: 60000,
  limit: process.env.NODE_ENV === 'production' ? 5 : 10,
}
```

**Recomendação Específica**:
```typescript
// Configuração adaptativa por ambiente
const getRateLimits = () => {
  if (process.env.NODE_ENV === 'production') {
    return [
      {
        name: 'default',
        ttl: 60000,
        limit: 100, // 100 requests/minuto
      },
      {
        name: 'login',
        ttl: 60000,
        limit: 5, // 5 tentativas de login/minuto
      },
      {
        name: 'password_reset',
        ttl: 3600000,
        limit: 3, // 3 resets por hora
      }
    ];
  }
  
  return [
    {
      name: 'default',
      ttl: 60000,
      limit: 1000, // Mais permissivo em DEV
    },
    {
      name: 'login',
      ttl: 60000,
      limit: 20, // Mais alto em DEV
    }
  ];
};

// Implementar rate limiting por IP + usuário
@Injectable()
export class AdaptiveRateLimiter {
  private ipLimits = new Map<string, { count: number; resetTime: number }>();
  
  async checkLimit(ip: string, userId?: string): Promise<boolean> {
    const key = userId ? `${ip}:${userId}` : ip;
    const now = Date.now();
    
    if (!this.ipLimits.has(key)) {
      this.ipLimits.set(key, { count: 1, resetTime: now + 60000 });
      return true;
    }
    
    const limit = this.ipLimits.get(key)!;
    
    if (now > limit.resetTime) {
      limit.count = 1;
      limit.resetTime = now + 60000;
      return true;
    }
    
    if (limit.count >= this.getMaxAttempts(userId)) {
      return false; // Bloqueado
    }
    
    limit.count++;
    return true;
  }
  
  private getMaxAttempts(userId?: string): number {
    if (!userId) return 100; // Anônimo
    return 1000; // Usuário autenticado
  }
}
```

### 1.9 LOGS E MONITORAMENTO INADEQUADOS - RISCO BAIXO

**Cenário de Exploração**: Falta de logging adequado dificulta detecção de incidentes de segurança.

**Problemas Identificados**:
- Logs sensíveis podem ser gravados em texto plano
- Falta de correlação entre eventos relacionados
- Não há alertas automatizados para padrões suspeitos

**Recomendação Específica**:
```typescript
@Injectable()
export class SecurityLoggerService {
  private readonly logger = new Logger(SecurityLoggerService.name);
  
  logSecurityEvent(event: {
    action: string;
    userId?: string;
    tenantId?: string;
    ipAddress: string;
    userAgent: string;
    severity: 'low' | 'medium' | 'high';
    details: Record<string, any>;
  }) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action: event.action,
      userId: event.userId,
      tenantId: event.tenantId,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      severity: event.severity,
      details: this.sanitizeSensitiveData(event.details),
      correlationId: this.generateCorrelationId()
    };
    
    // Gravar em sistema de logging seguro
    this.logger.log(JSON.stringify(logEntry));
    
    // Enviar alertas para eventos críticos
    if (event.severity === 'high') {
      this.sendAlert(logEntry);
    }
  }
  
  private sanitizeSensitiveData(data: any): any {
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    const sanitized = { ...data };
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }
  
  private generateCorrelationId(): string {
    return crypto.randomUUID();
  }
  
  private sendAlert(event: any) {
    // Integrar com sistema de monitoramento (Sentry, DataDog, etc)
    console.warn('🚨 ALERTA DE SEGURANÇA:', event);
  }
}
```

### 1.10 GERENCIAMENTO DE VARIÁVEIS DE AMBIENTE - RISCO BAIXO

**Cenário de Exploração**: Exposição de secrets em logs ou código versionado.

**Problemas Identificados**:
- `.env` pode ser commitado acidentalmente
- Secrets hardcoded em código
- Falta de rotação automática de credenciais

**Recomendação Específica**:
```typescript
// apps/backend/src/common/services/secret-manager.service.ts
@Injectable()
export class SecretManagerService {
  private secrets: Map<string, string> = new Map();
  
  async initialize() {
    // Carregar secrets de fontes seguras (Vault, AWS Secrets Manager, etc)
    const secrets = await this.loadFromSecureSource();
    this.secrets = new Map(Object.entries(secrets));
    
    // Validar secrets críticos
    this.validateCriticalSecrets();
  }
  
  get(key: string): string {
    const value = this.secrets.get(key);
    if (!value) {
      throw new Error(`Secret ${key} não encontrado`);
    }
    return value;
  }
  
  private validateCriticalSecrets() {
    const critical = ['JWT_SECRET', 'DATABASE_URL', 'ENCRYPTION_KEY'];
    for (const secret of critical) {
      if (!this.secrets.has(secret)) {
        throw new Error(`Secret crítico ${secret} ausente`);
      }
    }
  }
  
  // Rotacionar secrets periodicamente
  @Cron('0 2 * * *') // Todos os dias às 2h
  async rotateSecrets() {
    // Implementar rotação segura de secrets
    console.log('🔄 Rotacionando secrets...');
  }
}
```

---

## 2. CLASSIFICAÇÃO DE RISCOS

| Vulnerabilidade | Risco | Impacto | Probabilidade | Prioridade |
|----------------|-------|---------|---------------|------------|
| Isolamento de Tenant | ALTO | Crítico | Média | IMEDIATA |
| JWT Token Management | ALTO | Alto | Baixa | ALTA |
| Autorização RBAC | MÉDIO | Médio | Média | MÉDIA |
| Validação de Dados | MÉDIO | Médio | Alta | MÉDIA |
| Uso do Prisma ORM | MÉDIO | Médio | Média | MÉDIA |
| CSRF Protection | MÉDIO | Médio | Média | MÉDIA |
| Rate Limiting | MÉDIO | Baixo | Alta | MÉDIA |
| Frontend Security | BAIXO | Baixo | Baixa | BAIXA |
| Logging | BAIXO | Baixo | Média | BAIXA |
| Secret Management | BAIXO | Baixo | Baixa | BAIXA |

---

## 3. PLANO DE IMPLEMENTAÇÃO

### Fase 1 - Críticas (2 semanas)
1. Corrigir isolamento de tenant no TenantInterceptor
2. Implementar token blacklisting e revogação
3. Reforçar validação RBAC no RolesGuard

### Fase 2 - Importantes (3 semanas)
1. Implementar validadores customizados para dados sensíveis
2. Reforçar uso seguro do Prisma ORM
3. Aprimorar proteção CSRF
4. Ajustar rate limiting para ambientes

### Fase 3 - Melhorias (2 semanas)
1. Implementar logging de segurança avançado
2. Aprimorar gerenciamento de secrets
3. Adicionar proteções frontend adicionais

---

## 4. CONCLUSÃO

O sistema apresenta uma base sólida de segurança com implementações adequadas de:
- ✅ Autenticação JWT
- ✅ Helmet para headers de segurança
- ✅ Rate limiting básico
- ✅ Auditoria de logs
- ✅ Proteção CSRF parcial

**Pontos Fortes**:
- Arquitetura multi-tenant bem estruturada
- Boa separação de responsabilidades
- Uso de boas práticas como bcrypt, DTOs, etc.

**Áreas de Melhoria**:
- Necessita reforço no isolamento de tenant
- Token management precisa de mecanismos de revogação
- Autorização RBAC deve ser mais rigorosa por padrão
- Rate limiting precisa ser adaptativo por ambiente

**Recomendação Final**: Implementar as correções em ordem de prioridade, começando pelas vulnerabilidades de risco ALTO. O sistema estará significativamente mais seguro após estas melhorias.
**Recomendação Final**: Implementar as correções em ordem de prioridade, começando pelas vulnerabilidades de risco ALTO. O sistema estará significativamente mais seguro após estas melhorias.