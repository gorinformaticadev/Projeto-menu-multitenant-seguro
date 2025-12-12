# Arquitetura Modular do Core

## 1. Objetivo

Transformar o repositório existente "Projeto-menu-multitenant-seguro" em um sistema CORE modular com suporte completo para módulos plug-and-play isolados no estilo do Perfex CRM. O CORE conterá apenas componentes ir substituíveis enquanto habilita o carregamento dinâmico de módulos e ativação específica por tenant.

## 2. Princípios Fundamentais

- Manter apenas componentes ir substituíveis no CORE
- Habilitar estrutura de módulos isolados com carregamento automático
- Suportar ativação/desativação de módulos específica por tenant
- Preservar sistemas existentes de segurança, multitenancy e RBAC
- Garantir compatibilidade retroativa com funcionalidades atuais

## 3. Componentes do CORE (Elementos Ir Substituíveis)

Os seguintes elementos permanecerão no CORE pois nunca serão substituídos:

### 3.1 Autenticação e Autorização
- Autenticação JWT com hash Bcrypt
- Controle de acesso baseado em roles (RBAC)
- Roles de usuário: SUPER_ADMIN, ADMIN, USER, CLIENT

### 3.2 Multitenancy
- Mecanismos de isolamento de tenants
- TenantInterceptor para filtragem automática de tenants
- Separação de dados multitenant

### 3.3 Estrutura Base
- Fundação do dashboard
- Estrutura de layout (header, sidebar, notificações)
- Estrutura base da API
- Sistema de permissões globais
- Framework de comunicação entre módulos
- Motor de carregamento dinâmico de módulos
- Painel administrativo central
- Sistemas de logging, auditoria e middlewares
- Conexão Prisma e base do schema principal

## 4. Nova Arquitetura Modular

### 4.1 Estrutura de Diretórios
```
/core/
  backend/
  frontend/
  shared/
  modules/
    engine/
/modules/
  <nome-do-modulo>/
    module.config.json
    backend/
      controllers/
      services/
      prisma/
      routes.ts
      permissions.ts
      events.ts
      index.ts
    frontend/
      pages/
      components/
      hooks/
      menu.ts
      notifications.ts
      index.ts
    integrations/
      triggers/
      listeners/
      api-extensions.ts
```

### 4.2 Requisitos do Motor de Módulos
O Motor de Módulos operará tanto no backend (NestJS) quanto no frontend (Next.js), localizado em `/core/modules/engine`.

#### Funções Backend:
- Registro automático de módulos
- Exposição e fornecimento de metadados
- Registro automático de rotas
- Carregamento de permissões e roles
- Manipulação de migrações Prisma para módulos
- Resolução estável de conflitos de dependência

#### Funções Frontend:
- Carregamento de menus a partir de módulos
- Carregamento de páginas a partir de módulos
- Adição dinâmica de componentes
- Integração de notificações

## 5. Especificações de Integração de Módulos

### 5.1 Integração de Menu
- Core lê `frontend/menu.ts` de cada módulo
- Exibição automática no layout
- Suporte para badges e contadores

### 5.2 Integração de Notificações
- Core lê `frontend/notifications.ts` de cada módulo
- Integração automática do sistema de notificações

### 5.3 Ativação de Módulos Baseada em Tenant
- Motor de Módulos lê a tabela `tenant_modules`
- Controla a visibilidade de módulos por tenant
- Bloqueia rotas backend quando inativo
- Bloqueia páginas frontend quando inativo
- Garante que módulos ativos permaneçam funcionais

## 6. Requisitos de Compatibilidade

Todas as transformações devem manter compatibilidade total com:
- Prisma ORM
- Sistema RBAC
- Arquitetura multitenancy
- Estrutura de layout existente
- Perfis de usuários
- Sistema de login
- Dashboard atual

## 7. Etapas de Implementação

### 7.1 Restruturação do Projeto
1. Mover todos os arquivos atuais do projeto para o diretório `/core`
2. Manter a estrutura existente dentro de `/core/backend`, `/core/frontend`, `/core/shared`
3. Criar `/core/modules/engine` para o Motor de Módulos
4. Criar diretório `/modules` para futuros módulos

### 7.2 Desenvolvimento do Motor de Módulos
1. Desenvolver sistema de registro de módulos backend
2. Criar mecanismos de carregamento de menus e páginas frontend
3. Implementar controles de ativação baseados em tenant
4. Construir integração automática de roteamento e permissões

### 7.3 Ajuste de Referências Internas
1. Atualizar todas as importações e caminhos para refletir a nova estrutura
2. Corrigir dependências internas
3. Garantir funcionamento adequado com nova raiz em `/core`

## 8. Internacionalização

Criar arquivos de idiomas para português, inglês e espanhol para suportar a internacionalização do sistema modular, seguindo as regras definidas em AI_DEVELOPMENT_RULES.md.

## 9. Resultados Esperados

Após a transformação, o sistema irá:
- Ter um CORE modular contendo apenas componentes essenciais e ir substituíveis
- Suportar carregamento dinâmico de módulos isolados
- Habilitar ativação de módulos específica por tenant
- Manter todas as funcionalidades de segurança e arquitetura existentes
- Estar pronto para geração de módulos sob demanda

## 10. Geração Futura de Módulos

Uma vez que o CORE esteja preparado, o sistema suportará a geração de novos módulos (ex.: "OS", "Financeiro") seguindo a estrutura modular definida.