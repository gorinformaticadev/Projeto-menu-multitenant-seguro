# 🔌 Endpoints de Módulos - Documentação Completa

## 📋 Resumo da Implementação

Foi criado um sistema completo de gerenciamento de módulos para o sistema multitenant, permitindo que cada tenant ative/desative módulos específicos conforme suas necessidades.

## 🗄️ Estrutura do Banco de Dados

### Tabela `modules`
```sql
CREATE TABLE "modules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL UNIQUE,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" TEXT, -- JSON com configurações do módulo
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);
```

### Tabela `tenant_modules`
```sql
CREATE TABLE "tenant_modules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "moduleName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" TEXT, -- JSON com configurações específicas do tenant
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tenant_modules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tenant_modules_tenantId_moduleName_key" UNIQUE ("tenantId", "moduleName")
);
```

## 🔌 Endpoints Implementados

### 1. Gerenciamento de Módulos (SUPER_ADMIN)

#### `GET /modules`
- **Descrição**: Lista todos os módulos disponíveis no sistema
- **Permissão**: SUPER_ADMIN, ADMIN
- **Retorno**: Array com nomes dos módulos ativos

```json
["sales", "inventory", "financial", "reports", "crm", "hr"]
```

#### `GET /modules/:name/config`
- **Descrição**: Obter configuração detalhada de um módulo
- **Permissão**: SUPER_ADMIN, ADMIN
- **Parâmetros**: `name` - Nome do módulo
- **Retorno**: Configuração do módulo

```json
{
  "displayName": "Sistema de Vendas",
  "description": "Módulo completo para gestão de vendas, pedidos e clientes",
  "version": "1.0.0",
  "config": {
    "features": ["orders", "customers", "products", "reports"],
    "permissions": ["view_sales", "create_order", "manage_customers"]
  }
}
```

#### `POST /modules`
- **Descrição**: Criar um novo módulo
- **Permissão**: SUPER_ADMIN
- **Body**:

```json
{
  "name": "new_module",
  "displayName": "Novo Módulo",
  "description": "Descrição do módulo",
  "version": "1.0.0",
  "config": {
    "features": ["feature1", "feature2"]
  }
}
```

#### `PUT /modules/:name`
- **Descrição**: Atualizar um módulo existente
- **Permissão**: SUPER_ADMIN
- **Parâmetros**: `name` - Nome do módulo
- **Body**: Campos a serem atualizados

#### `DELETE /modules/:name`
- **Descrição**: Deletar um módulo (apenas se não estiver em uso)
- **Permissão**: SUPER_ADMIN
- **Parâmetros**: `name` - Nome do módulo

### 2. Gerenciamento de Módulos por Tenant

#### `GET /tenants/:id/modules/active`
- **Descrição**: Obter módulos ativos de um tenant específico
- **Permissão**: SUPER_ADMIN
- **Parâmetros**: `id` - ID do tenant
- **Retorno**:

```json
{
  "activeModules": ["sales", "inventory", "reports"],
  "modules": [
    {
      "name": "sales",
      "displayName": "Sistema de Vendas",
      "description": "Módulo completo para gestão de vendas",
      "version": "1.0.0",
      "config": null,
      "activatedAt": "2025-12-12T19:00:00.000Z"
    }
  ]
}
```

#### `GET /tenants/my-tenant/modules/active`
- **Descrição**: Obter módulos ativos do próprio tenant (para ADMIN)
- **Permissão**: ADMIN
- **Retorno**: Mesmo formato do endpoint acima

#### `POST /tenants/:id/modules/:moduleName/activate`
- **Descrição**: Ativar um módulo para um tenant
- **Permissão**: SUPER_ADMIN
- **Parâmetros**: 
  - `id` - ID do tenant
  - `moduleName` - Nome do módulo
- **Retorno**: Dados da relação tenant-módulo criada/atualizada

#### `POST /tenants/:id/modules/:moduleName/deactivate`
- **Descrição**: Desativar um módulo para um tenant
- **Permissão**: SUPER_ADMIN
- **Parâmetros**: 
  - `id` - ID do tenant
  - `moduleName` - Nome do módulo
- **Retorno**: Dados da relação tenant-módulo atualizada

#### `PUT /tenants/:id/modules/:moduleName/config`
- **Descrição**: Configurar um módulo específico para um tenant
- **Permissão**: SUPER_ADMIN
- **Parâmetros**: 
  - `id` - ID do tenant
  - `moduleName` - Nome do módulo
- **Body**: Configurações específicas do módulo para o tenant

```json
{
  "customSettings": {
    "maxOrders": 1000,
    "enableAdvancedReports": true
  }
}
```

## 📦 Módulos Pré-configurados

O sistema vem com 6 módulos pré-configurados:

### 1. Sistema de Vendas (`sales`)
- **Versão**: 1.0.0
- **Descrição**: Módulo completo para gestão de vendas, pedidos e clientes
- **Funcionalidades**: orders, customers, products, reports

### 2. Controle de Estoque (`inventory`)
- **Versão**: 1.2.0
- **Descrição**: Gestão completa de estoque, produtos e movimentações
- **Funcionalidades**: stock_control, product_management, movements

### 3. Módulo Financeiro (`financial`)
- **Versão**: 2.0.0
- **Descrição**: Controle financeiro com contas a pagar, receber e fluxo de caixa
- **Funcionalidades**: accounts_payable, accounts_receivable, cash_flow

### 4. Relatórios Avançados (`reports`)
- **Versão**: 1.5.0
- **Descrição**: Relatórios personalizados e dashboards interativos
- **Funcionalidades**: custom_reports, dashboards, data_export

### 5. CRM - Gestão de Clientes (`crm`)
- **Versão**: 1.1.0
- **Descrição**: Sistema de relacionamento com clientes e gestão de leads
- **Funcionalidades**: lead_management, customer_history, follow_up

### 6. Recursos Humanos (`hr`)
- **Versão**: 1.0.0
- **Descrição**: Gestão de funcionários, folha de pagamento e benefícios
- **Funcionalidades**: employee_management, payroll, benefits

## 🔧 Configuração Automática

### Empresa Padrão
A empresa padrão (GOR Informatica) vem com os seguintes módulos pré-ativados:
- Sistema de Vendas (`sales`)
- Controle de Estoque (`inventory`)
- Relatórios Avançados (`reports`)

### Script de Setup
Execute `node setup-modules.js` para:
- Criar/atualizar todos os módulos no sistema
- Ativar módulos padrão para a empresa principal
- Exibir resumo dos módulos configurados

## 🛡️ Segurança e Permissões

### Controle de Acesso
- **SUPER_ADMIN**: Acesso completo a todos os endpoints
- **ADMIN**: Pode visualizar módulos e configurações do próprio tenant
- **USER/CLIENT**: Sem acesso aos endpoints de módulos

### Validações
- Verificação de existência do tenant e módulo
- Prevenção de duplicação de ativações
- Validação de módulos ativos no sistema
- Controle de dependências (não permite deletar módulos em uso)

## 🧪 Testando os Endpoints

### 1. Listar Módulos Disponíveis
```bash
curl -X GET http://localhost:4000/modules \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. Obter Módulos Ativos de um Tenant
```bash
curl -X GET http://localhost:4000/tenants/TENANT_ID/modules/active \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Ativar Módulo para Tenant
```bash
curl -X POST http://localhost:4000/tenants/TENANT_ID/modules/financial/activate \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Desativar Módulo para Tenant
```bash
curl -X POST http://localhost:4000/tenants/TENANT_ID/modules/financial/deactivate \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📊 Monitoramento e Logs

### Auditoria
Todas as operações de ativação/desativação de módulos são registradas no sistema de auditoria com:
- Ação realizada
- Usuário responsável
- Tenant afetado
- Timestamp da operação

### Métricas
- Módulos mais utilizados por tenant
- Histórico de ativações/desativações
- Performance por módulo

## 🔄 Próximos Passos

### Funcionalidades Futuras
1. **Dependências entre Módulos**: Sistema para definir módulos que dependem de outros
2. **Versionamento**: Controle de versões dos módulos por tenant
3. **Marketplace**: Interface para descobrir e instalar novos módulos
4. **Analytics**: Dashboards de uso dos módulos
5. **Configurações Avançadas**: Interface para configurar módulos via UI

### Melhorias de Performance
1. **Cache**: Cache de módulos ativos por tenant
2. **Lazy Loading**: Carregamento sob demanda dos módulos
3. **CDN**: Distribuição de assets dos módulos via CDN