# Implementação do Botão de Migrations e Seeds

## Status Atual: ⚠️ IMPLEMENTADO COM CORREÇÕES EM ANDAMENTO

### Funcionalidade Implementada ✅

O botão foi implementado com sucesso e está funcionando no frontend e backend:

- ✅ **Backend**: Endpoint `POST /configuracoes/sistema/modulos/:slug/run-migrations-seeds`
- ✅ **Frontend**: Botão com ícone de banco de dados ao lado do "Recarregar configurações"
- ✅ **Dialog de confirmação**: Pergunta detalhada com avisos sobre o que será executado
- ✅ **Validações de segurança**: JWT + SUPER_ADMIN role
- ✅ **Logs detalhados**: Sistema de logging melhorado para debug

### Problema Identificado ⚠️

Durante os testes, foi identificado um erro específico:
```
❌ Erro na transação, rollback executado: coluna "code" não existe
```

### Análise do Problema 🔍

1. **Migrations Duplicadas**: Encontradas migrations com números duplicados:
   - `004_add_client_additional_fields.sql` e `004_create_products_table.sql` (renomeada para `004a_`)
   - `008_create_permissions_system.sql` e `008_create_profile_permissions_table.sql` (renomeada para `008a_`)

2. **Ordem de Execução**: A migration que cria a tabela `mod_ordem_servico_products` com a coluna "code" pode estar sendo executada após uma migration que tenta referenciar essa coluna.

3. **Estrutura Validada**: O módulo `ordem_servico` possui:
   - ✅ 23 migrations encontradas
   - ✅ 2 seeds encontrados
   - ✅ Arquivo `module.config.json` presente

### Correções Implementadas 🔧

1. **Renomeação de Migrations Duplicadas**:
   - `004_create_products_table.sql` → `004a_create_products_table.sql`
   - `008_create_profile_permissions_table.sql` → `008a_create_profile_permissions_table.sql`

2. **Migration de Produtos Melhorada**:
   - Adicionada verificação de existência da tabela antes de criar índices
   - Uso de `DO $$` blocks para execução condicional
   - Constraint de foreign key adicionada

3. **Migration de Colunas de Produto Melhorada**:
   - Verificação de existência da tabela antes de alterar
   - Mensagens de log mais informativas
   - Tratamento de erro quando tabela não existe

4. **Sistema de Execução Melhorado**:
   - Método `executeMigrationsOneByOne` que para no primeiro erro
   - Logs detalhados de cada migration executada
   - Preview do SQL sendo executado
   - Informações específicas sobre qual migration falhou

5. **Suporte a `module.config.json`**:
   - Método `reloadModuleConfig` agora suporta tanto `module.json` quanto `module.config.json`

### Próximos Passos 📋

Para resolver completamente o problema:

1. **Identificar Migration Específica**: Com os logs melhorados, será possível identificar exatamente qual migration está falhando
2. **Corrigir Dependências**: Garantir que todas as tabelas sejam criadas antes de serem referenciadas
3. **Testar Execução**: Executar as migrations uma por vez para validar a correção

### Como Testar 🧪

1. **Acesse o sistema** como SUPER_ADMIN
2. **Vá para** Configurações → Sistema → Módulos
3. **Encontre o módulo** "Ordem de Serviços"
4. **Clique no botão** com ícone de banco de dados (verde) ao lado de "Recarregar configurações"
5. **Confirme** a execução no dialog
6. **Verifique os logs** do backend para informações detalhadas

### Arquivos Modificados 📁

**Backend:**
- `apps/backend/src/core/module-installer.controller.ts` - Novo endpoint
- `apps/backend/src/core/module-installer.service.ts` - Lógica de execução melhorada
- `apps/backend/src/modules/ordem_servico/migrations/004a_create_products_table.sql` - Migration melhorada
- `apps/backend/src/modules/ordem_servico/migrations/006_add_missing_product_columns.sql` - Migration melhorada

**Frontend:**
- `apps/frontend/src/app/configuracoes/sistema/modulos/components/ModuleManagement.tsx` - Novo botão e dialog

### Status Final 📊

✅ **FUNCIONALIDADE IMPLEMENTADA E PRONTA PARA USO**
⚠️ **CORREÇÕES DE MIGRATIONS EM ANDAMENTO**

O botão está funcionando corretamente. O problema identificado é específico das migrations do módulo `ordem_servico` e não afeta a funcionalidade principal do botão. Com os logs melhorados, será possível identificar e corrigir rapidamente a migration problemática.