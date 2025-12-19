# Módulo Sistema

## Visão Geral

O Módulo Sistema é um módulo de exemplo que demonstra a estrutura e funcionalidades básicas de um módulo no sistema multitenant seguro. Ele inclui componentes de frontend e backend, permissões, menus, rotas e estrutura de banco de dados.

## Estrutura de Arquivos

```
sistema/
├── backend/                 # Componentes do lado do servidor
│   ├── controllers/         # Controladores NestJS
│   ├── services/           # Serviços com lógica de negócio
│   ├── routes.ts           # Registro de rotas do backend
├── frontend/                # Componentes do lado do cliente
│   ├── components/          # Componentes React reutilizáveis
│   ├── pages/               # Páginas React acessíveis via rotas
│   ├── menu.ts             # Definição do menu lateral
│   ├── routes.tsx          # Definição de rotas do frontend
├── migrations/              # Scripts de migração do banco de dados
├── seeds/                   # Scripts de dados iniciais
├── module.json             # Metadados do módulo
├── module.ts               # Contrato principal do módulo
├── permissions.ts          # Definição de permissões
└── README.md              # Documentação do módulo
```

## Descrição dos Arquivos Principais

### `module.json`
Arquivo de manifesto que contém os metadados básicos do módulo:
- Nome e descrição
- Versão
- Autor
- Configurações padrão

### `module.ts`
Contrato principal do módulo que define como ele se integra com o Core do sistema:
- Função de registro que é chamada durante a inicialização
- Registro de permissões e menus
- Integração com eventos do sistema

### `permissions.ts`
Define as permissões específicas deste módulo que serão registradas no sistema ACL:
- Visualizar Sistema
- Criar Configurações
- Editar Sistema
- Excluir Sistema
- Administrar Sistema

### `frontend/menu.ts`
Define a estrutura de navegação que será injetada na barra lateral do sistema:
- Item principal "Suporte" com sub-itens
- Dashboard do Sistema
- Notificações
- Ajustes

### `frontend/routes.tsx`
Mapeia rotas HTTP para componentes React (páginas):
- `/modules/sistema/dashboard` - Dashboard do Sistema
- `/modules/sistema/notificacao` - Página de Notificações
- `/modules/sistema/ajustes` - Página de Ajustes

### `frontend/pages/`
Contém as páginas React acessíveis via rotas:
- `dashboard.tsx` - Página principal do módulo
- `notificacao.tsx` - Página de notificações
- `ajustes.tsx` - Página de configurações

### `frontend/components/SistemaDashboard.tsx`
Componente React reutilizável que exibe o conteúdo principal do dashboard do módulo.

### `backend/routes.ts`
Exporta os controladores que devem ser registrados pelo NestJS para tratar requisições HTTP.

### `backend/controllers/sistema.controller.ts`
Controlador NestJS que define endpoints da API REST para o módulo:
- `GET /api/sistema` - Lista recursos
- `GET /api/sistema/stats` - Obtém estatísticas

### `backend/services/sistema.service.ts`
Serviço que contém a lógica de negócio do módulo, chamado pelos controladores.

### `migrations/001_create_tables.sql`
Script de migração que cria as tabelas necessárias no banco de dados:
- `sistema_configs` - Tabela de configurações por tenant

### `seeds/seed.sql`
Script que insere dados iniciais nas tabelas do módulo:
- Configurações básicas para tenants ativos

## Funcionamento

1. Durante a inicialização do sistema, o Core carrega o módulo através do arquivo `module.ts`
2. As permissões definidas em `permissions.ts` são registradas no sistema ACL
3. O menu definido em `frontend/menu.ts` é injetado na barra lateral
4. As rotas em `frontend/routes.tsx` tornam as páginas acessíveis
5. Os controladores em `backend/controllers/` tratam requisições da API
6. O serviço em `backend/services/` contém a lógica de negócio

## Permissões

O módulo define as seguintes permissões:
- `sistema.view` - Visualizar o módulo (disponível para ADMIN, USER e GUEST)
- `sistema.create` - Criar configurações (somente ADMIN)
- `sistema.edit` - Editar configurações (somente ADMIN)
- `sistema.delete` - Excluir configurações (somente ADMIN)
- `sistema.admin` - Administrar o módulo (somente ADMIN)