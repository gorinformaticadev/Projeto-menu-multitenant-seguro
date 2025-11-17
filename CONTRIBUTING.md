# 🤝 Guia de Contribuição

Obrigado por considerar contribuir com este projeto! Este documento contém diretrizes para contribuições.

## 📋 Índice

1. [Código de Conduta](#código-de-conduta)
2. [Como Contribuir](#como-contribuir)
3. [Padrões de Código](#padrões-de-código)
4. [Processo de Pull Request](#processo-de-pull-request)
5. [Reportando Bugs](#reportando-bugs)
6. [Sugerindo Melhorias](#sugerindo-melhorias)

## 📜 Código de Conduta

### Nosso Compromisso

Estamos comprometidos em fornecer um ambiente acolhedor e inspirador para todos, independentemente de:

- Idade
- Tamanho corporal
- Deficiência
- Etnia
- Identidade e expressão de gênero
- Nível de experiência
- Nacionalidade
- Aparência pessoal
- Raça
- Religião
- Identidade e orientação sexual

### Comportamento Esperado

- Use linguagem acolhedora e inclusiva
- Respeite pontos de vista e experiências diferentes
- Aceite críticas construtivas graciosamente
- Foque no que é melhor para a comunidade
- Mostre empatia com outros membros da comunidade

### Comportamento Inaceitável

- Uso de linguagem ou imagens sexualizadas
- Trolling, comentários insultuosos/depreciativos
- Assédio público ou privado
- Publicar informações privadas de outros sem permissão
- Outras condutas que possam ser consideradas inapropriadas

## 🚀 Como Contribuir

### 1. Fork o Repositório

```bash
# Clone seu fork
git clone https://github.com/seu-usuario/projeto.git
cd projeto

# Adicione o repositório original como upstream
git remote add upstream https://github.com/original/projeto.git
```

### 2. Crie uma Branch

```bash
# Atualize sua branch main
git checkout main
git pull upstream main

# Crie uma nova branch
git checkout -b feature/minha-feature
# ou
git checkout -b fix/meu-bugfix
```

### 3. Faça suas Alterações

- Escreva código limpo e bem documentado
- Siga os padrões de código do projeto
- Adicione testes se aplicável
- Atualize a documentação se necessário

### 4. Commit suas Alterações

Use commits semânticos:

```bash
# Feat: Nova funcionalidade
git commit -m "feat: adiciona endpoint de usuários"

# Fix: Correção de bug
git commit -m "fix: corrige validação de email"

# Docs: Documentação
git commit -m "docs: atualiza README com exemplos"

# Style: Formatação
git commit -m "style: formata código com prettier"

# Refactor: Refatoração
git commit -m "refactor: melhora estrutura do AuthService"

# Test: Testes
git commit -m "test: adiciona testes para TenantService"

# Chore: Manutenção
git commit -m "chore: atualiza dependências"
```

### 5. Push para seu Fork

```bash
git push origin feature/minha-feature
```

### 6. Abra um Pull Request

- Vá para o repositório original no GitHub
- Clique em "New Pull Request"
- Selecione sua branch
- Preencha o template de PR

## 💻 Padrões de Código

### Backend (NestJS)

#### Estrutura de Arquivos

```
module-name/
├── dto/
│   ├── create-*.dto.ts
│   └── update-*.dto.ts
├── entities/
│   └── *.entity.ts
├── *.controller.ts
├── *.service.ts
└── *.module.ts
```

#### Nomenclatura

- **Classes:** PascalCase (`UserService`, `AuthController`)
- **Arquivos:** kebab-case (`user.service.ts`, `auth.controller.ts`)
- **Variáveis:** camelCase (`userId`, `accessToken`)
- **Constantes:** UPPER_SNAKE_CASE (`JWT_SECRET`, `MAX_ATTEMPTS`)

#### Exemplo de Service

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany();
  }

  async findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }
}
```

#### Exemplo de Controller

```typescript
import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  constructor(private userService: UserService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  findAll() {
    return this.userService.findAll();
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }
}
```

#### Exemplo de DTO

```typescript
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail({}, { message: 'Email inválido' })
  @IsNotEmpty({ message: 'Email é obrigatório' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Senha é obrigatória' })
  @MinLength(6, { message: 'Senha deve ter no mínimo 6 caracteres' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  name: string;
}
```

### Frontend (Next.js)

#### Estrutura de Arquivos

```
feature-name/
├── components/
│   ├── FeatureComponent.tsx
│   └── FeatureForm.tsx
├── layout.tsx
└── page.tsx
```

#### Nomenclatura

- **Componentes:** PascalCase (`UserList`, `LoginForm`)
- **Arquivos:** PascalCase para componentes (`UserList.tsx`)
- **Páginas:** kebab-case (`page.tsx`, `layout.tsx`)
- **Hooks:** camelCase com prefixo `use` (`useAuth`, `useToast`)

#### Exemplo de Componente

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface UserFormProps {
  onSubmit: (data: UserData) => void;
  loading?: boolean;
}

export function UserForm({ onSubmit, loading = false }: UserFormProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ email, name });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        disabled={loading}
      />
      <Input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nome"
        disabled={loading}
      />
      <Button type="submit" disabled={loading}>
        {loading ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}
```

#### Exemplo de Página

```typescript
"use client";

import { useState, useEffect } from "react";
import { UserForm } from "./components/UserForm";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const response = await api.get("/users");
      setUsers(response.data);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao carregar usuários",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Usuários</h1>
      {/* Conteúdo */}
    </div>
  );
}
```

### Estilo de Código

#### TypeScript

- Use TypeScript em todo o projeto
- Evite `any`, use tipos específicos
- Use interfaces para objetos complexos
- Use enums para valores fixos

```typescript
// ✅ BOM
interface User {
  id: string;
  email: string;
  role: Role;
}

enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  USER = 'USER',
}

// ❌ RUIM
const user: any = { ... };
```

#### Comentários

- Comente código complexo
- Use JSDoc para funções públicas
- Evite comentários óbvios

```typescript
// ✅ BOM
/**
 * Valida se o usuário tem permissão para acessar o recurso
 * @param userId - ID do usuário
 * @param resourceId - ID do recurso
 * @returns true se tem permissão, false caso contrário
 */
async function hasPermission(userId: string, resourceId: string): Promise<boolean> {
  // Lógica complexa aqui
}

// ❌ RUIM
// Retorna o usuário
function getUser() { ... }
```

#### Formatação

- Use Prettier para formatação automática
- Indentação: 2 espaços
- Aspas: simples para strings
- Ponto e vírgula: sempre

```typescript
// ✅ BOM
const user = {
  id: '123',
  email: 'user@example.com',
};

// ❌ RUIM
const user={id:"123",email:"user@example.com"}
```

## 🔄 Processo de Pull Request

### Template de PR

```markdown
## Descrição
Breve descrição das mudanças

## Tipo de Mudança
- [ ] Bug fix
- [ ] Nova funcionalidade
- [ ] Breaking change
- [ ] Documentação

## Como Testar
1. Passo 1
2. Passo 2
3. Passo 3

## Checklist
- [ ] Código segue os padrões do projeto
- [ ] Testes foram adicionados/atualizados
- [ ] Documentação foi atualizada
- [ ] Não há warnings no console
- [ ] Build passa sem erros
```

### Revisão de Código

Seu PR será revisado considerando:

1. **Funcionalidade**
   - O código faz o que deveria?
   - Há casos de borda não tratados?

2. **Qualidade**
   - Código limpo e legível?
   - Segue os padrões do projeto?
   - Bem documentado?

3. **Testes**
   - Testes adequados foram adicionados?
   - Todos os testes passam?

4. **Segurança**
   - Não introduz vulnerabilidades?
   - Validação adequada de inputs?

5. **Performance**
   - Não degrada a performance?
   - Queries otimizadas?

## 🐛 Reportando Bugs

### Template de Issue de Bug

```markdown
## Descrição do Bug
Descrição clara e concisa do bug

## Para Reproduzir
1. Vá para '...'
2. Clique em '...'
3. Role até '...'
4. Veja o erro

## Comportamento Esperado
O que deveria acontecer

## Screenshots
Se aplicável, adicione screenshots

## Ambiente
- OS: [ex: Windows 10]
- Browser: [ex: Chrome 120]
- Node: [ex: 18.17.0]
- Versão: [ex: 1.0.0]

## Informações Adicionais
Qualquer outra informação relevante
```

### Antes de Reportar

1. Verifique se o bug já foi reportado
2. Verifique se está na versão mais recente
3. Tente reproduzir em ambiente limpo
4. Colete informações relevantes

## 💡 Sugerindo Melhorias

### Template de Issue de Feature

```markdown
## Descrição da Feature
Descrição clara e concisa da feature

## Problema que Resolve
Qual problema esta feature resolve?

## Solução Proposta
Como você imagina que funcione?

## Alternativas Consideradas
Outras soluções que você considerou?

## Informações Adicionais
Mockups, exemplos, etc.
```

### Antes de Sugerir

1. Verifique se já não foi sugerido
2. Verifique se está no roadmap
3. Considere se faz sentido para o projeto
4. Pense em implementação

## 🧪 Testes

### Backend

```bash
cd backend

# Executar testes
npm run test

# Executar testes com coverage
npm run test:cov

# Executar testes e2e
npm run test:e2e
```

### Frontend

```bash
cd frontend

# Executar testes
npm run test

# Executar testes com coverage
npm run test:cov
```

### Escrevendo Testes

#### Backend (Jest)

```typescript
describe('UserService', () => {
  let service: UserService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [UserService, PrismaService],
    }).compile();

    service = module.get<UserService>(UserService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should create a user', async () => {
    const userData = {
      email: 'test@example.com',
      name: 'Test User',
    };

    const result = await service.create(userData);

    expect(result).toHaveProperty('id');
    expect(result.email).toBe(userData.email);
  });
});
```

#### Frontend (Jest + React Testing Library)

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { UserForm } from './UserForm';

describe('UserForm', () => {
  it('should render form fields', () => {
    render(<UserForm onSubmit={jest.fn()} />);

    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nome')).toBeInTheDocument();
  });

  it('should call onSubmit with form data', () => {
    const onSubmit = jest.fn();
    render(<UserForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Nome'), {
      target: { value: 'Test User' },
    });
    fireEvent.click(screen.getByText('Salvar'));

    expect(onSubmit).toHaveBeenCalledWith({
      email: 'test@example.com',
      name: 'Test User',
    });
  });
});
```

## 📚 Documentação

### Atualizando Documentação

Se sua mudança afeta:

- **API:** Atualize `API_EXAMPLES.md`
- **Instalação:** Atualize `INSTALACAO.md`
- **Arquitetura:** Atualize `ARQUITETURA_SEGURANCA.md`
- **Comandos:** Atualize `COMANDOS_UTEIS.md`
- **Testes:** Atualize `GUIA_TESTES.md`

### Escrevendo Documentação

- Use linguagem clara e concisa
- Inclua exemplos práticos
- Adicione screenshots quando relevante
- Mantenha formatação consistente

## 🎯 Prioridades

### Alta Prioridade
- Correções de segurança
- Bugs críticos
- Melhorias de performance

### Média Prioridade
- Novas funcionalidades
- Melhorias de UX
- Refatorações

### Baixa Prioridade
- Melhorias de documentação
- Otimizações menores
- Ajustes de estilo

## 🏆 Reconhecimento

Contribuidores serão reconhecidos:

- No README.md
- Nas release notes
- No CONTRIBUTORS.md (a criar)

## 📞 Contato

Dúvidas sobre contribuição?

- Abra uma issue com a tag `question`
- Entre em contato com os mantenedores

## 📄 Licença

Ao contribuir, você concorda que suas contribuições serão licenciadas sob a licença MIT do projeto.

---

**Obrigado por contribuir! 🎉**

