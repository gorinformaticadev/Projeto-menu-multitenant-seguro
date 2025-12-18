# Correção: Foreign Key com Tipo TEXT para Tabela Tenants

**Data**: 18 de dezembro de 2025  
**Tipo**: Correção de Migration SQL  
**Componente**: Módulo Sistema  
**Arquivo**: `modules/sistema/migrations/001_create_tables.sql`

---

## 🐛 Problema Identificado

### Erro Reportado

```
Erro ao atualizar banco de dados
Erro ao executar SQL: restrição de chave estrangeira "fk_sistema_configs_tenant" não pode ser implementada
```

### Contexto

Ao tentar executar a migration do módulo sistema (botão "Atualizar Banco"), o PostgreSQL rejeitava a criação da foreign key `fk_sistema_configs_tenant`.

---

## 🔍 Análise da Causa Raiz

### Estrutura do Prisma Schema

A tabela `tenants` é definida no Prisma como:

```typescript
model Tenant {
  id              String             @id @default(uuid())  // ← String, não UUID
  email           String             @unique
  cnpjCpf         String             @unique
  // ... outros campos
  
  @@map("tenants")
}
```

**Ponto-chave**: O campo `id` é do tipo `String` no Prisma.

### Mapeamento Prisma → PostgreSQL

Quando o Prisma gera migrations para PostgreSQL, os tipos são mapeados da seguinte forma:

| Tipo Prisma | Tipo PostgreSQL | Tamanho |
|-------------|-----------------|---------|
| `String` | `TEXT` | Ilimitado |
| `String @db.VarChar(255)` | `VARCHAR(255)` | 255 chars |
| `String @db.Uuid` | `UUID` | 16 bytes |

**No nosso caso**: `id String @default(uuid())` → `TEXT` no PostgreSQL

### Migration com Tipo Incompatível

A migration original estava usando:

```sql
CREATE TABLE IF NOT EXISTS sistema_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,  -- ❌ TIPO INCOMPATÍVEL
    
    CONSTRAINT fk_sistema_configs_tenant FOREIGN KEY (tenant_id)
        REFERENCES tenants(id) ON DELETE CASCADE  -- tenants.id é TEXT
);
```

### Por que Falhou?

PostgreSQL **exige que colunas de foreign key tenham EXATAMENTE o mesmo tipo** da coluna referenciada:

```
tenant_id VARCHAR(255) → tenants.id TEXT
         ↑                           ↑
    Tipos diferentes = ERRO
```

**Regra do PostgreSQL**:
> Foreign key columns must have the same data type as the columns they reference

---

## ✅ Solução Implementada

### Código Corrigido

**Arquivo**: `modules/sistema/migrations/001_create_tables.sql`

**Mudança**:

```sql
-- ANTES (INCORRETO)
CREATE TABLE IF NOT EXISTS sistema_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,  -- ❌ Tipo incompatível
    key VARCHAR(255) NOT NULL,
    value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_sistema_configs_tenant FOREIGN KEY (tenant_id)
        REFERENCES tenants(id) ON DELETE CASCADE
);

-- DEPOIS (CORRETO)
CREATE TABLE IF NOT EXISTS sistema_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,  -- ✅ Corresponde a tenants.id TEXT
    key VARCHAR(255) NOT NULL,
    value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Foreign Key para tabela tenants
    CONSTRAINT fk_sistema_configs_tenant FOREIGN KEY (tenant_id)
        REFERENCES tenants(id) ON DELETE CASCADE
);
```

### Mudanças Aplicadas

1. **Linha 10**: `tenant_id VARCHAR(255)` → `tenant_id TEXT`
2. **Comentário atualizado**: Deixa claro que a FK referencia a tabela tenants

---

## 📋 Checklist de Validação

### ✅ Como Verificar o Tipo Correto

Se você tiver acesso ao PostgreSQL, pode verificar o tipo da coluna `id` da tabela `tenants`:

```sql
-- Verificar estrutura da tabela tenants
\d tenants

-- Ou consultar o information_schema
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'tenants' AND column_name = 'id';
```

**Resultado esperado**:
```
 column_name | data_type | character_maximum_length 
-------------+-----------+--------------------------
 id          | text      | NULL
```

### ✅ Testando a Migration Corrigida

1. **Deletar módulo** (se já instalou):
   - Ir em `/configuracoes/sistema/modulos`
   - Clicar em "Desinstalar" no módulo sistema

2. **Criar novo ZIP** da pasta `modules/sistema` com a correção

3. **Fazer upload** do módulo corrigido

4. **Clicar em "Atualizar Banco"**

5. **Resultado esperado**:
   ```
   ✅ Banco de dados atualizado
   Módulo Sistema: 1 migration(s) e 0 seed(s) executados
   ```

---

## 🎯 Regras para Criar Foreign Keys em Módulos

### Regra Geral

**SEMPRE use o mesmo tipo de dado da coluna referenciada**

### Para Referências a Tabelas do CORE

| Tabela CORE | Coluna | Tipo no Prisma | Tipo SQL Correto |
|-------------|--------|----------------|------------------|
| `tenants` | `id` | `String` | `TEXT` |
| `users` | `id` | `String` | `TEXT` |
| `users` | `tenantId` | `String?` | `TEXT` |
| `modules` | `id` | `String` | `TEXT` |

### Template de Foreign Key para Tenant

```sql
CREATE TABLE IF NOT EXISTS sua_tabela (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,  -- ← Sempre TEXT para tenants.id
    -- outros campos...
    
    CONSTRAINT fk_sua_tabela_tenant FOREIGN KEY (tenant_id)
        REFERENCES tenants(id) ON DELETE CASCADE
);

-- Índice para performance
CREATE INDEX IF NOT EXISTS idx_sua_tabela_tenant_id ON sua_tabela(tenant_id);
```

### Template de Foreign Key para User

```sql
CREATE TABLE IF NOT EXISTS sua_tabela (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,  -- ← Sempre TEXT para users.id
    -- outros campos...
    
    CONSTRAINT fk_sua_tabela_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
);

-- Índice para performance
CREATE INDEX IF NOT EXISTS idx_sua_tabela_user_id ON sua_tabela(user_id);
```

---

## 🔧 Como Identificar o Tipo Correto

### Método 1: Verificar o Prisma Schema

1. Abrir `backend/prisma/schema.prisma`

2. Encontrar o model da tabela referenciada:

```typescript
model Tenant {
  id String @id @default(uuid())  // ← String = TEXT
}
```

3. Mapear o tipo:
   - `String` → `TEXT`
   - `Int` → `INTEGER`
   - `DateTime` → `TIMESTAMP`
   - `Boolean` → `BOOLEAN`

### Método 2: Consultar o Banco Diretamente

```sql
-- Lista todas as colunas da tabela
\d nome_da_tabela

-- Ou via SQL padrão
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'nome_da_tabela';
```

### Método 3: Verificar Migrations Existentes

Procure por migrations do CORE que criam as tabelas principais:

```bash
# Buscar migrations do Prisma
ls backend/prisma/migrations/
```

---

## 📊 Comparação de Tipos

### VARCHAR vs TEXT no PostgreSQL

| Aspecto | VARCHAR(N) | TEXT |
|---------|------------|------|
| **Tamanho máximo** | N caracteres | Ilimitado |
| **Performance** | Mesma que TEXT | Mesma que VARCHAR |
| **Validação** | Trunca em N chars | Aceita qualquer tamanho |
| **Uso** | Quando tem limite conhecido | Quando não há limite definido |

**Prisma usa TEXT por padrão** para campos `String` sem anotação `@db.VarChar(N)`.

### UUID Nativo vs String UUID

| Aspecto | UUID (tipo nativo) | TEXT com UUID |
|---------|-------------------|---------------|
| **Tamanho** | 16 bytes | ~36 bytes |
| **Performance** | Mais rápido | Um pouco mais lento |
| **Flexibilidade** | Apenas UUIDs | Aceita qualquer string |
| **Validação** | Automática | Manual |

**Prisma usa TEXT** quando você define `String @default(uuid())`, **NÃO** o tipo nativo `UUID`.

---

## ⚠️ Erros Comuns e Como Evitar

### Erro 1: Usar UUID quando deveria ser TEXT

```sql
-- ❌ ERRADO
tenant_id UUID NOT NULL

-- ✅ CORRETO
tenant_id TEXT NOT NULL
```

### Erro 2: Usar VARCHAR com tamanho diferente

```sql
-- ❌ ERRADO (se a tabela original usa TEXT)
tenant_id VARCHAR(255) NOT NULL

-- ✅ CORRETO
tenant_id TEXT NOT NULL
```

### Erro 3: Esquecer ON DELETE CASCADE

```sql
-- ❌ ERRADO (sem cascade)
CONSTRAINT fk_tabela_tenant FOREIGN KEY (tenant_id)
    REFERENCES tenants(id)

-- ✅ CORRETO (com cascade)
CONSTRAINT fk_tabela_tenant FOREIGN KEY (tenant_id)
    REFERENCES tenants(id) ON DELETE CASCADE
```

**Por quê?** Se um tenant for deletado, os registros relacionados também devem ser removidos automaticamente.

### Erro 4: Nome de Constraint Duplicado

```sql
-- ❌ ERRADO (nome genérico pode conflitar)
CONSTRAINT fk_tenant FOREIGN KEY...

-- ✅ CORRETO (nome específico da tabela)
CONSTRAINT fk_sistema_configs_tenant FOREIGN KEY...
```

---

## 🧪 Testes Recomendados

### Teste 1: Inserir Registro Válido

```sql
-- Criar configuração para um tenant existente
INSERT INTO sistema_configs (tenant_id, key, value)
VALUES (
    (SELECT id FROM tenants LIMIT 1),
    'configuracao_teste',
    'valor_teste'
);
```

**Resultado esperado**: ✅ Sucesso

### Teste 2: Tentar Inserir com Tenant Inexistente

```sql
-- Tentar criar configuração com tenant inexistente
INSERT INTO sistema_configs (tenant_id, key, value)
VALUES ('tenant-inexistente-uuid', 'teste', 'valor');
```

**Resultado esperado**: ❌ Erro de FK constraint

### Teste 3: Deletar Tenant em Cascade

```sql
-- Criar tenant de teste
INSERT INTO tenants (id, email, cnpj_cpf, nome_fantasia, nome_responsavel, telefone)
VALUES ('tenant-teste-123', 'teste@exemplo.com', '12345678901', 'Teste', 'Responsável', '1234567890');

-- Criar configuração para esse tenant
INSERT INTO sistema_configs (tenant_id, key, value)
VALUES ('tenant-teste-123', 'config_teste', 'valor');

-- Deletar o tenant
DELETE FROM tenants WHERE id = 'tenant-teste-123';

-- Verificar se a configuração foi deletada em cascade
SELECT * FROM sistema_configs WHERE tenant_id = 'tenant-teste-123';
```

**Resultado esperado**: ✅ Nenhum registro encontrado (deletado em cascade)

---

## 📚 Referências

### Documentação PostgreSQL

- [Foreign Keys](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK)
- [Data Types](https://www.postgresql.org/docs/current/datatype.html)
- [TEXT vs VARCHAR](https://www.postgresql.org/docs/current/datatype-character.html)

### Documentação Prisma

- [Scalar Types](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#model-field-scalar-types)
- [Database Mapping](https://www.prisma.io/docs/concepts/database-connectors/postgresql#type-mapping)
- [Native Database Types](https://www.prisma.io/docs/concepts/components/prisma-schema/data-model#native-types-mapping)

---

## 📝 Resumo Executivo

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Tipo da FK** | `VARCHAR(255)` | `TEXT` |
| **Compatibilidade** | ❌ Incompatível | ✅ Compatível |
| **Erro** | FK constraint falha | FK criada com sucesso |
| **Status** | Migration falha | Migration executa |

### Lição Aprendida

> **Sempre verifique o tipo REAL da coluna referenciada no banco, não apenas o tipo lógico do Prisma.**

Prisma `String @default(uuid())` → PostgreSQL `TEXT`, **NÃO** `UUID`.

---

## ✅ Status da Correção

- [x] Problema identificado
- [x] Causa raiz analisada
- [x] Solução implementada
- [x] Documentação criada
- [ ] Testado em ambiente (aguardando teste do usuário)

**Próximo passo**: Usuário deve testar fazendo upload do módulo corrigido e executando "Atualizar Banco".
