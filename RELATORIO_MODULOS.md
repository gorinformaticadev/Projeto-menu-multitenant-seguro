# Relatório Completo do Sistema de Módulos

## 1. Estrutura Geral do Sistema de Módulos

O sistema de módulos é uma arquitetura modular robusta e segura que permite a extensão do sistema principal com funcionalidades independentes. Ele segue princípios de segurança rigorosos onde nenhum código de módulo é executado durante a instalação, garantindo que o sistema permaneça estável e seguro.

### Características Principais:
- **Isolamento Total**: Cada módulo é completamente autônomo e não interfere no core do sistema
- **Ciclo de Vida Controlado**: Processo estrito de instalação, ativação, desativação e desinstalação
- **Segurança por Design**: Princípio de "opt-in" onde módulos são desabilitados por padrão para novos tenants
- **Gerenciamento de Dependências**: Sistema de dependências entre módulos com validações rigorosas
- **Persistência Controlada**: Sistema de migrações e seeds com rastreamento granular

### Componentes Principais:
1. **Core do Sistema**: Responsável pelo carregamento e gerenciamento seguro dos módulos
2. **Registry**: Sistema centralizado de registro e descoberta de módulos
3. **Frontend Engine**: Motor de renderização dinâmica de componentes de módulos
4. **Backend Services**: Serviços de instalação, ativação e persistência de módulos
5. **Banco de Dados**: Tabelas dedicadas para gerenciamento de módulos, tenants e migrações

## 2. Arquivos Principais Relacionados aos Módulos

### Backend (NestJS)

#### Contratos e Tipos
- `backend/src/core/contracts/ModuleContract.ts` - Contrato obrigatório para todos os módulos
- `backend/src/core/shared/types/module.types.ts` - Tipos compartilhados para módulos

#### Serviços Principais
- `backend/src/core/ModuleLoader.ts` - Loader seguro de módulos
- `backend/src/core/module-installer.service.ts` - Serviço de instalação, ativação, desativação e desinstalação
- `backend/src/core/module-installer.controller.ts` - Controlador de endpoints para gerenciamento de módulos
- `backend/src/core/services/module-database-executor.service.ts` - Executor seguro de SQL para módulos

#### Validação
- `backend/src/core/validators/module-json.validator.ts` - Validador de module.json
- `backend/src/core/validators/module-structure.validator.ts` - Validador de estrutura de ZIP de módulos

### Frontend (Next.js)

#### Registry e Renderização
- `frontend/src/lib/module-registry.ts` - Registry de módulos no frontend
- `frontend/src/lib/modules-registry.ts` - Registro automático de rotas de módulos
- `frontend/src/modules/registry.ts` - Registry de componentes de módulos
- `frontend/src/app/modules/[...slug]/page.tsx` - Página dinâmica para renderização de módulos
- `frontend/src/app/modules/[module]/[...slug]/page.tsx` - Página dinâmica com suporte a parâmetros

#### Interface de Gerenciamento
- `frontend/src/app/(authenticated)/settings/modules/page.tsx` - Interface de gerenciamento de módulos
- `frontend/src/core/ModulesTab.tsx` - Componente de gerenciamento de módulos por tenant

### Estrutura de Módulos

#### Exemplo de Módulo
- `modules/sistema/module.ts` - Manifesto do módulo sistema
- `modules/sistema/frontend/routes.tsx` - Rotas do frontend do módulo sistema
- `modules/sistema/permissions.ts` - Permissões do módulo sistema
- `modules/sistema/frontend/menu.ts` - Menu do módulo sistema

### Banco de Dados (Prisma)
- `backend/prisma/schema.prisma` - Schema com tabelas de módulos:
  - `Module` - Tabela principal de módulos
  - `ModuleMenu` - Menus dos módulos
  - `ModuleTenant` - Associação de módulos com tenants
  - `ModuleMigration` - Registro de migrações executadas

## 3. Ciclo de Vida dos Módulos

O ciclo de vida dos módulos segue um processo estrito de cinco etapas para garantir segurança e controle:

### Etapas do Ciclo de Vida

#### 1. Instalação (ZIP → installed)
- Upload de arquivo ZIP via interface
- Validação de estrutura e conteúdo do módulo
- Extração segura dos arquivos
- Registro inicial no banco de dados com status `installed`
- Nenhum código é executado nesta fase

#### 2. Preparação do Banco (installed → db_ready)
- Execução explícita de migrações e seeds
- Criação de tabelas e dados iniciais
- Validação de scripts SQL
- Atualização de status para `db_ready`

#### 3. Ativação (db_ready → active)
- Validação de dependências
- Registro de rotas, menus e permissões
- Inicialização de serviços do módulo
- Módulo fica operacional no sistema

#### 4. Desativação (active → disabled)
- Validação de dependências inversas
- Desligamento de serviços
- Remoção de rotas e menus
- Módulo permanece instalado mas inoperante

#### 5. Desinstalação (disabled/installed → REMOVED)
- Validação de uso por tenants
- Remoção de registros do CORE
- Opções de preservação de dados
- Remoção completa dos arquivos

### Estados dos Módulos

| Estado | Descrição | Banco de Dados | Rotas/Menus | Pode Ativar |
|--------|-----------|----------------|-------------|-------------|
| `detected` | ZIP enviado, validação pendente | Não | Não | Não |
| `installed` | Arquivos extraídos, registrado | Não | Não | Não |
| `db_ready` | Migrações/seeds executados | Sim | Não | Sim |
| `active` | Módulo em operação | Sim | Sim | N/A |
| `disabled` | Desligado temporariamente | Sim | Não | Sim |

## 4. Regras de Validação e Segurança

### Validações de Instalação
- Arquivo deve ser .zip com tamanho máximo de 50MB
- Estrutura do ZIP deve conter module.json na raiz
- Nome do módulo deve ser único e seguir padrões seguros
- Campos obrigatórios no module.json: slug, name, version
- Nenhum código é executado durante a instalação

### Validações de Ativação
- Módulo deve estar com status `db_ready`
- Todas as dependências declaradas devem estar ativas
- Apenas SUPER_ADMIN pode ativar módulos
- Validação de integridade dos arquivos

### Validações de Desativação
- Verificação de dependências inversas
- Módulos que dependem deste devem ser desativados primeiro
- Registro de tentativa de desativação
- Preservação de dados e configurações

### Validações de Desinstalação
- Status deve ser `disabled` ou `installed`
- Nenhum tenant pode ter o módulo habilitado
- Nenhum módulo ativo pode depender deste
- Confirmação dupla com nome exato do módulo
- Opções de preservação de dados

### Medidas de Segurança
- **Princípio do Menor Privilégio**: Módulos têm acesso mínimo necessário
- **Isolamento de Contexto**: Código de módulos é executado em contexto controlado
- **Validação de Entrada**: Todos os dados são rigorosamente validados
- **Auditoria Completa**: Todas as ações são registradas
- **Proteção contra Zip Slip**: Extração segura de arquivos ZIP

## 5. Sistema de Migrações e Seeds

### Estrutura de Migrações
- Arquivos SQL armazenados em `migrations/` dentro do módulo
- Nomeação sequencial (ex: 001_create_table.sql, 002_add_column.sql)
- Executados em ordem alfabética
- Registro de execução na tabela `module_migrations`

### Sistema de Seeds
- Arquivos SQL armazenados em `seeds/` dentro do módulo
- Dados iniciais para funcionamento do módulo
- Podem incluir dados de configuração e exemplos
- Executados após migrações durante preparação do banco

### Controle de Execução
- Cada migração/seed é registrada com timestamp
- Evita execução duplicada de scripts
- Permite auditoria de alterações no banco
- Suporte a rollback parcial via scripts customizados

### Tipos de Migração
- `migration`: Alterações estruturais no banco de dados
- `seed`: Inserção de dados iniciais e de configuração

## 6. Renderização de Componentes

### Sistema de Registry
- Registro automático de componentes via scripts
- Descoberta dinâmica de páginas e rotas
- Lazy loading de componentes para performance
- Isolamento de namespaces entre módulos

### Rotas Dinâmicas
- Sistema de roteamento baseado em padrões
- Suporte a parâmetros nas URLs
- Renderização condicional baseada em permissões
- Integração nativa com Next.js App Router

### Componentes de Interface
- Carregamento sob demanda de páginas
- Componentes reutilizáveis entre módulos
- Sistema de menus dinâmicos
- Widgets para dashboard e áreas específicas

### Renderização Segura
- Validação de permissões antes da renderização
- Fallback para páginas de erro 404
- Proteção contra componentes maliciosos
- Isolamento de contexto de execução

## 7. Atualização de Módulos

### Processo de Atualização
1. **Desativação** do módulo atual
2. **Backup** dos dados e configurações
3. **Instalação** da nova versão (substitui arquivos)
4. **Preparação do Banco** com novas migrações
5. **Reativação** do módulo atualizado

### Controle de Versão
- Versionamento semântico (X.Y.Z)
- Registro de versão na tabela `modules`
- Histórico de atualizações
- Compatibilidade com versões anteriores quando possível

### Migrações de Atualização
- Scripts específicos para atualização entre versões
- Upgrade paths definidos
- Rollback em caso de falha
- Validação de compatibilidade

### Notificações de Atualização
- Alertas sobre atualizações disponíveis
- Registro de changelog
- Notificações de sucesso/erro
- Auditoria completa do processo

## Conclusão

O sistema de módulos implementado é uma solução robusta e segura que permite a extensão controlada do sistema principal. Com validações rigorosas, ciclo de vida bem definido e medidas de segurança avançadas, ele garante que novas funcionalidades possam ser adicionadas sem comprometer a estabilidade e segurança do sistema existente.