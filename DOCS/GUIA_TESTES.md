# 🧪 Guia de Testes

Este documento contém cenários de teste para validar todas as funcionalidades e mecanismos de segurança do sistema.

## 📋 Índice

1. [Testes de Autenticação](#testes-de-autenticação)
2. [Testes de Isolamento Multitenant](#testes-de-isolamento-multitenant)
3. [Testes de Controle de Acesso (RBAC)](#testes-de-controle-de-acesso-rbac)
4. [Testes de Validação](#testes-de-validação)
5. [Testes de Segurança](#testes-de-segurança)
6. [Testes de Interface](#testes-de-interface)

## 🔐 Testes de Autenticação

### Teste 1.1: Login com Credenciais Válidas

**Objetivo:** Verificar se o login funciona corretamente

**Passos:**
1. Acesse `http://localhost:5000/login`
2. Digite:
   - Email: `admin@system.com`
   - Senha: `admin123`
3. Clique em "Entrar"

**Resultado Esperado:**
- ✅ Redirecionamento para `/dashboard`
- ✅ Token JWT armazenado
- ✅ Informações do usuário exibidas no sidebar

### Teste 1.2: Login com Credenciais Inválidas

**Objetivo:** Verificar tratamento de erro em login inválido

**Passos:**
1. Acesse `http://localhost:5000/login`
2. Digite:
   - Email: `admin@system.com`
   - Senha: `senha_errada`
3. Clique em "Entrar"

**Resultado Esperado:**
- ✅ Mensagem de erro: "Credenciais inválidas"
- ✅ Permanece na página de login
- ✅ Não armazena token

### Teste 1.3: Login com Email Inválido

**Objetivo:** Verificar validação de formato de email

**Passos:**
1. Acesse `http://localhost:5000/login`
2. Digite:
   - Email: `email_invalido`
   - Senha: `admin123`
3. Clique em "Entrar"

**Resultado Esperado:**
- ✅ Mensagem de erro: "Preencha todos os campos" ou validação de email
- ✅ Não envia requisição ao backend

### Teste 1.4: Logout

**Objetivo:** Verificar se o logout funciona corretamente

**Passos:**
1. Faça login com qualquer usuário
2. Clique no botão "Sair" no final do sidebar

**Resultado Esperado:**
- ✅ Token removido do armazenamento
- ✅ Redirecionamento para `/login`
- ✅ Não consegue acessar rotas protegidas

### Teste 1.5: Acesso sem Autenticação

**Objetivo:** Verificar proteção de rotas

**Passos:**
1. Sem fazer login, tente acessar `http://localhost:5000/dashboard`

**Resultado Esperado:**
- ✅ Redirecionamento automático para `/login`

## 🏢 Testes de Isolamento Multitenant

### Teste 2.1: SUPER_ADMIN Acessa Todos os Tenants

**Objetivo:** Verificar acesso global do SUPER_ADMIN

**Passos:**
1. Faça login como `admin@system.com` / `admin123`
2. Acesse "Empresas"
3. Observe a lista de empresas

**Resultado Esperado:**
- ✅ Vê todas as empresas cadastradas
- ✅ Pode criar novas empresas

### Teste 2.2: USER Não Acessa Dados de Outro Tenant

**Objetivo:** Verificar isolamento de dados

**Passos:**
1. Faça login como `user@empresa1.com` / `user123`
2. Observe que o menu "Empresas" não aparece
3. Tente acessar `http://localhost:5000/empresas` diretamente

**Resultado Esperado:**
- ✅ Menu "Empresas" não visível
- ✅ Redirecionamento para `/dashboard` ao tentar acessar diretamente
- ✅ Não consegue ver dados de outros tenants

### Teste 2.3: API - Isolamento de Dados

**Objetivo:** Verificar isolamento no backend

**Passos:**
1. Faça login como `user@empresa1.com` / `user123`
2. Copie o token JWT
3. Tente fazer requisição para `/tenants`:
   ```bash
   curl -X GET http://localhost:4000/tenants \
     -H "Authorization: Bearer SEU_TOKEN"
   ```

**Resultado Esperado:**
- ✅ Erro 403 (Forbidden)
- ✅ Mensagem: "Você não tem permissão para acessar este recurso"

## 🔒 Testes de Controle de Acesso (RBAC)

### Teste 3.1: SUPER_ADMIN - Acesso Total

**Objetivo:** Verificar permissões do SUPER_ADMIN

**Passos:**
1. Faça login como `admin@system.com` / `admin123`
2. Verifique os itens do menu

**Resultado Esperado:**
- ✅ Dashboard (visível)
- ✅ Empresas (visível)
- ✅ Configurações (visível)

### Teste 3.2: ADMIN - Acesso Limitado

**Objetivo:** Verificar permissões do ADMIN

**Passos:**
1. Faça login como `admin@empresa1.com` / `admin123`
2. Verifique os itens do menu

**Resultado Esperado:**
- ✅ Dashboard (visível)
- ❌ Empresas (não visível)
- ✅ Configurações (visível)

### Teste 3.3: USER - Acesso Básico

**Objetivo:** Verificar permissões do USER

**Passos:**
1. Faça login como `user@empresa1.com` / `user123`
2. Verifique os itens do menu

**Resultado Esperado:**
- ✅ Dashboard (visível)
- ❌ Empresas (não visível)
- ❌ Configurações (não visível)

### Teste 3.4: Tentativa de Acesso Não Autorizado

**Objetivo:** Verificar bloqueio de acesso

**Passos:**
1. Faça login como `user@empresa1.com` / `user123`
2. Tente acessar `http://localhost:5000/configuracoes`

**Resultado Esperado:**
- ✅ Redirecionamento para `/dashboard`
- ✅ Não consegue acessar a página

## ✅ Testes de Validação

### Teste 4.1: Cadastro de Empresa - Campos Obrigatórios

**Objetivo:** Verificar validação de campos obrigatórios

**Passos:**
1. Faça login como SUPER_ADMIN
2. Acesse "Empresas"
3. Clique em "Nova Empresa"
4. Deixe todos os campos vazios
5. Clique em "Cadastrar Empresa"

**Resultado Esperado:**
- ✅ Mensagem de erro: "Preencha todos os campos"
- ✅ Não envia requisição ao backend

### Teste 4.2: Cadastro de Empresa - Email Inválido

**Objetivo:** Verificar validação de email

**Passos:**
1. Faça login como SUPER_ADMIN
2. Acesse "Empresas"
3. Clique em "Nova Empresa"
4. Preencha:
   - Email: `email_invalido`
   - Outros campos: valores válidos
5. Clique em "Cadastrar Empresa"

**Resultado Esperado:**
- ✅ Mensagem de erro: "Email inválido"
- ✅ Não envia requisição ao backend

### Teste 4.3: Cadastro de Empresa - Telefone Inválido

**Objetivo:** Verificar validação de telefone

**Passos:**
1. Faça login como SUPER_ADMIN
2. Acesse "Empresas"
3. Clique em "Nova Empresa"
4. Preencha:
   - Telefone: `abc123`
   - Outros campos: valores válidos
5. Clique em "Cadastrar Empresa"

**Resultado Esperado:**
- ✅ Mensagem de erro: "Telefone inválido"
- ✅ Não envia requisição ao backend

### Teste 4.4: Cadastro de Empresa - Email Duplicado

**Objetivo:** Verificar validação de unicidade

**Passos:**
1. Faça login como SUPER_ADMIN
2. Acesse "Empresas"
3. Clique em "Nova Empresa"
4. Preencha com email já existente: `empresa1@example.com`
5. Clique em "Cadastrar Empresa"

**Resultado Esperado:**
- ✅ Mensagem de erro: "Já existe uma empresa com este email ou CNPJ/CPF"
- ✅ Erro 409 (Conflict) do backend

### Teste 4.5: Cadastro de Empresa - Sucesso

**Objetivo:** Verificar cadastro bem-sucedido

**Passos:**
1. Faça login como SUPER_ADMIN
2. Acesse "Empresas"
3. Clique em "Nova Empresa"
4. Preencha:
   ```
   Email: novaemp@example.com
   CNPJ/CPF: 98765432109876
   Nome Fantasia: Nova Empresa LTDA
   Nome do Responsável: Maria Santos
   Telefone: (21) 91234-5678
   ```
5. Clique em "Cadastrar Empresa"

**Resultado Esperado:**
- ✅ Mensagem de sucesso: "Empresa cadastrada com sucesso!"
- ✅ Empresa aparece na lista
- ✅ Formulário é limpo

## 🛡️ Testes de Segurança

### Teste 5.1: Token Expirado

**Objetivo:** Verificar tratamento de token expirado

**Passos:**
1. Faça login
2. Espere o token expirar (ou modifique manualmente)
3. Tente acessar uma rota protegida

**Resultado Esperado:**
- ✅ Redirecionamento para `/login`
- ✅ Mensagem de erro apropriada

### Teste 5.2: Token Inválido

**Objetivo:** Verificar validação de token

**Passos:**
1. Abra o DevTools do navegador
2. Modifique o token no sessionStorage para um valor inválido
3. Tente acessar uma rota protegida

**Resultado Esperado:**
- ✅ Redirecionamento para `/login`
- ✅ Token removido do armazenamento

### Teste 5.3: CORS - Origem Não Autorizada

**Objetivo:** Verificar proteção CORS

**Passos:**
1. Tente fazer requisição de uma origem diferente:
   ```javascript
   fetch('http://localhost:4000/tenants', {
     headers: {
       'Authorization': 'Bearer token'
     }
   })
   ```

**Resultado Esperado:**
- ✅ Erro de CORS
- ✅ Requisição bloqueada pelo navegador

### Teste 5.4: SQL Injection (Proteção)

**Objetivo:** Verificar proteção contra SQL Injection

**Passos:**
1. Tente fazer login com:
   - Email: `admin@system.com' OR '1'='1`
   - Senha: `qualquer`

**Resultado Esperado:**
- ✅ Login falha
- ✅ Prisma protege automaticamente contra SQL Injection

### Teste 5.5: XSS (Proteção)

**Objetivo:** Verificar proteção contra XSS

**Passos:**
1. Tente cadastrar empresa com:
   - Nome Fantasia: `<script>alert('XSS')</script>`

**Resultado Esperado:**
- ✅ React escapa automaticamente
- ✅ Script não é executado
- ✅ Texto é exibido literalmente

## 🎨 Testes de Interface

### Teste 6.1: Responsividade

**Objetivo:** Verificar layout em diferentes tamanhos

**Passos:**
1. Acesse o sistema
2. Redimensione a janela do navegador
3. Teste em mobile (DevTools)

**Resultado Esperado:**
- ✅ Layout se adapta ao tamanho da tela
- ✅ Sidebar responsiva
- ✅ Formulários responsivos

### Teste 6.2: Loading States

**Objetivo:** Verificar estados de carregamento

**Passos:**
1. Faça login
2. Observe o loading durante a requisição
3. Acesse "Empresas"
4. Observe o loading ao carregar a lista

**Resultado Esperado:**
- ✅ Spinner de loading exibido
- ✅ Botões desabilitados durante requisição
- ✅ Feedback visual apropriado

### Teste 6.3: Notificações (Toast)

**Objetivo:** Verificar sistema de notificações

**Passos:**
1. Faça login com credenciais inválidas
2. Observe a notificação de erro
3. Cadastre uma empresa com sucesso
4. Observe a notificação de sucesso

**Resultado Esperado:**
- ✅ Toast de erro exibido (vermelho)
- ✅ Toast de sucesso exibido (verde)
- ✅ Toast desaparece automaticamente

### Teste 6.4: Navegação

**Objetivo:** Verificar navegação entre páginas

**Passos:**
1. Faça login
2. Clique em cada item do menu
3. Verifique se a página correta é exibida

**Resultado Esperado:**
- ✅ Navegação funciona corretamente
- ✅ URL atualiza
- ✅ Página correta é renderizada

## 📊 Checklist de Testes

### Autenticação
- [ ] Login com credenciais válidas
- [ ] Login com credenciais inválidas
- [ ] Login com email inválido
- [ ] Logout
- [ ] Acesso sem autenticação

### Isolamento Multitenant
- [ ] SUPER_ADMIN acessa todos os tenants
- [ ] USER não acessa dados de outro tenant
- [ ] API - Isolamento de dados

### Controle de Acesso (RBAC)
- [ ] SUPER_ADMIN - Acesso total
- [ ] ADMIN - Acesso limitado
- [ ] USER - Acesso básico
- [ ] Tentativa de acesso não autorizado

### Validação
- [ ] Campos obrigatórios
- [ ] Email inválido
- [ ] Telefone inválido
- [ ] Email duplicado
- [ ] Cadastro bem-sucedido

### Segurança
- [ ] Token expirado
- [ ] Token inválido
- [ ] CORS
- [ ] SQL Injection (proteção)
- [ ] XSS (proteção)

### Interface
- [ ] Responsividade
- [ ] Loading states
- [ ] Notificações (Toast)
- [ ] Navegação

## 🧪 Testes Automatizados (A Implementar)

### Backend (Jest)

```typescript
// auth.service.spec.ts
describe('AuthService', () => {
  it('should hash password correctly', async () => {
    const password = 'test123';
    const hashed = await authService.hashPassword(password);
    expect(hashed).not.toBe(password);
  });

  it('should validate correct password', async () => {
    const result = await authService.login({
      email: 'admin@system.com',
      password: 'admin123',
    });
    expect(result.accessToken).toBeDefined();
  });

  it('should reject invalid password', async () => {
    await expect(
      authService.login({
        email: 'admin@system.com',
        password: 'wrong',
      }),
    ).rejects.toThrow('Credenciais inválidas');
  });
});
```

### Frontend (Jest + React Testing Library)

```typescript
// LoginPage.test.tsx
describe('LoginPage', () => {
  it('should render login form', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
  });

  it('should show error on invalid credentials', async () => {
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'test@test.com' },
    });
    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: 'wrong' },
    });
    fireEvent.click(screen.getByText('Entrar'));
    
    await waitFor(() => {
      expect(screen.getByText('Credenciais inválidas')).toBeInTheDocument();
    });
  });
});
```

### E2E (Playwright/Cypress)

```typescript
// login.spec.ts
test('should login successfully', async ({ page }) => {
  await page.goto('http://localhost:5000/login');
  await page.fill('input[type="email"]', 'admin@system.com');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  
  await expect(page).toHaveURL('http://localhost:5000/dashboard');
  await expect(page.locator('text=Super Admin')).toBeVisible();
});
```

## 📝 Relatório de Testes

Após executar todos os testes, preencha:

| Teste | Status | Observações |
|-------|--------|-------------|
| 1.1 - Login válido | ✅ | |
| 1.2 - Login inválido | ✅ | |
| 1.3 - Email inválido | ✅ | |
| 1.4 - Logout | ✅ | |
| 1.5 - Acesso sem auth | ✅ | |
| 2.1 - SUPER_ADMIN acesso | ✅ | |
| 2.2 - USER isolamento | ✅ | |
| 2.3 - API isolamento | ✅ | |
| ... | ... | ... |

## 🎯 Próximos Passos

1. Implementar testes automatizados
2. Configurar CI/CD para executar testes
3. Adicionar coverage mínimo de 80%
4. Implementar testes de performance
5. Adicionar testes de segurança (OWASP)

## 📚 Recursos

- [Jest](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright](https://playwright.dev/)
- [Cypress](https://www.cypress.io/)
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)

