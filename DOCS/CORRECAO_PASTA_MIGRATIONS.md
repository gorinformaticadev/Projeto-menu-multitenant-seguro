# Correção: Nome da Pasta de Migrations

## 📋 Problema Identificado

**Erro ao clicar em "Atualizar Banco":**
```
Erro ao atualizar banco de dados
Erro ao executar SQL: relação "sistema_configs" não existe
```

## 🔍 Causa Raiz

A pasta de migrations do módulo estava com o nome **incorreto**:

- ❌ **Pasta do módulo**: `modules/sistema/migrates/`
- ✅ **Esperado pelo código**: `modules/sistema/migrations/`

O código do `ModuleInstallerService` busca especificamente pela pasta `migrations` (linha 580):

```typescript
const migrationsPath = path.join(modulePath, type === MigrationType.migration ? 'migrations' : 'seeds');
```

Como a pasta não existia com o nome correto, o sistema retornava `0` migrations executadas, mas não criava as tabelas necessárias.

## ✅ Correção Aplicada

### Ação Executada
```powershell
Rename-Item -Path "modules\sistema\migrates" -NewName "migrations"
```

### Estrutura Correta do Módulo

```
modules/sistema/
├── backend/
├── frontend/
├── migrations/          ✅ Nome correto
│   └── 001_create_tables.sql
├── seeds/              ✅ Nome correto
│   └── 001_initial_data.sql
├── index.ts
├── module.config.json
├── module.json
├── module.ts
└── permissions.ts
```

## 📖 Convenção de Nomenclatura

Conforme especificado no sistema, os módulos devem seguir esta estrutura:

### Pastas Obrigatórias (se aplicável)

| Pasta | Propósito | Quando Usar |
|-------|-----------|-------------|
| **`migrations/`** | Scripts SQL de criação/alteração de estrutura | Quando o módulo precisa criar tabelas |
| **`seeds/`** | Scripts SQL de carga inicial de dados | Quando o módulo precisa dados iniciais |
| `backend/` | Código TypeScript/JavaScript do backend | Módulos com lógica de servidor |
| `frontend/` | Componentes React do frontend | Módulos com interface |

### ⚠️ Nomes INCORRETOS Comuns

❌ `migrates/` → ✅ `migrations/`
❌ `migration/` → ✅ `migrations/` (plural)
❌ `seed/` → ✅ `seeds/` (plural)
❌ `sql/` → ✅ `migrations/` ou `seeds/`

## 🎯 Ordem de Execução

Quando você clica em "Atualizar Banco", o sistema executa:

### 1. Migrations (pasta `migrations/`)
```typescript
const migrationsPath = path.join(modulePath, 'migrations');
```
- Arquivos `.sql` em ordem alfabética
- Exemplo: `001_create_tables.sql`, `002_add_columns.sql`
- Registra cada execução em `ModuleMigration` com `type = 'migration'`

### 2. Seeds (pasta `seeds/`)
```typescript
const seedsPath = path.join(modulePath, 'seeds');
```
- Arquivos `.sql` em ordem alfabética
- Exemplo: `001_initial_data.sql`, `002_sample_configs.sql`
- Registra cada execução em `ModuleMigration` com `type = 'seed'`

## 🧪 Validação

### Como Verificar se Está Correto

1. Abra o explorador de arquivos
2. Navegue até `modules/sistema/`
3. Confirme que existem as pastas:
   - ✅ `migrations/` (com arquivo `001_create_tables.sql`)
   - ✅ `seeds/` (se houver dados iniciais)

### Teste de Funcionamento

1. Se o módulo já foi instalado, desinstale-o primeiro
2. Faça novo upload do ZIP do módulo
3. Clique em "Atualizar Banco"
4. Deve executar com sucesso e mostrar:
   ```
   Banco de dados atualizado!
   Módulo Sistema: 1 migration(s) e 0 seed(s) executados
   ```
5. Verifique no banco de dados:
   ```sql
   SELECT * FROM information_schema.tables 
   WHERE table_name = 'sistema_configs';
   ```

## 📝 Checklist de Estrutura de Módulo

Ao criar um módulo, garanta que:

- [ ] Pasta `migrations/` existe (se houver SQL de estrutura)
- [ ] Pasta `seeds/` existe (se houver SQL de dados)
- [ ] Arquivos SQL estão com prefixo numérico (ex: `001_`, `002_`)
- [ ] Arquivos SQL terminam com `.sql`
- [ ] Arquivo `module.json` está na raiz do módulo
- [ ] Campo `dependencies` no `module.json` é `null` ou array de strings

## 🔒 Como o Sistema Valida

O método `executeMigrations` (linha 579-637):

1. ✅ Constrói o caminho: `modules/{slug}/migrations` ou `modules/{slug}/seeds`
2. ✅ Verifica se o diretório existe: `fs.existsSync(migrationsPath)`
3. ✅ Se não existir, retorna `0` (nenhuma migration executada)
4. ✅ Lista arquivos `.sql` e ordena alfabeticamente
5. ✅ Para cada arquivo:
   - Verifica se já foi executado (consulta `ModuleMigration`)
   - Se não foi, executa em transação
   - Registra execução no banco

## 📚 Exemplo de Migration Válida

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: Criação das tabelas do módulo sistema
-- Versão: 1.0.0
-- Data: 2025-12-17
-- ═══════════════════════════════════════════════════════════════════════════

-- Tabela de configurações do sistema
CREATE TABLE IF NOT EXISTS sistema_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    key VARCHAR(255) NOT NULL,
    value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Índices
    CONSTRAINT fk_sistema_configs_tenant FOREIGN KEY (tenant_id)
        REFERENCES tenants(id) ON DELETE CASCADE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_sistema_configs_tenant_id ON sistema_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sistema_configs_key ON sistema_configs(key);
```

## 📚 Referências

- **Service**: `backend/src/core/module-installer.service.ts` (linha 579-637)
- **Método**: `executeMigrations(slug, modulePath, type)`
- **Enum**: `MigrationType.migration` e `MigrationType.seed`
- **Documentação**: `DOCS/IMPLEMENTACAO_CICLO_VIDA_MODULOS.md`

---

**Data da Correção**: 18 de dezembro de 2024
**Módulo Corrigido**: `modules/sistema/`
**Ação**: Renomeado `migrates/` → `migrations/`
**Status**: ✅ Corrigido e pronto para testar
