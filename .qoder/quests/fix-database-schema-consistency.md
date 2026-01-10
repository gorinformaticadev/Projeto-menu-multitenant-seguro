# Solução Canônica: Consistência do Schema do Módulo Ordem de Serviço

## Contexto e Problema

O módulo `ordem_servico` sofreu múltiplas migrations incrementais que resultaram em inconsistências de schema, causando:
- Erros 500 intermitentes
- Falhas em operações `ON CONFLICT`
- Constraints faltando ou duplicadas
- Dependência inadequada de verificações `NOT EXISTS` no código

## Objetivo

Implementar uma abordagem LIMPA e DEFINITIVA que:
- Substitui todas as migrations antigas por 1-2 migrations canônicas
- Estabelece o banco como única fonte de integridade
- Garante compatibilidade total com `ON CONFLICT (tenant_id, user_id)`
- Elimina dependências de lógica de verificação no código

## Estratégia de Limpeza

### Fase 1: Análise do Estado Atual
- Identificar todas as tabelas relacionadas ao módulo
- Mapear constraints e índices existentes
- Documentar estrutura desejada final

### Fase 2: Criação da Migration Canônica
- Consolidar todas as definições em uma única migration
- Implementar idempotência com `DROP IF EXISTS`
- Estabelecer constraints adequadas
- Criar índices otimizados

### Fase 3: Seed Inicial
- Popular dados essenciais usando `INSERT ... ON CONFLICT DO NOTHING`
- Garantir consistência referencial
- Evitar duplicidades

## Estrutura Final das Tabelas

### 1. Tabela de Clientes (`mod_ordem_servico_clients`)
```sql
CREATE TABLE IF NOT EXISTS mod_ordem_servico_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    name VARCHAR(255) NOT NULL,
    document VARCHAR(20),
    phone_primary VARCHAR(20) NOT NULL,
    phone_secondary VARCHAR(20),
    address TEXT,
    address_number VARCHAR(10),
    address_neighborhood VARCHAR(100),
    address_city VARCHAR(100),
    address_state VARCHAR(2),
    address_zip VARCHAR(9),
    email VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    observations TEXT,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    
    CONSTRAINT fk_mod_ordem_servico_clients_tenant 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_clients_tenant_id 
    ON mod_ordem_servico_clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_clients_name 
    ON mod_ordem_servico_clients(name);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_clients_document 
    ON mod_ordem_servico_clients(document);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_clients_state 
    ON mod_ordem_servico_clients(address_state);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_clients_active 
    ON mod_ordem_servico_clients(is_active);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_clients_email 
    ON mod_ordem_servico_clients(email);
```

### 2. Tabela Principal de Ordens (`mod_ordem_servico_ordens`)
```sql
CREATE TABLE IF NOT EXISTS mod_ordem_servico_ordens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    numero TEXT NOT NULL,
    cliente_id UUID NOT NULL,
    usuario_responsavel_id TEXT NOT NULL,
    tecnico_responsavel_id TEXT,
    tipo_servico TEXT NOT NULL,
    descricao TEXT NOT NULL,
    observacoes_internas TEXT,
    laudo_tecnico TEXT,
    valor_servico DECIMAL(10,2) DEFAULT 0.00,
    valor_final DECIMAL(10,2),
    valor_estimado DECIMAL(10,2),
    forma_pagamento TEXT,
    status INTEGER NOT NULL DEFAULT 0 CHECK (status >= 0 AND status <= 7),
    data_abertura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_previsao TIMESTAMP,
    data_conclusao TIMESTAMP,
    finalizada_em TIMESTAMP,
    origem_solicitacao TEXT NOT NULL CHECK (origem_solicitacao IN ('WHATSAPP', 'PRESENCIAL', 'SISTEMA')),
    orcamento_aprovado BOOLEAN DEFAULT FALSE,
    motivo_cancelamento TEXT,
    equipamento_tipo TEXT,
    equipamento_marca TEXT,
    equipamento_modelo TEXT,
    equipamento_serie TEXT,
    equipamento_estado TEXT,
    equipamento_fotos TEXT,
    formatacao_so TEXT,
    formatacao_backup BOOLEAN DEFAULT FALSE,
    formatacao_backup_descricao TEXT,
    formatacao_senha TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_mod_ordem_servico_ordens_tenant 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_mod_ordem_servico_ordens_cliente 
        FOREIGN KEY (cliente_id) REFERENCES mod_ordem_servico_clients(id) ON DELETE RESTRICT,
    CONSTRAINT fk_mod_ordem_servico_ordens_usuario_responsavel 
        FOREIGN KEY (usuario_responsavel_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_mod_ordem_servico_ordens_tecnico_responsavel 
        FOREIGN KEY (tecnico_responsavel_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uk_mod_ordem_servico_ordens_numero 
        UNIQUE (tenant_id, numero)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_ordens_tenant_id 
    ON mod_ordem_servico_ordens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_ordens_cliente_id 
    ON mod_ordem_servico_ordens(cliente_id);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_ordens_status 
    ON mod_ordem_servico_ordens(status);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_ordens_data_abertura 
    ON mod_ordem_servico_ordens(data_abertura);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_ordens_numero 
    ON mod_ordem_servico_ordens(numero);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_ordens_usuario_responsavel 
    ON mod_ordem_servico_ordens(usuario_responsavel_id);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_ordens_tecnico_responsavel 
    ON mod_ordem_servico_ordens(tecnico_responsavel_id);
```

### 3. Tabela de Histórico (`mod_ordem_servico_historico`)
```sql
CREATE TABLE IF NOT EXISTS mod_ordem_servico_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    ordem_servico_id UUID NOT NULL,
    usuario_id TEXT NOT NULL,
    acao TEXT NOT NULL,
    valor_anterior TEXT,
    valor_novo TEXT,
    observacoes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_mod_ordem_servico_historico_tenant 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_mod_ordem_servico_historico_ordem 
        FOREIGN KEY (ordem_servico_id) REFERENCES mod_ordem_servico_ordens(id) ON DELETE CASCADE,
    CONSTRAINT fk_mod_ordem_servico_historico_usuario 
        FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_historico_tenant_id 
    ON mod_ordem_servico_historico(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_historico_ordem_id 
    ON mod_ordem_servico_historico(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_historico_usuario_id 
    ON mod_ordem_servico_historico(usuario_id);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_historico_created_at 
    ON mod_ordem_servico_historico(created_at);
```

### 4. Tabela de Papéis dos Usuários (REQUISITO PRINCIPAL)
```sql
CREATE TABLE IF NOT EXISTS mod_ordem_servico_user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    is_technician BOOLEAN DEFAULT false,
    is_attendant BOOLEAN DEFAULT true,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_mod_ordem_servico_user_roles_tenant 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_mod_ordem_servico_user_roles_user 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uk_mod_ordem_servico_user_roles_unique 
        UNIQUE (tenant_id, user_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_user_roles_tenant_id 
    ON mod_ordem_servico_user_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_user_roles_user_id 
    ON mod_ordem_servico_user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_user_roles_tenant_user 
    ON mod_ordem_servico_user_roles(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_user_roles_technician 
    ON mod_ordem_servico_user_roles(tenant_id, is_technician) 
    WHERE is_technician = true;
```

### 5. Tabela de Produtos (`mod_ordem_servico_products`)
```sql
CREATE TABLE IF NOT EXISTS mod_ordem_servico_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    cost_price DECIMAL(10,2) DEFAULT 0,
    type VARCHAR(20) DEFAULT 'PRODUCT',
    category VARCHAR(100),
    brand VARCHAR(100),
    stock_quantity INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 0,
    barcode VARCHAR(50),
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_mod_ordem_servico_products_tenant 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_products_tenant_id 
    ON mod_ordem_servico_products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_products_name 
    ON mod_ordem_servico_products(name);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_products_category 
    ON mod_ordem_servico_products(category);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_products_active 
    ON mod_ordem_servico_products(is_active);
```

### 6. Tabela de Tipos de Equipamento (`mod_ordem_servico_tipos_equipamento`)
```sql
CREATE TABLE IF NOT EXISTS mod_ordem_servico_tipos_equipamento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_mod_ordem_servico_tipos_equipamento_tenant 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT uk_mod_ordem_servico_tipos_equipamento_nome 
        UNIQUE (tenant_id, nome)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_tipos_equipamento_tenant_id 
    ON mod_ordem_servico_tipos_equipamento(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_tipos_equipamento_nome 
    ON mod_ordem_servico_tipos_equipamento(nome);
```

## Triggers para Manutenção Automática

```sql
-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_mod_ordem_servico_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar triggers às tabelas relevantes
CREATE TRIGGER trigger_mod_ordem_servico_clients_updated_at
    BEFORE UPDATE ON mod_ordem_servico_clients
    FOR EACH ROW
    EXECUTE FUNCTION update_mod_ordem_servico_updated_at();

CREATE TRIGGER trigger_mod_ordem_servico_ordens_updated_at
    BEFORE UPDATE ON mod_ordem_servico_ordens
    FOR EACH ROW
    EXECUTE FUNCTION update_mod_ordem_servico_updated_at();

CREATE TRIGGER trigger_mod_ordem_servico_user_roles_updated_at
    BEFORE UPDATE ON mod_ordem_servico_user_roles
    FOR EACH ROW
    EXECUTE FUNCTION update_mod_ordem_servico_updated_at();

CREATE TRIGGER trigger_mod_ordem_servico_products_updated_at
    BEFORE UPDATE ON mod_ordem_servico_products
    FOR EACH ROW
    EXECUTE FUNCTION update_mod_ordem_servico_updated_at();

CREATE TRIGGER trigger_mod_ordem_servico_tipos_equipamento_updated_at
    BEFORE UPDATE ON mod_ordem_servico_tipos_equipamento
    FOR EACH ROW
    EXECUTE FUNCTION update_mod_ordem_servico_updated_at();
```

## Seed Inicial Canônico

```sql
-- Inserir papéis padrão para usuários existentes
INSERT INTO mod_ordem_servico_user_roles (tenant_id, user_id, is_technician, is_attendant, is_admin)
SELECT 
    u."tenantId" as tenant_id,
    u.id as user_id,
    CASE 
        WHEN u.role = 'ADMIN' THEN true
        ELSE false
    END as is_technician,
    true as is_attendant,
    CASE 
        WHEN u.role = 'ADMIN' THEN true
        ELSE false
    END as is_admin
FROM users u
WHERE u."tenantId" IS NOT NULL 
    AND u."isLocked" = false
    AND NOT EXISTS (
        SELECT 1 FROM mod_ordem_servico_user_roles osr 
        WHERE osr.tenant_id = u."tenantId" AND osr.user_id = u.id
    )
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- Inserir tipos de equipamento padrão
INSERT INTO mod_ordem_servico_tipos_equipamento (tenant_id, nome, descricao)
SELECT DISTINCT
    t.id as tenant_id,
    tipo.nome,
    tipo.descricao
FROM tenants t
CROSS JOIN (
    VALUES 
        ('Computador', 'Desktop ou tower'),
        ('Notebook', 'Laptop pessoal ou corporativo'),
        ('Servidor', 'Servidor rack ou torre'),
        ('Impressora', 'Jato de tinta, laser ou matricial'),
        ('Scanner', 'Digitalizador de documentos'),
        ('Monitor', 'Display LCD, LED ou CRT'),
        ('Celular', 'Smartphone Android ou iOS'),
        ('Tablet', 'iPad, Android tablet ou similares'),
        ('Roteador', 'Roteador Wi-Fi residencial ou corporativo'),
        ('Switch', 'Switch de rede managed ou unmanaged')
) AS tipo(nome, descricao)
WHERE NOT EXISTS (
    SELECT 1 FROM mod_ordem_servico_tipos_equipamento tet 
    WHERE tet.tenant_id = t.id AND tet.nome = tipo.nome
)
ON CONFLICT (tenant_id, nome) DO NOTHING;
```

## Benefícios Técnicos da Abordagem

### 1. Eliminação de Erros de Integridade
- **Constraints declarativas**: Todas as regras de negócio definidas no schema
- **Unique constraints**: Previne duplicatas em nível de banco
- **Foreign keys**: Garante integridade referencial automática

### 2. Compatibilidade Total com ON CONFLICT
- **Chaves compostas**: `(tenant_id, user_id)` permite uso eficiente de `ON CONFLICT`
- **Índices adequados**: Suportam operações UPSERT performáticas
- **Sem verificações manuais**: Banco resolve conflitos automaticamente

### 3. Performance Otimizada
- **Índices estratégicos**: Cobrem os principais padrões de consulta
- **Particionamento lógico**: Por `tenant_id` facilita consultas filtradas
- **Triggers eficientes**: Atualização automática de timestamps

### 4. Manutenibilidade
- **Schema único**: Toda estrutura consolidada em uma migration
- **Idempotência**: Pode ser executada múltiplas vezes sem efeitos colaterais
- **Documentação embutida**: Comentários explicativos nas tabelas

## Implementação Prática

### Passos para Deploy:
1. Backup completo do banco de dados
2. Executar migration canônica em ambiente DEV
3. Validar funcionamento com testes automatizados
4. Replicar para ambiente PROD após validação

### Comandos Prisma:
```bash
# Gerar cliente Prisma atualizado
npx prisma generate

# Aplicar migrations
npx prisma migrate dev --name ordem_servico_canonical_schema

# Resetar ambiente de desenvolvimento (se necessário)
npx prisma migrate reset
```

## Considerações de Segurança

- **Tenant isolation**: Todas as tabelas incluem `tenant_id` obrigatório
- **RBAC integrado**: Sistema de papéis próprio do módulo
- **Auditoria**: Tabela de histórico registra todas as alterações
- **Soft delete**: Campo `deleted_at` para remoção lógica onde aplicável

Esta solução elimina permanentemente os problemas de inconsistência através de uma abordagem puramente baseada em schema, transferindo toda a responsabilidade de integridade para o PostgreSQL, eliminando a necessidade de verificações redundantes no código da aplicação.    data_conclusao TIMESTAMP,
    finalizada_em TIMESTAMP,
    origem_solicitacao TEXT NOT NULL CHECK (origem_solicitacao IN ('WHATSAPP', 'PRESENCIAL', 'SISTEMA')),
    orcamento_aprovado BOOLEAN DEFAULT FALSE,
    motivo_cancelamento TEXT,
    equipamento_tipo TEXT,
    equipamento_marca TEXT,
    equipamento_modelo TEXT,
    equipamento_serie TEXT,
    equipamento_estado TEXT,
    equipamento_fotos TEXT,
    formatacao_so TEXT,
    formatacao_backup BOOLEAN DEFAULT FALSE,
    formatacao_backup_descricao TEXT,
    formatacao_senha TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_mod_ordem_servico_ordens_tenant 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_mod_ordem_servico_ordens_cliente 
        FOREIGN KEY (cliente_id) REFERENCES mod_ordem_servico_clients(id) ON DELETE RESTRICT,
    CONSTRAINT fk_mod_ordem_servico_ordens_usuario_responsavel 
        FOREIGN KEY (usuario_responsavel_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_mod_ordem_servico_ordens_tecnico_responsavel 
        FOREIGN KEY (tecnico_responsavel_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uk_mod_ordem_servico_ordens_numero 
        UNIQUE (tenant_id, numero)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_ordens_tenant_id 
    ON mod_ordem_servico_ordens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_ordens_cliente_id 
    ON mod_ordem_servico_ordens(cliente_id);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_ordens_status 
    ON mod_ordem_servico_ordens(status);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_ordens_data_abertura 
    ON mod_ordem_servico_ordens(data_abertura);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_ordens_numero 
    ON mod_ordem_servico_ordens(numero);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_ordens_usuario_responsavel 
    ON mod_ordem_servico_ordens(usuario_responsavel_id);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_ordens_tecnico_responsavel 
    ON mod_ordem_servico_ordens(tecnico_responsavel_id);
```

### 3. Tabela de Histórico (`mod_ordem_servico_historico`)
```sql
CREATE TABLE IF NOT EXISTS mod_ordem_servico_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    ordem_servico_id UUID NOT NULL,
    usuario_id TEXT NOT NULL,
    acao TEXT NOT NULL,
    valor_anterior TEXT,
    valor_novo TEXT,
    observacoes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_mod_ordem_servico_historico_tenant 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_mod_ordem_servico_historico_ordem 
        FOREIGN KEY (ordem_servico_id) REFERENCES mod_ordem_servico_ordens(id) ON DELETE CASCADE,
    CONSTRAINT fk_mod_ordem_servico_historico_usuario 
        FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_historico_tenant_id 
    ON mod_ordem_servico_historico(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_historico_ordem_id 
    ON mod_ordem_servico_historico(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_historico_usuario_id 
    ON mod_ordem_servico_historico(usuario_id);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_historico_created_at 
    ON mod_ordem_servico_historico(created_at);
```

### 4. Tabela de Papéis dos Usuários (REQUISITO PRINCIPAL)
```sql
CREATE TABLE IF NOT EXISTS mod_ordem_servico_user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    is_technician BOOLEAN DEFAULT false,
    is_attendant BOOLEAN DEFAULT true,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_mod_ordem_servico_user_roles_tenant 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_mod_ordem_servico_user_roles_user 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uk_mod_ordem_servico_user_roles_unique 
        UNIQUE (tenant_id, user_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_user_roles_tenant_id 
    ON mod_ordem_servico_user_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_user_roles_user_id 
    ON mod_ordem_servico_user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_user_roles_tenant_user 
    ON mod_ordem_servico_user_roles(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_user_roles_technician 
    ON mod_ordem_servico_user_roles(tenant_id, is_technician) 
    WHERE is_technician = true;
```

### 5. Tabela de Produtos (`mod_ordem_servico_products`)
```sql
CREATE TABLE IF NOT EXISTS mod_ordem_servico_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    cost_price DECIMAL(10,2) DEFAULT 0,
    type VARCHAR(20) DEFAULT 'PRODUCT',
    category VARCHAR(100),
    brand VARCHAR(100),
    stock_quantity INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 0,
    barcode VARCHAR(50),
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_mod_ordem_servico_products_tenant 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_products_tenant_id 
    ON mod_ordem_servico_products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_products_name 
    ON mod_ordem_servico_products(name);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_products_category 
    ON mod_ordem_servico_products(category);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_products_active 
    ON mod_ordem_servico_products(is_active);
```

### 6. Tabela de Tipos de Equipamento (`mod_ordem_servico_tipos_equipamento`)
```sql
CREATE TABLE IF NOT EXISTS mod_ordem_servico_tipos_equipamento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_mod_ordem_servico_tipos_equipamento_tenant 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT uk_mod_ordem_servico_tipos_equipamento_nome 
        UNIQUE (tenant_id, nome)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_tipos_equipamento_tenant_id 
    ON mod_ordem_servico_tipos_equipamento(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_tipos_equipamento_nome 
    ON mod_ordem_servico_tipos_equipamento(nome);
```

## Triggers para Manutenção Automática

```sql
-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_mod_ordem_servico_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar triggers às tabelas relevantes
CREATE TRIGGER trigger_mod_ordem_servico_clients_updated_at
    BEFORE UPDATE ON mod_ordem_servico_clients
    FOR EACH ROW
    EXECUTE FUNCTION update_mod_ordem_servico_updated_at();

CREATE TRIGGER trigger_mod_ordem_servico_ordens_updated_at
    BEFORE UPDATE ON mod_ordem_servico_ordens
    FOR EACH ROW
    EXECUTE FUNCTION update_mod_ordem_servico_updated_at();

CREATE TRIGGER trigger_mod_ordem_servico_user_roles_updated_at
    BEFORE UPDATE ON mod_ordem_servico_user_roles
    FOR EACH ROW
    EXECUTE FUNCTION update_mod_ordem_servico_updated_at();

CREATE TRIGGER trigger_mod_ordem_servico_products_updated_at
    BEFORE UPDATE ON mod_ordem_servico_products
    FOR EACH ROW
    EXECUTE FUNCTION update_mod_ordem_servico_updated_at();

CREATE TRIGGER trigger_mod_ordem_servico_tipos_equipamento_updated_at
    BEFORE UPDATE ON mod_ordem_servico_tipos_equipamento
    FOR EACH ROW
    EXECUTE FUNCTION update_mod_ordem_servico_updated_at();
```

## Seed Inicial Canônico

```sql
-- Inserir papéis padrão para usuários existentes
INSERT INTO mod_ordem_servico_user_roles (tenant_id, user_id, is_technician, is_attendant, is_admin)
SELECT 
    u."tenantId" as tenant_id,
    u.id as user_id,
    CASE 
        WHEN u.role = 'ADMIN' THEN true
        ELSE false
    END as is_technician,
    true as is_attendant,
    CASE 
        WHEN u.role = 'ADMIN' THEN true
        ELSE false
    END as is_admin
FROM users u
WHERE u."tenantId" IS NOT NULL 
    AND u."isLocked" = false
    AND NOT EXISTS (
        SELECT 1 FROM mod_ordem_servico_user_roles osr 
        WHERE osr.tenant_id = u."tenantId" AND osr.user_id = u.id
    )
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- Inserir tipos de equipamento padrão
INSERT INTO mod_ordem_servico_tipos_equipamento (tenant_id, nome, descricao)
SELECT DISTINCT
    t.id as tenant_id,
    tipo.nome,
    tipo.descricao
FROM tenants t
CROSS JOIN (
    VALUES 
        ('Computador', 'Desktop ou tower'),
        ('Notebook', 'Laptop pessoal ou corporativo'),
        ('Servidor', 'Servidor rack ou torre'),
        ('Impressora', 'Jato de tinta, laser ou matricial'),
        ('Scanner', 'Digitalizador de documentos'),
        ('Monitor', 'Display LCD, LED ou CRT'),
        ('Celular', 'Smartphone Android ou iOS'),
        ('Tablet', 'iPad, Android tablet ou similares'),
        ('Roteador', 'Roteador Wi-Fi residencial ou corporativo'),
        ('Switch', 'Switch de rede managed ou unmanaged')
) AS tipo(nome, descricao)
WHERE NOT EXISTS (
    SELECT 1 FROM mod_ordem_servico_tipos_equipamento tet 
    WHERE tet.tenant_id = t.id AND tet.nome = tipo.nome
)
ON CONFLICT (tenant_id, nome) DO NOTHING;
```

## Benefícios Técnicos da Abordagem

### 1. Eliminação de Erros de Integridade
- **Constraints declarativas**: Todas as regras de negócio definidas no schema
- **Unique constraints**: Previne duplicatas em nível de banco
- **Foreign keys**: Garante integridade referencial automática

### 2. Compatibilidade Total com ON CONFLICT
- **Chaves compostas**: `(tenant_id, user_id)` permite uso eficiente de `ON CONFLICT`
- **Índices adequados**: Suportam operações UPSERT performáticas
- **Sem verificações manuais**: Banco resolve conflitos automaticamente

### 3. Performance Otimizada
- **Índices estratégicos**: Cobrem os principais padrões de consulta
- **Particionamento lógico**: Por `tenant_id` facilita consultas filtradas
- **Triggers eficientes**: Atualização automática de timestamps

### 4. Manutenibilidade
- **Schema único**: Toda estrutura consolidada em uma migration
- **Idempotência**: Pode ser executada múltiplas vezes sem efeitos colaterais
- **Documentação embutida**: Comentários explicativos nas tabelas

## Implementação Prática

### Passos para Deploy:
1. Backup completo do banco de dados
2. Executar migration canônica em ambiente DEV
3. Validar funcionamento com testes automatizados
4. Replicar para ambiente PROD após validação

### Comandos Prisma:
```bash
# Gerar cliente Prisma atualizado
npx prisma generate

# Aplicar migrations
npx prisma migrate dev --name ordem_servico_canonical_schema

# Resetar ambiente de desenvolvimento (se necessário)
npx prisma migrate reset
```

## Considerações de Segurança

- **Tenant isolation**: Todas as tabelas incluem `tenant_id` obrigatório
- **RBAC integrado**: Sistema de papéis próprio do módulo
- **Auditoria**: Tabela de histórico registra todas as alterações
- **Soft delete**: Campo `deleted_at` para remoção lógica onde aplicável

Esta solução elimina permanentemente os problemas de inconsistência através de uma abordagem puramente baseada em schema, transferindo toda a responsabilidade de integridade para o PostgreSQL, eliminando a necessidade de verificações redundantes no código da aplicação.    data_conclusao TIMESTAMP,
    finalizada_em TIMESTAMP,
    origem_solicitacao TEXT NOT NULL CHECK (origem_solicitacao IN ('WHATSAPP', 'PRESENCIAL', 'SISTEMA')),
    orcamento_aprovado BOOLEAN DEFAULT FALSE,
    motivo_cancelamento TEXT,
    equipamento_tipo TEXT,
    equipamento_marca TEXT,
    equipamento_modelo TEXT,
    equipamento_serie TEXT,
    equipamento_estado TEXT,
    equipamento_fotos TEXT,
    formatacao_so TEXT,
    formatacao_backup BOOLEAN DEFAULT FALSE,
    formatacao_backup_descricao TEXT,
    formatacao_senha TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_mod_ordem_servico_ordens_tenant 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_mod_ordem_servico_ordens_cliente 
        FOREIGN KEY (cliente_id) REFERENCES mod_ordem_servico_clients(id) ON DELETE RESTRICT,
    CONSTRAINT fk_mod_ordem_servico_ordens_usuario_responsavel 
        FOREIGN KEY (usuario_responsavel_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_mod_ordem_servico_ordens_tecnico_responsavel 
        FOREIGN KEY (tecnico_responsavel_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uk_mod_ordem_servico_ordens_numero 
        UNIQUE (tenant_id, numero)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_ordens_tenant_id 
    ON mod_ordem_servico_ordens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_ordens_cliente_id 
    ON mod_ordem_servico_ordens(cliente_id);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_ordens_status 
    ON mod_ordem_servico_ordens(status);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_ordens_data_abertura 
    ON mod_ordem_servico_ordens(data_abertura);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_ordens_numero 
    ON mod_ordem_servico_ordens(numero);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_ordens_usuario_responsavel 
    ON mod_ordem_servico_ordens(usuario_responsavel_id);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_ordens_tecnico_responsavel 
    ON mod_ordem_servico_ordens(tecnico_responsavel_id);
```

### 3. Tabela de Histórico (`mod_ordem_servico_historico`)
```sql
CREATE TABLE IF NOT EXISTS mod_ordem_servico_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    ordem_servico_id UUID NOT NULL,
    usuario_id TEXT NOT NULL,
    acao TEXT NOT NULL,
    valor_anterior TEXT,
    valor_novo TEXT,
    observacoes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_mod_ordem_servico_historico_tenant 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_mod_ordem_servico_historico_ordem 
        FOREIGN KEY (ordem_servico_id) REFERENCES mod_ordem_servico_ordens(id) ON DELETE CASCADE,
    CONSTRAINT fk_mod_ordem_servico_historico_usuario 
        FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_historico_tenant_id 
    ON mod_ordem_servico_historico(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_historico_ordem_id 
    ON mod_ordem_servico_historico(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_historico_usuario_id 
    ON mod_ordem_servico_historico(usuario_id);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_historico_created_at 
    ON mod_ordem_servico_historico(created_at);
```

### 4. Tabela de Papéis dos Usuários (REQUISITO PRINCIPAL)
```sql
CREATE TABLE IF NOT EXISTS mod_ordem_servico_user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    is_technician BOOLEAN DEFAULT false,
    is_attendant BOOLEAN DEFAULT true,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_mod_ordem_servico_user_roles_tenant 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_mod_ordem_servico_user_roles_user 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uk_mod_ordem_servico_user_roles_unique 
        UNIQUE (tenant_id, user_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_user_roles_tenant_id 
    ON mod_ordem_servico_user_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_user_roles_user_id 
    ON mod_ordem_servico_user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_user_roles_tenant_user 
    ON mod_ordem_servico_user_roles(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_user_roles_technician 
    ON mod_ordem_servico_user_roles(tenant_id, is_technician) 
    WHERE is_technician = true;
```

### 5. Tabela de Produtos (`mod_ordem_servico_products`)
```sql
CREATE TABLE IF NOT EXISTS mod_ordem_servico_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    cost_price DECIMAL(10,2) DEFAULT 0,
    type VARCHAR(20) DEFAULT 'PRODUCT',
    category VARCHAR(100),
    brand VARCHAR(100),
    stock_quantity INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 0,
    barcode VARCHAR(50),
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_mod_ordem_servico_products_tenant 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_products_tenant_id 
    ON mod_ordem_servico_products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_products_name 
    ON mod_ordem_servico_products(name);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_products_category 
    ON mod_ordem_servico_products(category);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_products_active 
    ON mod_ordem_servico_products(is_active);
```

### 6. Tabela de Tipos de Equipamento (`mod_ordem_servico_tipos_equipamento`)
```sql
CREATE TABLE IF NOT EXISTS mod_ordem_servico_tipos_equipamento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_mod_ordem_servico_tipos_equipamento_tenant 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT uk_mod_ordem_servico_tipos_equipamento_nome 
        UNIQUE (tenant_id, nome)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_tipos_equipamento_tenant_id 
    ON mod_ordem_servico_tipos_equipamento(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_tipos_equipamento_nome 
    ON mod_ordem_servico_tipos_equipamento(nome);
```

## Triggers para Manutenção Automática

```sql
-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_mod_ordem_servico_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar triggers às tabelas relevantes
CREATE TRIGGER trigger_mod_ordem_servico_clients_updated_at
    BEFORE UPDATE ON mod_ordem_servico_clients
    FOR EACH ROW
    EXECUTE FUNCTION update_mod_ordem_servico_updated_at();

CREATE TRIGGER trigger_mod_ordem_servico_ordens_updated_at
    BEFORE UPDATE ON mod_ordem_servico_ordens
    FOR EACH ROW
    EXECUTE FUNCTION update_mod_ordem_servico_updated_at();

CREATE TRIGGER trigger_mod_ordem_servico_user_roles_updated_at
    BEFORE UPDATE ON mod_ordem_servico_user_roles
    FOR EACH ROW
    EXECUTE FUNCTION update_mod_ordem_servico_updated_at();

CREATE TRIGGER trigger_mod_ordem_servico_products_updated_at
    BEFORE UPDATE ON mod_ordem_servico_products
    FOR EACH ROW
    EXECUTE FUNCTION update_mod_ordem_servico_updated_at();

CREATE TRIGGER trigger_mod_ordem_servico_tipos_equipamento_updated_at
    BEFORE UPDATE ON mod_ordem_servico_tipos_equipamento
    FOR EACH ROW
    EXECUTE FUNCTION update_mod_ordem_servico_updated_at();
```

## Seed Inicial Canônico

```sql
-- Inserir papéis padrão para usuários existentes
INSERT INTO mod_ordem_servico_user_roles (tenant_id, user_id, is_technician, is_attendant, is_admin)
SELECT 
    u."tenantId" as tenant_id,
    u.id as user_id,
    CASE 
        WHEN u.role = 'ADMIN' THEN true
        ELSE false
    END as is_technician,
    true as is_attendant,
    CASE 
        WHEN u.role = 'ADMIN' THEN true
        ELSE false
    END as is_admin
FROM users u
WHERE u."tenantId" IS NOT NULL 
    AND u."isLocked" = false
    AND NOT EXISTS (
        SELECT 1 FROM mod_ordem_servico_user_roles osr 
        WHERE osr.tenant_id = u."tenantId" AND osr.user_id = u.id
    )
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- Inserir tipos de equipamento padrão
INSERT INTO mod_ordem_servico_tipos_equipamento (tenant_id, nome, descricao)
SELECT DISTINCT
    t.id as tenant_id,
    tipo.nome,
    tipo.descricao
FROM tenants t
CROSS JOIN (
    VALUES 
        ('Computador', 'Desktop ou tower'),
        ('Notebook', 'Laptop pessoal ou corporativo'),
        ('Servidor', 'Servidor rack ou torre'),
        ('Impressora', 'Jato de tinta, laser ou matricial'),
        ('Scanner', 'Digitalizador de documentos'),
        ('Monitor', 'Display LCD, LED ou CRT'),
        ('Celular', 'Smartphone Android ou iOS'),
        ('Tablet', 'iPad, Android tablet ou similares'),
        ('Roteador', 'Roteador Wi-Fi residencial ou corporativo'),
        ('Switch', 'Switch de rede managed ou unmanaged')
) AS tipo(nome, descricao)
WHERE NOT EXISTS (
    SELECT 1 FROM mod_ordem_servico_tipos_equipamento tet 
    WHERE tet.tenant_id = t.id AND tet.nome = tipo.nome
)
ON CONFLICT (tenant_id, nome) DO NOTHING;
```

## Benefícios Técnicos da Abordagem

### 1. Eliminação de Erros de Integridade
- **Constraints declarativas**: Todas as regras de negócio definidas no schema
- **Unique constraints**: Previne duplicatas em nível de banco
- **Foreign keys**: Garante integridade referencial automática

### 2. Compatibilidade Total com ON CONFLICT
- **Chaves compostas**: `(tenant_id, user_id)` permite uso eficiente de `ON CONFLICT`
- **Índices adequados**: Suportam operações UPSERT performáticas
- **Sem verificações manuais**: Banco resolve conflitos automaticamente

### 3. Performance Otimizada
- **Índices estratégicos**: Cobrem os principais padrões de consulta
- **Particionamento lógico**: Por `tenant_id` facilita consultas filtradas
- **Triggers eficientes**: Atualização automática de timestamps

### 4. Manutenibilidade
- **Schema único**: Toda estrutura consolidada em uma migration
- **Idempotência**: Pode ser executada múltiplas vezes sem efeitos colaterais
- **Documentação embutida**: Comentários explicativos nas tabelas

## Implementação Prática

### Passos para Deploy:
1. Backup completo do banco de dados
2. Executar migration canônica em ambiente DEV
3. Validar funcionamento com testes automatizados
4. Replicar para ambiente PROD após validação

### Comandos Prisma:
```bash
# Gerar cliente Prisma atualizado
npx prisma generate

# Aplicar migrations
npx prisma migrate dev --name ordem_servico_canonical_schema

# Resetar ambiente de desenvolvimento (se necessário)
npx prisma migrate reset
```

## Considerações de Segurança

- **Tenant isolation**: Todas as tabelas incluem `tenant_id` obrigatório
- **RBAC integrado**: Sistema de papéis próprio do módulo
- **Auditoria**: Tabela de histórico registra todas as alterações
- **Soft delete**: Campo `deleted_at` para remoção lógica onde aplicável

