# 🤖 Regras de Desenvolvimento para IA

## 📋 Visão Geral do Projeto

Este é um **Sistema Multitenant Seguro** full-stack com isolamento de dados e controle de acesso baseado em roles (RBAC).

### 🏗️ Arquitetura
- **Backend:** NestJS 10+ com TypeScript
- **Frontend:** Next.js 14+ com React 18+ e TypeScript
- **Banco de Dados:** PostgreSQL com Prisma ORM
- **Autenticação:** JWT + 2FA (TOTP)
- **Estilização:** Tailwind CSS + Radix UI
- **Monitoramento:** Sentry

---

## 🛠️ Tecnologias Aprovadas

### Backend (NestJS)
```json
{
  "core": ["@nestjs/common", "@nestjs/core", "@nestjs/platform-express"],
  "auth": ["@nestjs/jwt", "@nestjs/passport", "passport-jwt", "bcrypt"],
  "database": ["@prisma/client", "prisma"],
  "security": ["@nestjs/throttler", "helmet", "class-validator", "class-transformer"],
  "email": ["nodemailer"],
  "2fa": ["speakeasy", "qrcode"],
  "monitoring": ["@sentry/node"],
  "utils": ["uuid", "multer", "cookie-parser"]
}
```

### Frontend (Next.js)
```json
{
  "core": ["next", "react", "react-dom"],
  "ui": ["@radix-ui/*", "lucide-react", "tailwindcss"],
  "http": ["axios"],
  "utils": ["clsx", "class-variance-authority", "tailwind-merge"],
  "monitoring": ["@sentry/nextjs"]
}
```

### Banco de Dados
- **PostgreSQL** (produção)
- **Prisma ORM** (migrations, queries, schema)

---

## 📐 Princípios de Desenvolvimento

### 1. **SOLID Principles**
```typescript
// ✅ Single Responsibility
class UserService {
  async createUser(data: CreateUserDto) { /* ... */ }
}

class EmailService {
  async sendEmail(to: string, subject: string) { /* ... */ }
}

// ✅ Dependency Injection
@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private emailService: EmailService
  ) {}
}
```

### 2. **Clean Code**
```typescript
// ✅ Nomes descritivos
const isUserAuthenticated = checkUserAuthStatus(user);
const hasValidPermissions = validateUserPermissions(user, resource);

// ✅ Funções pequenas e focadas
async function validateUserCredentials(email: string, password: string): Promise<boolean> {
  const user = await this.findUserByEmail(email);
  return user && await this.comparePasswords(password, user.password);
}
```

### 3. **DRY (Don't Repeat Yourself)**
```typescript
// ✅ Reutilizar lógica comum
export class BaseController {
  protected handleError(error: any, message: string) {
    this.logger.error(message, error);
    throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

// ✅ Usar constantes
export const PLATFORM_CONSTANTS = {
  DEFAULT_PAGE_SIZE: 10,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
} as const;
```

### 4. **KISS (Keep It Simple)**
```typescript
// ✅ Simples e direto
function calculateAge(birthDate: Date): number {
  return new Date().getFullYear() - birthDate.getFullYear();
}

// ❌ Evitar complexidade desnecessária
function calculateAgeWithComplexLogic(birthDate: Date): number {
  // Lógica complexa desnecessária...
}
```

---

## 🔒 Regras de Segurança (OBRIGATÓRIAS)

### 1. **Sanitização de Entradas**
```typescript
// ✅ Sempre usar DTOs com validação
export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  password: string;
}
```

### 2. **Tratamento de Exceções**
```typescript
// ✅ Sempre tratar erros
try {
  const user = await this.userService.create(userData);
  return { success: true, user };
} catch (error) {
  this.logger.error('Failed to create user:', error);
  throw new HttpException(
    'Erro ao criar usuário',
    HttpStatus.INTERNAL_SERVER_ERROR
  );
}
```

### 3. **Prepared Statements (Prisma)**
```typescript
// ✅ Prisma já usa prepared statements
const users = await this.prisma.user.findMany({
  where: {
    email: userEmail, // Automaticamente sanitizado
    tenantId: tenantId
  }
});
```

### 4. **Proteção de Dados Sensíveis**
```typescript
// ✅ Nunca expor senhas
export class UserResponseDto {
  id: string;
  email: string;
  name: string;
  // ❌ password: string; // NUNCA incluir
}

// ✅ Hash de senhas
const hashedPassword = await bcrypt.hash(password, 10);
```

### 5. **Autenticação e Autorização**
```typescript
// ✅ Sempre usar guards
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('admin')
export class AdminController {
  // Endpoints protegidos
}
```

---

## 🚫 Proibições Absolutas

### ❌ **NUNCA Fazer:**
```typescript
// ❌ Senhas reais
const password = "minhasenha123"; // PROIBIDO

// ❌ Chaves de API reais
const apiKey = "sk-1234567890abcdef"; // PROIBIDO

// ❌ Tokens hardcoded
const jwt = "eyJhbGciOiJIUzI1NiIs..."; // PROIBIDO

// ❌ Dados sensíveis em logs
console.log("User password:", user.password); // PROIBIDO
```

### ✅ **Sempre Usar:**
```typescript
// ✅ Variáveis de ambiente
const apiKey = process.env.API_KEY;

// ✅ Exemplos fictícios
const examplePassword = "exemplo123"; // Para documentação

// ✅ Placeholders
const token = "YOUR_JWT_TOKEN_HERE";
```

---

## 📁 Estrutura de Arquivos

### Backend
```
backend/
├── src/
│   ├── auth/           # Autenticação e autorização
│   ├── users/          # Gestão de usuários
│   ├── tenants/        # Isolamento multitenant
│   ├── security-config/ # Configurações de segurança
│   ├── email/          # Serviços de email
│   ├── common/         # Utilitários compartilhados
│   │   ├── constants/  # Constantes globais
│   │   ├── decorators/ # Decorators customizados
│   │   ├── guards/     # Guards de autenticação
│   │   └── interceptors/ # Interceptors
│   └── prisma/         # Configuração do Prisma
├── prisma/             # Schema e migrations
└── DOCS/               # Documentação técnica
```

### Frontend
```
frontend/
├── src/
│   ├── app/            # App Router (Next.js 14+)
│   ├── components/     # Componentes reutilizáveis
│   │   └── ui/         # Componentes base (Radix UI)
│   ├── contexts/       # Contextos React
│   ├── hooks/          # Hooks customizados
│   └── lib/            # Utilitários e configurações
└── public/             # Arquivos estáticos
```

---

## 📝 Regras de Comentários

### Backend (TypeScript)
```typescript
/**
 * Serviço responsável pela autenticação de usuários
 * Implementa JWT + 2FA com isolamento multitenant
 */
@Injectable()
export class AuthService {
  /**
   * Realiza login do usuário com validação de credenciais
   * @param email - Email do usuário
   * @param password - Senha em texto plano
   * @returns Promise com tokens de acesso
   * @throws UnauthorizedException se credenciais inválidas
   */
  async login(email: string, password: string): Promise<LoginResult> {
    // Buscar usuário por email
    const user = await this.findUserByEmail(email);
    
    // Validar senha usando bcrypt
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    
    // Gerar tokens JWT
    return this.generateTokens(user);
  }
}
```

### Frontend (React/TypeScript)
```typescript
/**
 * Hook para gerenciar configurações da plataforma
 * Fornece cache automático e atualização em tempo real
 */
export function usePlatformConfig() {
  const [config, setConfig] = useState<PlatformConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  /**
   * Busca configurações da API com cache
   * Atualiza automaticamente quando há mudanças
   */
  const fetchConfig = useCallback(async () => {
    try {
      const response = await api.get('/platform-config');
      setConfig(response.data);
    } catch (error) {
      // Fallback para configurações padrão
      setConfig(DEFAULT_CONFIG);
    } finally {
      setLoading(false);
    }
  }, []);

  return { config, loading, refreshConfig: fetchConfig };
}
```

---

## 🌐 Internacionalização (i18n)

### Sempre criar traduções para:
- **Português (pt-BR)** - Idioma principal
- **Espanhol (es-ES)** - Mercado latino
- **Inglês (en-US)** - Padrão internacional

```typescript
// ✅ Exemplo de mensagens
export const MESSAGES = {
  'pt-BR': {
    'auth.login.success': 'Login realizado com sucesso',
    'auth.login.error': 'Credenciais inválidas',
    'user.created': 'Usuário criado com sucesso'
  },
  'es-ES': {
    'auth.login.success': 'Inicio de sesión exitoso',
    'auth.login.error': 'Credenciales inválidas',
    'user.created': 'Usuario creado exitosamente'
  },
  'en-US': {
    'auth.login.success': 'Login successful',
    'auth.login.error': 'Invalid credentials',
    'user.created': 'User created successfully'
  }
} as const;
```

---

## 🎯 Estratégia de Desenvolvimento

### 1. **Começar Simples**
```typescript
// ✅ Primeiro: Esqueleto básico
export class UserService {
  async createUser(data: CreateUserDto) {
    // Implementação básica
    return this.prisma.user.create({ data });
  }
}

// ✅ Depois: Adicionar funcionalidades
export class UserService {
  async createUser(data: CreateUserDto) {
    // Validações
    await this.validateUserData(data);
    
    // Hash da senha
    const hashedPassword = await this.hashPassword(data.password);
    
    // Criar usuário
    const user = await this.prisma.user.create({
      data: { ...data, password: hashedPassword }
    });
    
    // Enviar email de boas-vindas
    await this.emailService.sendWelcomeEmail(user.email);
    
    return user;
  }
}
```

### 2. **Modularidade**
```typescript
// ✅ Separar responsabilidades
export class AuthModule {
  // Apenas autenticação
}

export class UserModule {
  // Apenas gestão de usuários
}

export class EmailModule {
  // Apenas envio de emails
}
```

### 3. **Performance**
```typescript
// ✅ Evitar consultas duplicadas
const usersWithTenants = await this.prisma.user.findMany({
  include: { tenant: true } // Uma única query
});

// ❌ Evitar N+1 queries
const users = await this.prisma.user.findMany();
for (const user of users) {
  const tenant = await this.prisma.tenant.findUnique({
    where: { id: user.tenantId }
  }); // Múltiplas queries
}
```

---

## 📚 Documentação Obrigatória

### Para cada funcionalidade, criar em `DOCS/`:
1. **README técnico** - Como funciona
2. **Guia de uso** - Como usar
3. **Exemplos de código** - Implementação
4. **Testes** - Como testar
5. **Troubleshooting** - Solução de problemas

### Exemplo de estrutura:
```
DOCS/
├── FUNCIONALIDADE_NOME.md
├── GUIA_USO_FUNCIONALIDADE.md
├── EXEMPLOS_FUNCIONALIDADE.md
├── TESTES_FUNCIONALIDADE.md
└── TROUBLESHOOTING_FUNCIONALIDADE.md
```

---

## ✅ Checklist de Desenvolvimento

### Antes de implementar qualquer código:
- [ ] Explicar passo a passo o que o código faz
- [ ] Verificar se segue princípios SOLID
- [ ] Garantir que é simples (KISS)
- [ ] Evitar repetição (DRY)
- [ ] Adicionar comentários explicativos
- [ ] Implementar sanitização de entradas
- [ ] Adicionar tratamento de exceções
- [ ] Verificar segurança (auth/authz)
- [ ] Criar testes básicos
- [ ] Documentar na pasta DOCS/
- [ ] Criar traduções (pt/es/en)
- [ ] Otimizar para performance
- [ ] Manter consistência com código existente

### Perguntas obrigatórias antes de codificar:
1. **"Posso fazer isso de forma mais simples?"**
2. **"Este código está seguro?"**
3. **"Estou seguindo os padrões do projeto?"**
4. **"Este código é reutilizável?"**
5. **"Está bem documentado?"**

---

## 🚀 Comandos Úteis

### Backend
```bash
# Desenvolvimento
npm run start:dev

# Build
npm run build

# Prisma
npm run prisma:generate
npm run prisma:migrate

# Segurança
npm run security:check
```

### Frontend
```bash
# Desenvolvimento
npm run dev

# Build
npm run build

# Lint
npm run lint
```

---

## 📞 Suporte e Referências

### Documentação oficial:
- [NestJS](https://docs.nestjs.com/)
- [Next.js](https://nextjs.org/docs)
- [Prisma](https://www.prisma.io/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)

### Padrões do projeto:
- Consulte sempre `DOCS/` para exemplos
- Siga a estrutura de pastas existente
- Use os componentes e hooks já criados
- Mantenha consistência com o código atual

---

**⚠️ IMPORTANTE: Estas regras são obrigatórias e devem ser seguidas rigorosamente por qualquer IA que edite este projeto. Não há exceções sem aprovação explícita.**