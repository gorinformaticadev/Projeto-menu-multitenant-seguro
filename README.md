# 🔒 Sistema Multitenant com Segurança Essencial

Sistema web completo com backend NestJS e frontend Next.js, implementando isolamento multitenant e controle de acesso baseado em roles (RBAC).

## 🏢 Desenvolvido por

**GOR Informática**
- 📞 WhatsApp: (61) 3359-7358
- 🌐 Website: www.gorinformatica.com.br

> 👋 **Novo aqui?** Comece pelo [DOCS/BOAS_VINDAS.md](DOCS/BOAS_VINDAS.md) para um guia completo de início!
> 
> ⚡ **Quer começar rápido?** Vá direto para [DOCS/INICIO_RAPIDO.md](DOCS/INICIO_RAPIDO.md) (5 minutos)

## 📋 Visão Geral

Este projeto demonstra a implementação de um sistema seguro com:

- **Backend**: NestJS 11 com PostgreSQL e Prisma
- **Frontend**: Next.js 14 com Tailwind CSS e Radix UI
- **Segurança**: JWT, Bcrypt, Guards, Interceptors, CORS
- **Isolamento**: Multitenant com filtro automático por tenantId

## 🏗️ Arquitetura

```
projeto/
├── backend/          # NestJS API
│   ├── src/
│   │   ├── auth/           # Autenticação JWT
│   │   ├── tenants/        # Gerenciamento de empresas
│   │   ├── common/         # Guards, Interceptors, Decorators
│   │   └── prisma/         # Prisma ORM
│   └── prisma/
│       ├── schema.prisma   # Schema do banco
│       └── seed.ts         # Dados iniciais
└── frontend/         # Next.js App
    └── src/
        ├── app/            # Páginas (App Router)
        ├── components/     # Componentes React
        ├── contexts/       # Contextos (Auth)
        └── lib/            # Utilitários
```

## 🔐 Recursos de Segurança Implementados

### Backend (NestJS)

#### 1. Autenticação e Hashing
- ✅ Senhas com **Bcrypt** (hash + salt)
- ✅ JWT com payload: `id`, `email`, `role`, `tenantId`
- ✅ Validação de token em todas as rotas protegidas

#### 2. Isolamento Multitenant
- ✅ **TenantInterceptor**: Injeta `tenantId` automaticamente
- ✅ Usuários só acessam dados do próprio tenant
- ✅ SUPER_ADMIN tem acesso global (sem filtro)

#### 3. Controle de Acesso (RBAC)
- ✅ **RolesGuard**: Protege rotas por role
- ✅ Roles: `SUPER_ADMIN`, `ADMIN`, `USER`, `CLIENT`
- ✅ Rotas de Tenants protegidas para SUPER_ADMIN

#### 4. Validação Rigorosa
- ✅ **ValidationPipe** global com `class-validator`
- ✅ Validação de tipos, formatos e regras de negócio
- ✅ Whitelist ativada (remove campos não esperados)

#### 5. Segurança HTTP
- ✅ **CORS** configurado para aceitar apenas o frontend
- ✅ Suporte a cookies com `SameSite=Strict`

### Frontend (Next.js)

#### 1. Armazenamento Seguro
- ✅ Simulação de armazenamento seguro (Electron Keytar)
- ✅ Token JWT não exposto em `localStorage`

#### 2. Controle de Acesso
- ✅ Componente `ProtectedRoute` para proteger páginas
- ✅ Verificação de roles antes de renderizar
- ✅ Redirecionamento automático se não autorizado

#### 3. Validação no Cliente
- ✅ Validação de formulários antes de enviar
- ✅ Mensagens de erro genéricas (não expõe detalhes)

#### 4. Requisições Seguras
- ✅ Interceptor Axios para tratamento de erros
- ✅ Redirecionamento em caso de token expirado

## 🚀 Instalação e Execução

### Pré-requisitos

- Node.js 18+
- PostgreSQL
- npm ou yarn

### ⚡ Início Rápido (5 minutos)

#### 1️⃣ Backend
```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npx ts-node prisma/seed.ts
npm run start:dev
```

#### 2️⃣ Frontend
```bash
cd frontend
npm install
npm run dev
```

#### 3️⃣ Acesse
- Frontend: `http://localhost:5000`
- Backend: `http://localhost:4000`

## 🔑 Credenciais de Teste

### SUPER_ADMIN
- **Email**: `admin@system.com`
- **Senha**: `admin123`
- **Acesso**: Todas as rotas, incluindo `/tenants`

### ADMIN (Tenant)
- **Email**: `admin@empresa1.com`
- **Senha**: `admin123`
- **Acesso**: Dados apenas do seu tenant

### USER
- **Email**: `user@empresa1.com`
- **Senha**: `user123`
- **Acesso**: Dados apenas do seu tenant

## 📡 Endpoints da API

### Autenticação
- `POST /auth/login` - Login (público)

### Tenants (Empresas)
- `GET /tenants` - Listar empresas (SUPER_ADMIN)
- `GET /tenants/:id` - Buscar empresa (SUPER_ADMIN)
- `POST /tenants` - Criar empresa (SUPER_ADMIN)
- `PUT /tenants/:id` - Atualizar empresa (SUPER_ADMIN)
- `PATCH /tenants/:id/toggle-status` - Ativar/Desativar empresa (SUPER_ADMIN)
- `PATCH /tenants/:id/change-admin-password` - Alterar senha do admin (SUPER_ADMIN)
- `POST /tenants/:id/upload-logo` - Upload de logo (SUPER_ADMIN)
- `PATCH /tenants/:id/remove-logo` - Remover logo (SUPER_ADMIN)

## 🗺️ Rotas do Frontend

### Públicas
- `/` - Redirecionamento automático
- `/login` - Página de login

### Protegidas
- `/dashboard` - Dashboard (todos os usuários)
- `/empresas` - Gerenciamento de empresas (SUPER_ADMIN)
- `/configuracoes` - Configurações (SUPER_ADMIN e ADMIN)

## 🛡️ Fluxo de Segurança

```
Request → CORS → ValidationPipe → JwtAuthGuard → RolesGuard → TenantInterceptor → Controller
```

1. **CORS**: Valida origem da requisição
2. **ValidationPipe**: Valida e transforma dados
3. **JwtAuthGuard**: Valida token JWT
4. **RolesGuard**: Verifica permissões por role
5. **TenantInterceptor**: Injeta tenantId para isolamento
6. **Controller**: Executa lógica de negócio

## 📊 Modelo de Dados

### User
- `id`: UUID
- `email`: String (único)
- `password`: String (hash Bcrypt)
- `name`: String
- `role`: Enum (SUPER_ADMIN, ADMIN, USER, CLIENT)
- `tenantId`: UUID (nullable)

### Tenant
- `id`: UUID
- `email`: String (único)
- `cnpjCpf`: String (único)
- `nomeFantasia`: String
- `nomeResponsavel`: String
- `telefone`: String

## 🎯 Funcionalidades Implementadas

### ✅ Backend
- [x] Autenticação JWT com Bcrypt
- [x] Isolamento multitenant com Interceptor
- [x] Guards de Roles (RBAC)
- [x] Validação rigorosa com class-validator
- [x] CORS configurado
- [x] Endpoints de Tenants protegidos
- [x] Upload de arquivos (logos de empresas)
- [x] Seed com dados iniciais

### ✅ Frontend
- [x] Página de login com validação
- [x] Dashboard com informações do usuário
- [x] Sidebar com visibilidade condicional
- [x] Página de empresas (SUPER_ADMIN)
- [x] Formulário de cadastro de empresas
- [x] Upload e gerenciamento de logos
- [x] Proteção de rotas por role
- [x] Armazenamento seguro de token
- [x] Tratamento de erros

## 📤 Upload de Arquivos

O sistema suporta upload de logos para empresas com as seguintes características:

### Configuração
- **Pasta de destino**: `backend/uploads/logos/`
- **Formatos aceitos**: JPG, JPEG, PNG, GIF, WEBP
- **Tamanho máximo**: 5MB por arquivo
- **Nomenclatura**: UUID único para evitar conflitos

### Endpoints
- `POST /tenants/:id/upload-logo` - Faz upload de um novo logo
- `PATCH /tenants/:id/remove-logo` - Remove o logo atual
- `GET /uploads/logos/:filename` - Acessa o arquivo (servido estaticamente)

### Funcionalidades
- ✅ Validação de tipo de arquivo
- ✅ Validação de tamanho
- ✅ Pré-visualização antes do upload
- ✅ Remoção automática do logo antigo ao fazer novo upload
- ✅ Exibição do logo nos cards de empresas

## 🔧 Tecnologias Utilizadas

### Backend
- NestJS 11
- PostgreSQL
- Prisma ORM
- Passport JWT
- Bcrypt
- class-validator
- class-transformer

### Frontend
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Radix UI
- Axios
- Lucide Icons

## 📚 Documentação Completa

### 📖 Guias de Início
- [DOCS/BOAS_VINDAS.md](DOCS/BOAS_VINDAS.md) - Guia completo de boas-vindas
- [DOCS/INICIO_RAPIDO.md](DOCS/INICIO_RAPIDO.md) - Início rápido (5 minutos)
- [INSTALACAO.md](INSTALACAO.md) - Guia de instalação detalhado
- [INSTRUCOES-RAPIDAS.md](INSTRUCOES-RAPIDAS.md) - Instruções rápidas

### 🏗️ Arquitetura e Estrutura
- [DOCS/ARQUITETURA_SEGURANCA.md](DOCS/ARQUITETURA_SEGURANCA.md) - Arquitetura de segurança
- [DOCS/ESTRUTURA_PROJETO.md](DOCS/ESTRUTURA_PROJETO.md) - Estrutura do projeto
- [DOCS/DIAGRAMA_SISTEMA.md](DOCS/DIAGRAMA_SISTEMA.md) - Diagramas visuais

### 🔧 Desenvolvimento
- [DOCS/COMANDOS_UTEIS.md](DOCS/COMANDOS_UTEIS.md) - Comandos úteis
- [DOCS/API_EXAMPLES.md](backend/API_EXAMPLES.md) - Exemplos de API
- [DOCS/COMANDOS_PRISMA.md](DOCS/COMANDOS_PRISMA.md) - Comandos Prisma

### 🛡️ Segurança
- [DOCS/SEGURANCA_PRODUCAO.md](DOCS/SEGURANCA_PRODUCAO.md) - Segurança em produção
- [DOCS/CHECKLIST_PRE_DEPLOY_SEGURANCA.md](DOCS/CHECKLIST_PRE_DEPLOY_SEGURANCA.md) - Checklist pré-deploy
- [DOCS/CHECKLIST_MENSAL_SEGURANCA.md](DOCS/CHECKLIST_MENSAL_SEGURANCA.md) - Checklist mensal

### 📋 Implementação
- [DOCS/CHECKLIST_IMPLEMENTACAO.md](DOCS/CHECKLIST_IMPLEMENTACAO.md) - Checklist e roadmap
- [DOCS/RESUMO_EXECUTIVO.md](DOCS/RESUMO_EXECUTIVO.md) - Resumo executivo
- [DOCS/PROXIMOS_PASSOS.md](DOCS/PROXIMOS_PASSOS.md) - Próximos passos

## 📝 Próximos Passos

- [ ] Implementar refresh token
- [ ] Adicionar testes unitários e e2e
- [ ] Implementar CRUD completo de usuários
- [ ] Adicionar logs de auditoria
- [ ] Implementar rate limiting
- [ ] Adicionar documentação Swagger
- [ ] Implementar recuperação de senha
- [ ] Adicionar autenticação de dois fatores (2FA)

## 🎯 Casos de Uso

### SaaS Multitenant
Cada cliente tem seus dados isolados automaticamente.

### Plataforma de Gerenciamento
Administrador global gerencia múltiplas organizações.

### Sistema Corporativo
Diferentes departamentos com diferentes níveis de acesso.

## 💝 Apoie o Projeto

Se este projeto foi útil para você, considere fazer uma doação via PIX:

**Chave PIX:** gilsonoliverr@gmail.com

![QR Code PIX](./qr-code-pix.png)

Para mais informações sobre doações, consulte: [DOACOES.md](./DOACOES.md)

## � Licença

Este projeto está licenciado sob a GNU Affero General Public License v3.0 (AGPL-3.0).

Copyright (C) 2025 GOR Informática

Este programa é software livre: você pode redistribuí-lo e/ou modificá-lo
sob os termos da Licença Pública Geral GNU Affero conforme publicada pela
Free Software Foundation, seja a versão 3 da Licença, ou (a seu critério)
qualquer versão posterior.

Para mais detalhes, consulte o arquivo [LICENSE](./LICENSE).

## 📞 Suporte

Para suporte técnico ou dúvidas:
- � WheatsApp: (61) 3359-7358
- 🌐 Website: www.gorinformatica.com.br

## 🏆 Conquistas

Este sistema implementa:

- ✅ Arquitetura modular (NestJS)
- ✅ App Router (Next.js 14)
- ✅ JWT Authentication
- ✅ RBAC (Role-Based Access Control)
- ✅ Multitenant Architecture
- ✅ TypeScript full-stack
- ✅ Prisma ORM
- ✅ Tailwind CSS + Radix UI
- ✅ Upload de arquivos
- ✅ Validação rigorosa
- ✅ Segurança em múltiplas camadas

---

**GOR Informática** - Soluções em Tecnologia da Informação

*Sistema desenvolvido como demonstração de boas práticas de segurança em aplicações web multitenant.*