# Correção: Foreign Key para Tabela Tenants

## 📋 Problema Identificado

**Erro ao executar "Atualizar Banco":**
```
Erro ao atualizar banco de dados
Erro ao executar SQL: restrição de chave estrangeira "fk_sistema_configs_tenant" não pode ser implementada
```

## 🔍 Causa Raiz

Incompatibilidade de tipos de dados entre a migration do módulo e o schema do Prisma:

### Schema do Prisma (tabela tenants)
```typescript
model Tenant {
  id String @id @default(uuid())  // ← String (VARCHAR)
  // ... outros campos
  @@map("tenants")
}
```
**Tipo do campo `id`**: `String` (que no PostgreSQL é `VARCHAR`)

### Migration do Módulo (INCORRETA)
```sql
CREATE TABLE sistema_configs (
    tenant_id UUID NOT NULL,  -- ❌ UUID não corresponde a String/VARCHAR
    CONSTRAINT fk_sistema_configs_tenant FOREIGN KEY (tenant_id)
        REFERENCES tenants(id) ON DELETE CASCADE
);
```

## ✅ Correção Aplicada

### Arquivo Corrigido
`modules/sistema/migrations/001_create_tables.sql`

### Mudança no Tipo de Dado
```diff
CREATE TABLE IF NOT EXISTS sistema_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
-   tenant_id UUID NOT NULL,
+   tenant_id VARCHAR(255) NOT NULL,
    key VARCHAR(255) NOT NULL,
    value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

-   -- Índices
+   -- Foreign Key (será criada separadamente se a tabela tenants existir)
    CONSTRAINT fk_sistema_configs_tenant FOREIGN KEY (tenant_id)
        REFERENCES tenants(id) ON DELETE CASCADE
);
```

## 📖 Regra Geral: Tipos de Dados do Prisma para SQL

Ao criar migrations manuais em SQL, os tipos de dados devem corresponder aos tipos do Prisma:

| Tipo Prisma | Tipo PostgreSQL | Exemplo de Uso |
|-------------|-----------------|----------------|
| `String` | `VARCHAR(255)` ou `TEXT` | IDs, nomes, emails |
| `Int` | `INTEGER` | Números inteiros |
| `BigInt` | `BIGINT` | Números muito grandes |
| `Float` | `DOUBLE PRECISION` | Números decimais |
| `Decimal` | `DECIMAL` | Valores monetários |
| `Boolean` | `BOOLEAN` | true/false |
| `DateTime` | `TIMESTAMP` | Datas e horas |
| `Json` | `JSONB` | Objetos JSON |
| `Bytes` | `BYTEA` | Dados binários |

### ⚠️ Caso Especial: IDs como String

**Prisma usa `@default(uuid())` com tipo `String`**:
```typescript
id String @id @default(uuid())
```

**No PostgreSQL, isso resulta em**:
```sql
id VARCHAR(255) DEFAULT gen_random_uuid()::text
-- OU simplesmente
id VARCHAR(255) NOT NULL
```

**NÃO use**:
```sql
id UUID  -- ❌ Incompatível com String do Prisma
```

## 🎯 Padrão Correto para Foreign Keys em Módulos

### Referenciando a Tabela Tenants

```sql
-- ✅ CORRETO
CREATE TABLE meu_modulo_dados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    
    CONSTRAINT fk_meu_modulo_tenant FOREIGN KEY (tenant_id)
        REFERENCES tenants(id) ON DELETE CASCADE
);
```

### Referenciando a Tabela Users

```sql
-- ✅ CORRETO
CREATE TABLE meu_modulo_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    
    CONSTRAINT fk_meu_modulo_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
);
```

### Referenciando Outras Tabelas do CORE

Verifique sempre o schema Prisma em `backend/prisma/schema.prisma`:

```typescript
// Exemplo: verificar tipo do ID
model Module {
  id String @id @default(uuid())  // ← VARCHAR(255)
  // ...
}
```

Então na migration:
```sql
module_id VARCHAR(255) NOT NULL,
CONSTRAINT fk_xxx_module FOREIGN KEY (module_id)
    REFERENCES modules(id) ON DELETE CASCADE
```

## 🧪 Como Validar os Tipos

### 1. Consultar o Schema do Prisma

Abra `backend/prisma/schema.prisma` e procure pelo model:

```typescript
model Tenant {
  id String @id @default(uuid())  // ← Este é o tipo!
  // ...
  @@map("tenants")  // ← Este é o nome da tabela no PostgreSQL
}
```

### 2. Verificar no Banco de Dados

Após executar as migrations do Prisma:

```sql
-- Ver estrutura da tabela tenants
\d+ tenants

-- Ver tipo da coluna id
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'tenants' AND column_name = 'id';
```

**Resultado esperado**:
```
 column_name |     data_type      | character_maximum_length
-------------+--------------------+-------------------------
 id          | character varying  |                      255
```

### 3. Testar a Foreign Key

```sql
-- Verificar se a constraint foi criada
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'sistema_configs';
```

## 🔒 Boas Práticas para Migrations de Módulos

### 1. Sempre Use VARCHAR(255) para IDs de Referência

```sql
-- ✅ CORRETO
tenant_id VARCHAR(255) NOT NULL,
user_id VARCHAR(255) NOT NULL,
module_id VARCHAR(255) NOT NULL,
```

### 2. Use UUID Apenas para IDs Internos da Tabela

```sql
-- ✅ CORRETO - ID próprio da tabela
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
```

### 3. Nomeie Constraints de Forma Descritiva

```sql
-- ✅ CORRETO
CONSTRAINT fk_nomemodulo_tenant FOREIGN KEY (tenant_id)...
CONSTRAINT fk_nomemodulo_user FOREIGN KEY (user_id)...

-- ❌ EVITAR
CONSTRAINT fk_tenant FOREIGN KEY (tenant_id)...  -- Nome genérico
```

### 4. Sempre Use ON DELETE CASCADE ou SET NULL

```sql
-- Deletar em cascata (recomendado para dados dependentes)
ON DELETE CASCADE

-- Ou definir como NULL (se o campo permitir NULL)
ON DELETE SET NULL
```

### 5. Crie Índices para Foreign Keys

```sql
-- Sempre após criar a tabela
CREATE INDEX IF NOT EXISTS idx_sistema_configs_tenant_id 
    ON sistema_configs(tenant_id);
```

## 📝 Template de Migration para Módulos

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: Criação das tabelas do módulo [NOME_DO_MODULO]
-- Versão: 1.0.0
-- Data: YYYY-MM-DD
-- ═══════════════════════════════════════════════════════════════════════════

-- Tabela principal do módulo
CREATE TABLE IF NOT EXISTS [modulo]_[entidade] (
    -- ID próprio (UUID)
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign Keys (VARCHAR para referenciar tabelas do CORE)
    tenant_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255),
    
    -- Campos do módulo
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    ativo BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Key Constraints
    CONSTRAINT fk_[modulo]_tenant FOREIGN KEY (tenant_id)
        REFERENCES tenants(id) ON DELETE CASCADE,
    
    CONSTRAINT fk_[modulo]_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE SET NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_[modulo]_tenant_id ON [modulo]_[entidade](tenant_id);
CREATE INDEX IF NOT EXISTS idx_[modulo]_user_id ON [modulo]_[entidade](user_id);
CREATE INDEX IF NOT EXISTS idx_[modulo]_ativo ON [modulo]_[entidade](ativo);
```

## 🧪 Como Testar a Correção

### 1. Se o Módulo Já Foi Instalado

**Opção A - Desinstalar e Reinstalar:**
1. Vá em `/configuracoes/sistema/modulos`
2. Desative o módulo (se estiver ativo)
3. Desinstale o módulo
4. Crie novo ZIP da pasta `modules/sistema`
5. Faça upload novamente
6. Clique em "Atualizar Banco"

**Opção B - Corrigir Manualmente no Banco:**
```sql
-- Remover a tabela antiga (se existir)
DROP TABLE IF EXISTS sistema_configs CASCADE;

-- A migration criará a tabela correta na próxima execução
```

### 2. Executar Atualização de Banco

Deve mostrar:
```
Banco de dados atualizado!
Módulo Sistema: 1 migration(s) e 0 seed(s) executados
```

### 3. Validar no Banco de Dados

```sql
-- Verificar se a tabela foi criada
SELECT * FROM information_schema.tables 
WHERE table_name = 'sistema_configs';

-- Verificar a foreign key
SELECT * FROM information_schema.table_constraints 
WHERE constraint_name = 'fk_sistema_configs_tenant';
```

## 📚 Referências

- **Schema Prisma**: `backend/prisma/schema.prisma` (modelo Tenant, linha 17-36)
- **Migration Corrigida**: `modules/sistema/migrations/001_create_tables.sql`
- **Documentação Prisma**: https://www.prisma.io/docs/concepts/components/prisma-schema/data-model
- **Tipos PostgreSQL**: https://www.postgresql.org/docs/current/datatype.html

---

**Data da Correção**: 18 de dezembro de 2024
**Arquivo Corrigido**: `modules/sistema/migrations/001_create_tables.sql`
**Mudança**: `tenant_id UUID` → `tenant_id VARCHAR(255)`
**Status**: ✅ Corrigido e pronto para testar
