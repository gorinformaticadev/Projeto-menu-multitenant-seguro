# Tipos de Serviço e Equipamento - Módulo OS

## 📋 Visão Geral

Esta implementação adiciona funcionalidades para gerenciar tipos de serviço e tipos de equipamento no módulo de Ordem de Serviço, permitindo:

- **Tipos de Serviço**: Categorização dos serviços oferecidos (Formatação, Manutenção, Suporte Técnico, etc.)
- **Tipos de Equipamento**: Categorização dos equipamentos atendidos (Desktop, Notebook, Celular, etc.)

## 🗄️ Estrutura do Banco de Dados

### Tabelas Criadas

1. **`mod_ordem_servico_tipos_servico`**
   - Armazena os tipos de serviço disponíveis
   - Tipos padrão não podem ser excluídos (`is_default = true`)
   - Tipos podem ser ativados/desativados (`is_active`)

2. **`mod_ordem_servico_tipos_equipamento`**
   - Armazena os tipos de equipamento disponíveis
   - Todos os tipos podem ser modificados/excluídos
   - Tipos podem ser ativados/desativados (`is_active`)

### Dados Padrão

**Tipos de Serviço (não podem ser excluídos):**
- Formatação
- Manutenção
- Suporte Técnico
- Outros

**Tipos de Equipamento (podem ser modificados/excluídos):**
- Desktop
- Notebook
- Celular
- Tablet
- All-in-One
- Monitor
- Impressora
- Outros

## 🚀 Instalação

### 1. Aplicar Migração do Banco

```bash
# Executar o script de migração
node scripts/apply-service-equipment-types-migration.js
```

### 2. Arquivos Backend Criados

```
module-os/backend/
├── migrations/
│   └── 017_create_service_equipment_types.sql
├── configuracoes/
│   ├── tipos-servico.controller.ts
│   ├── tipos-servico.service.ts
│   ├── tipos-equipamento.controller.ts
│   ├── tipos-equipamento.service.ts
│   └── configuracoes.module.ts (atualizado)
```

### 3. Arquivos Frontend Criados

```
module-os/frontend/
├── components/
│   ├── TiposServicoManager.tsx
│   └── TiposEquipamentoManager.tsx
└── pages/configuracoes/
    └── page.tsx (atualizado)
```

## 🔌 Endpoints da API

### Tipos de Serviço

- `GET /api/ordem_servico/tipos-servico` - Listar tipos
- `GET /api/ordem_servico/tipos-servico/:id` - Buscar por ID
- `POST /api/ordem_servico/tipos-servico` - Criar novo tipo
- `PUT /api/ordem_servico/tipos-servico/:id` - Atualizar tipo
- `DELETE /api/ordem_servico/tipos-servico/:id` - Excluir tipo

### Tipos de Equipamento

- `GET /api/ordem_servico/tipos-equipamento` - Listar tipos
- `GET /api/ordem_servico/tipos-equipamento/:id` - Buscar por ID
- `POST /api/ordem_servico/tipos-equipamento` - Criar novo tipo
- `PUT /api/ordem_servico/tipos-equipamento/:id` - Atualizar tipo
- `DELETE /api/ordem_servico/tipos-equipamento/:id` - Excluir tipo

## 🧪 Testes

### Executar Testes dos Endpoints

```powershell
# Editar o token no arquivo antes de executar
.\test-tipos-servico-equipamento.ps1
```

### Testes Incluídos

- ✅ Listagem de tipos
- ✅ Criação de novos tipos
- ✅ Edição de tipos existentes
- ✅ Tentativa de exclusão de tipos padrão (deve falhar)
- ✅ Exclusão de tipos personalizados

## 🎨 Interface do Usuário

### Localização

A interface está disponível em:
**Configurações → Opções OS**

### Funcionalidades

1. **Gerenciamento de Tipos de Serviço**
   - Visualizar tipos existentes
   - Criar novos tipos personalizados
   - Editar tipos existentes
   - Excluir tipos personalizados
   - Tipos padrão são protegidos contra exclusão

2. **Gerenciamento de Tipos de Equipamento**
   - Visualizar tipos existentes
   - Criar novos tipos
   - Editar tipos existentes
   - Excluir tipos (todos podem ser excluídos)

### Características da Interface

- **Design Responsivo**: Funciona em desktop e mobile
- **Validação em Tempo Real**: Campos obrigatórios e duplicatas
- **Feedback Visual**: Toasts para sucesso/erro
- **Proteção de Dados**: Tipos padrão protegidos
- **Estados de Loading**: Indicadores visuais durante operações

## 🔒 Regras de Negócio

### Tipos de Serviço

1. **Tipos Padrão** (`is_default = true`):
   - Não podem ser excluídos
   - Não podem ser desativados
   - Podem ter nome e descrição editados

2. **Tipos Personalizados** (`is_default = false`):
   - Podem ser editados livremente
   - Podem ser excluídos (se não estiverem em uso)
   - Podem ser ativados/desativados

### Tipos de Equipamento

1. **Todos os tipos**:
   - Podem ser editados
   - Podem ser excluídos (se não estiverem em uso)
   - Podem ser ativados/desativados

### Validações

- **Nome obrigatório** para ambos os tipos
- **Nomes únicos** por tenant
- **Verificação de uso** antes da exclusão
- **Proteção contra exclusão** de tipos em uso

## 🔄 Integração com Ordens de Serviço

Os tipos criados podem ser utilizados:

1. **No formulário de criação de OS**
2. **Na edição de OS existentes**
3. **Em relatórios e filtros**
4. **Em dashboards e estatísticas**

## 📝 Próximos Passos

1. **Integrar com formulário de OS**: Usar os tipos nos dropdowns
2. **Relatórios**: Estatísticas por tipo de serviço/equipamento
3. **Importação/Exportação**: Backup e restore dos tipos
4. **Histórico**: Log de alterações nos tipos
5. **Permissões**: Controle de acesso por perfil de usuário

## 🐛 Troubleshooting

### Erro: "Tabela não existe"
```bash
# Re-executar a migração
node scripts/apply-service-equipment-types-migration.js
```

### Erro: "Token não encontrado"
- Verificar se o usuário está logado
- Verificar configuração de cookies/sessionStorage

### Erro: "Tipo não pode ser excluído"
- Verificar se o tipo está sendo usado em alguma OS
- Tipos padrão nunca podem ser excluídos

## 📞 Suporte

Para dúvidas ou problemas:
1. Verificar logs do backend
2. Verificar console do navegador
3. Executar testes dos endpoints
4. Verificar estrutura do banco de dados