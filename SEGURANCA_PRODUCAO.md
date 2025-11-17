# 🔐 Segurança em Produção

Este documento contém recomendações essenciais para colocar o sistema em produção de forma segura.

## ⚠️ IMPORTANTE: Antes de Ir para Produção

### 1. Variáveis de Ambiente

#### ❌ NUNCA faça isso:
```env
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mydb"
```

#### ✅ SEMPRE faça isso:
```env
JWT_SECRET="gere-uma-chave-aleatoria-de-64-caracteres-ou-mais"
DATABASE_URL="postgresql://user_seguro:senha_forte_aleatoria@db.example.com:5432/producao_db?sslmode=require"
```

**Como gerar uma chave segura:**
```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# OpenSSL
openssl rand -hex 64
```

### 2. HTTPS Obrigatório

#### Backend
```typescript
// main.ts
if (process.env.NODE_ENV === 'production') {
  // Redirecionar HTTP para HTTPS
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}
```

#### Frontend
```typescript
// next.config.js
module.exports = {
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'header',
            key: 'x-forwarded-proto',
            value: 'http',
          },
        ],
        destination: 'https://seu-dominio.com/:path*',
        permanent: true,
      },
    ];
  },
};
```

### 3. Configuração de CORS

#### ❌ NUNCA faça isso:
```typescript
app.enableCors({
  origin: '*', // Permite qualquer origem
});
```

#### ✅ SEMPRE faça isso:
```typescript
app.enableCors({
  origin: [
    'https://seu-dominio.com',
    'https://www.seu-dominio.com',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

### 4. Headers de Segurança

Instale e configure o Helmet:

```bash
cd backend
npm install helmet
```

```typescript
// main.ts
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));
```

### 5. Rate Limiting

Instale e configure rate limiting:

```bash
cd backend
npm install @nestjs/throttler
```

```typescript
// app.module.ts
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60,      // 60 segundos
      limit: 10,    // 10 requisições por minuto
    }),
  ],
})
```

```typescript
// auth.controller.ts
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  @Post('login')
  @Throttle(5, 60) // 5 tentativas por minuto
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
}
```

### 6. Banco de Dados

#### Conexão Segura
```env
# Sempre use SSL em produção
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
```

#### Backup Automático
```bash
# Configurar backup diário
0 2 * * * pg_dump -U user -d database > /backup/db_$(date +\%Y\%m\%d).sql
```

#### Usuário com Privilégios Mínimos
```sql
-- Criar usuário específico para a aplicação
CREATE USER app_user WITH PASSWORD 'senha_forte';

-- Dar apenas as permissões necessárias
GRANT CONNECT ON DATABASE mydb TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
```

### 7. Logs e Monitoramento

#### Configurar Logs Estruturados
```typescript
// logger.service.ts
import { Injectable, LoggerService } from '@nestjs/common';

@Injectable()
export class CustomLogger implements LoggerService {
  log(message: string, context?: string) {
    console.log(JSON.stringify({
      level: 'info',
      message,
      context,
      timestamp: new Date().toISOString(),
    }));
  }

  error(message: string, trace?: string, context?: string) {
    console.error(JSON.stringify({
      level: 'error',
      message,
      trace,
      context,
      timestamp: new Date().toISOString(),
    }));
  }

  warn(message: string, context?: string) {
    console.warn(JSON.stringify({
      level: 'warn',
      message,
      context,
      timestamp: new Date().toISOString(),
    }));
  }
}
```

#### Integrar com Sentry
```bash
npm install @sentry/node
```

```typescript
// main.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

### 8. Validação Adicional

#### Sanitização de Inputs
```bash
npm install class-sanitizer
```

```typescript
// create-tenant.dto.ts
import { Trim } from 'class-sanitizer';

export class CreateTenantDto {
  @Trim()
  @IsEmail()
  email: string;

  @Trim()
  @IsString()
  nomeFantasia: string;
}
```

### 9. Secrets Management

#### Usar Serviços de Secrets
- AWS Secrets Manager
- Azure Key Vault
- Google Secret Manager
- HashiCorp Vault

#### Exemplo com AWS Secrets Manager:
```typescript
import { SecretsManager } from 'aws-sdk';

const secretsManager = new SecretsManager({
  region: 'us-east-1',
});

async function getSecret(secretName: string) {
  const data = await secretsManager.getSecretValue({
    SecretId: secretName,
  }).promise();

  return JSON.parse(data.SecretString);
}
```

### 10. Auditoria e Compliance

#### Logs de Auditoria
```typescript
// audit.service.ts
@Injectable()
export class AuditService {
  async log(action: string, userId: string, details: any) {
    await this.prisma.auditLog.create({
      data: {
        action,
        userId,
        details: JSON.stringify(details),
        timestamp: new Date(),
        ipAddress: details.ip,
        userAgent: details.userAgent,
      },
    });
  }
}
```

#### Implementar em Controllers
```typescript
@Post()
async create(@Body() dto: CreateTenantDto, @Req() req: Request) {
  const tenant = await this.tenantsService.create(dto);
  
  await this.auditService.log('CREATE_TENANT', req.user.id, {
    tenantId: tenant.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  
  return tenant;
}
```

## 🔒 Checklist de Segurança para Produção

### Configuração
- [ ] JWT_SECRET gerado aleatoriamente (64+ caracteres)
- [ ] DATABASE_URL com credenciais fortes e SSL
- [ ] CORS configurado para domínios específicos
- [ ] HTTPS obrigatório (redirecionamento HTTP → HTTPS)
- [ ] Helmet.js configurado
- [ ] Rate limiting ativado

### Banco de Dados
- [ ] Conexão SSL ativada
- [ ] Usuário com privilégios mínimos
- [ ] Backup automático configurado
- [ ] Índices otimizados
- [ ] Queries otimizadas

### Autenticação
- [ ] Senhas com Bcrypt (salt rounds ≥ 10)
- [ ] JWT com expiração curta (≤ 15 minutos)
- [ ] Refresh token implementado
- [ ] Rate limiting no login (5 tentativas/minuto)
- [ ] Logout com blacklist de tokens

### Autorização
- [ ] Guards de roles implementados
- [ ] Isolamento multitenant ativo
- [ ] Verificação de propriedade de recursos (IDOR)
- [ ] Validação de permissões em todas as rotas

### Validação
- [ ] ValidationPipe global ativo
- [ ] Whitelist ativada
- [ ] Sanitização de inputs
- [ ] Validação de tipos e formatos

### Logs e Monitoramento
- [ ] Logs estruturados
- [ ] Integração com Sentry ou similar
- [ ] Logs de auditoria
- [ ] Monitoramento de performance
- [ ] Alertas configurados

### Infraestrutura
- [ ] Firewall configurado
- [ ] Portas desnecessárias fechadas
- [ ] Atualizações de segurança automáticas
- [ ] Backup testado e funcional
- [ ] Plano de disaster recovery

### Compliance
- [ ] LGPD/GDPR compliance
- [ ] Política de privacidade
- [ ] Termos de uso
- [ ] Consentimento de cookies
- [ ] Direito ao esquecimento implementado

## 🚨 Vulnerabilidades Comuns a Evitar

### 1. SQL Injection
✅ **Protegido**: Prisma usa prepared statements automaticamente

### 2. XSS (Cross-Site Scripting)
✅ **Protegido**: React escapa automaticamente
⚠️ **Cuidado**: Nunca usar `dangerouslySetInnerHTML` com input do usuário

### 3. CSRF (Cross-Site Request Forgery)
✅ **Protegido**: SameSite cookies + CORS

### 4. Brute Force
✅ **Protegido**: Rate limiting no login

### 5. IDOR (Insecure Direct Object Reference)
✅ **Protegido**: Verificação de tenantId antes de retornar recursos

### 6. Exposição de Informações Sensíveis
✅ **Protegido**: Mensagens de erro genéricas
⚠️ **Cuidado**: Nunca retornar stack traces em produção

### 7. Broken Authentication
✅ **Protegido**: JWT com expiração + validação de usuário

### 8. Sensitive Data Exposure
✅ **Protegido**: HTTPS + senhas com hash
⚠️ **Cuidado**: Nunca logar senhas ou tokens

### 9. XML External Entities (XXE)
✅ **Protegido**: Não usamos XML

### 10. Broken Access Control
✅ **Protegido**: Guards de roles + isolamento multitenant

## 📊 Monitoramento Contínuo

### Métricas Importantes
- Taxa de erro (< 1%)
- Tempo de resposta (< 200ms)
- Uso de CPU (< 70%)
- Uso de memória (< 80%)
- Conexões de banco (< 80% do pool)

### Alertas Críticos
- Taxa de erro > 5%
- Tempo de resposta > 1s
- Banco de dados offline
- Disco > 90% cheio
- Tentativas de login suspeitas

## 🔄 Processo de Deploy Seguro

1. **Testes**
   - Executar todos os testes
   - Verificar coverage
   - Testes de segurança

2. **Build**
   - Build de produção
   - Minificação
   - Tree shaking

3. **Verificação**
   - Scan de vulnerabilidades
   - Análise de código estático
   - Verificação de secrets

4. **Deploy**
   - Deploy em staging primeiro
   - Testes de fumaça
   - Deploy em produção
   - Rollback automático se falhar

5. **Monitoramento**
   - Verificar logs
   - Verificar métricas
   - Verificar alertas

## 📚 Recursos Adicionais

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [NestJS Security](https://docs.nestjs.com/security/authentication)
- [Next.js Security](https://nextjs.org/docs/advanced-features/security-headers)
- [Prisma Security](https://www.prisma.io/docs/guides/database/advanced-database-tasks/sql-injection)

## 🆘 Em Caso de Incidente de Segurança

1. **Isolar**: Desconectar sistema afetado
2. **Avaliar**: Determinar escopo do incidente
3. **Conter**: Prevenir propagação
4. **Erradicar**: Remover causa raiz
5. **Recuperar**: Restaurar operação normal
6. **Aprender**: Documentar e melhorar

## 📞 Contatos de Emergência

- Equipe de Segurança: security@example.com
- Equipe de DevOps: devops@example.com
- Gerente de Projeto: manager@example.com

