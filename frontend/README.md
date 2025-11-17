# Frontend - Sistema Multitenant com Next.js

Frontend desenvolvido com Next.js 14, implementando interface segura com controle de acesso baseado em roles.

## 🚀 Tecnologias

- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Radix UI
- Axios

## 🔐 Recursos de Segurança

### 1. Armazenamento Seguro de Token
- Simulação de armazenamento seguro (Electron Keytar/Keychain)
- Em produção, usar `sessionStorage` ou `keytar` para Electron
- Token JWT armazenado de forma segura, não em `localStorage`

### 2. Requisições HTTPS
- Todas as requisições para o backend devem ser via HTTPS em produção
- Configuração de CORS no backend para aceitar apenas o frontend

### 3. Controle de Acesso no Cliente
- Componente `ProtectedRoute` para proteger rotas
- Verificação de roles antes de renderizar componentes
- Redirecionamento automático se não autorizado

### 4. Validação no Cliente
- Validação de formulários antes de enviar ao backend
- Validação de email, telefone e outros campos
- Mensagens de erro genéricas (não expõe detalhes técnicos)

### 5. Tratamento de Erros
- Interceptor Axios para tratar erros globalmente
- Redirecionamento automático em caso de token expirado (401)
- Mensagens de erro amigáveis ao usuário

## 📦 Instalação

```bash
# Instalar dependências
npm install

# Copiar .env.local.example para .env.local e configurar
cp .env.local.example .env.local

# Configurar a URL da API no .env.local
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## 🏃 Executar

```bash
# Desenvolvimento
npm run dev

# Build para produção
npm run build

# Executar produção
npm start
```

## 🗺️ Estrutura de Rotas

### Públicas
- `/` - Redirecionamento automático
- `/login` - Página de login

### Protegidas (Requer autenticação)
- `/dashboard` - Dashboard principal (todos os usuários autenticados)
- `/empresas` - Gerenciamento de empresas (apenas SUPER_ADMIN)
- `/configuracoes` - Configurações (SUPER_ADMIN e ADMIN)

## 🎨 Componentes

### Layout
- `Sidebar` - Menu lateral com navegação
- `ProtectedRoute` - HOC para proteger rotas

### UI (Radix UI)
- `Button` - Botões estilizados
- `Input` - Campos de entrada
- `Label` - Labels para formulários
- `Card` - Cards para conteúdo
- `Toast` - Notificações

## 🔑 Contexto de Autenticação

O `AuthContext` gerencia:
- Estado do usuário autenticado
- Função de login
- Função de logout
- Armazenamento seguro do token

```tsx
const { user, loading, login, logout } = useAuth();
```

## 📱 Simulação Electron

O sistema simula o armazenamento seguro do Electron:

```typescript
// Em produção Electron, usar:
// keytar.setPassword('app', 'jwt', token)
// keytar.getPassword('app', 'jwt')
// keytar.deletePassword('app', 'jwt')

// Atualmente usando sessionStorage para simulação
```

## 🎯 Visibilidade Condicional

O menu lateral oculta itens baseado no role do usuário:

- **Dashboard**: Visível para todos
- **Empresas**: Visível apenas para SUPER_ADMIN
- **Configurações**: Visível para SUPER_ADMIN e ADMIN

## 📝 Estrutura de Pastas

```
src/
├── app/                    # App Router do Next.js
│   ├── dashboard/         # Páginas do dashboard
│   ├── empresas/          # Página de empresas
│   ├── configuracoes/     # Página de configurações
│   └── login/             # Página de login
├── components/            # Componentes React
│   ├── ui/               # Componentes UI (Radix)
│   ├── Sidebar.tsx       # Menu lateral
│   └── ProtectedRoute.tsx # HOC de proteção
├── contexts/             # Contextos React
│   └── AuthContext.tsx   # Contexto de autenticação
├── hooks/                # Hooks customizados
│   └── use-toast.ts      # Hook de toast
└── lib/                  # Utilitários
    ├── api.ts           # Cliente Axios
    └── utils.ts         # Funções utilitárias
```

## 🔒 Boas Práticas de Segurança

1. **Nunca expor tokens no código**: Use variáveis de ambiente
2. **Validar no cliente e no servidor**: Validação dupla
3. **Mensagens de erro genéricas**: Não expor detalhes técnicos
4. **HTTPS obrigatório**: Em produção, sempre usar HTTPS
5. **Token expiration**: Implementar refresh token se necessário
6. **XSS Protection**: React já protege contra XSS por padrão
7. **CSRF Protection**: SameSite cookies no backend

