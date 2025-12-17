# Implementação do Ciclo de Vida Correto de Módulos

## Data da Implementação
17 de dezembro de 2025

## Objetivo

Corrigir o ciclo de vida de instalação e desinstalação de módulos, implementando o fluxo seguro definido no design document:

**ZIP → Detectado → Instalado → Banco Preparado → Ativo → Desativado → Desinstalado**

## Filosofia Implementada

### Separação de Responsabilidades

- **Instalar**: Torna o módulo disponível sem executar código
- **Preparar Banco**: Executa migrations e seeds sob demanda explícita
- **Ativar**: Habilita funcionalidades (rotas, menus, eventos)
- **Desativar**: Desliga funcionalidades sem remover dados
- **Desinstalar**: Remove módulo de forma segura com opções de preservação

## Alterações Implementadas

### 1. ModuleInstallerService (`backend/src/core/module-installer.service.ts`)

#### 1.1 Método `installModuleFromZip` - Corrigido

**Antes**: 
- Executava notificação de "módulo ativado" incorretamente
- Não informava ao usuário sobre próximos passos

**Depois**:
```typescript
// Notifica instalação (NÃO ativação)
await this.notifications.createNotification({
    title: 'Módulo Instalado',
    message: `Módulo ${moduleJson.name} instalado com sucesso. Execute a preparação do banco de dados antes de ativar.`,
    severity: 'info',
    audience: 'super_admin',
    source: 'core',
    module: moduleJson.slug,
    context: '/configuracoes/sistema/modulos'
});

return {
    success: true,
    module: { ... },
    message: 'Módulo instalado. Execute preparação de banco antes de ativar.'
};
```

**Status após instalação**: `installed` (seguro, sem execução de código)

---

#### 1.2 Método `activateModule` - Melhorado

**Nova funcionalidade**: Validação de dependências

**Validações adicionadas**:
1. Módulo deve estar com status `db_ready`
2. Verifica se module.json declara dependências
3. Valida que todas as dependências estão instaladas
4. Valida que todas as dependências estão `active`
5. BLOQUEIA ativação se alguma dependência estiver ausente ou inativa

```typescript
// Exemplo de dependências no module.json
{
  "dependencies": ["modulo-base", "modulo-comum"]
}
```

**Mensagem de erro**: 
```
"Módulos dependentes não estão ativos: {lista}"
```

---

#### 1.3 Método `deactivateModule` - Melhorado

**Nova funcionalidade**: Validação de dependências inversas

**Validações adicionadas**:
1. Verifica se outros módulos dependem deste
2. Se algum módulo dependente estiver `active`, BLOQUEIA desativação
3. Retorna lista de módulos que devem ser desativados primeiro

**Fluxo de validação**:
```typescript
// Para cada módulo ativo
// Verifica se o module.json declara dependência do módulo sendo desativado
if (otherModuleJson.dependencies && otherModuleJson.dependencies.includes(slug)) {
    dependentModules.push(otherModule.name);
}

// Se houver dependentes
throw new Error(`Não é possível desativar. Módulos dependentes: ${dependentModules.join(', ')}`);
```

---

#### 1.4 Método `updateModuleDatabase` - Melhorado

**Nova funcionalidade**: Contador de execuções e notificações detalhadas

**Melhorias**:
1. Retorna quantidade de migrations executadas
2. Retorna quantidade de seeds executadas
3. Notifica sucesso com detalhes
4. Notifica erro com mensagem específica

**Response atualizada**:
```typescript
{
    success: true,
    executed: {
        migrations: 3,
        seeds: 1
    },
    message: 'Banco de dados atualizado'
}
```

**Notificação de sucesso**:
```
"Módulo {name} está pronto. {X} migrations e {Y} seeds executados."
```

**Notificação de erro**:
```
"Falha ao atualizar banco do módulo {name}: {error}"
```

---

#### 1.5 Método `executeMigrations` - Refatorado

**Mudança de assinatura**:
```typescript
// Antes: async executeMigrations(...): Promise<void>
// Depois: async executeMigrations(...): Promise<number>
```

**Retorna**: Número de arquivos executados

**Melhorias**:
- Contador de execuções
- Mensagens de erro mais específicas
- Remove notificações redundantes

---

#### 1.6 **NOVO** Método `uninstallModule`

**Assinatura**:
```typescript
async uninstallModule(slug: string, options: {
    dataRemovalOption: 'keep' | 'core_only' | 'full';
    confirmationName: string;
})
```

**Opções de remoção de dados**:

| Opção | Descrição |
|-------|-----------|
| `keep` | Remove apenas registros do CORE, preserva tabelas e dados |
| `core_only` | Remove registros do CORE, preserva tabelas e dados (idêntico a keep) |
| `full` | Remove TUDO: registros do CORE, tabelas do módulo e arquivos |

**Validações Bloqueantes**:

| Validação | Mensagem de Erro |
|-----------|------------------|
| Status deve ser `disabled` ou `installed` | "Desative o módulo antes de desinstalar" |
| Nenhum módulo ativo pode depender deste | "Módulos dependentes: {lista}. Desative-os primeiro" |
| Nenhum tenant pode ter módulo habilitado | "Módulo em uso por {X} tenant(s). Desabilite primeiro" |
| Confirmação de nome deve ser exata | "Nome de confirmação incorreto" |

**Processo de Desinstalação em Camadas**:

**CAMADA 1 - Registros do CORE (SEMPRE executada)**:
- Remove registro da tabela `modules`
- Remove em cascata (via Prisma):
  - `module_menus`
  - `module_migrations`
  - `module_tenant`

**CAMADA 2 - Tabelas do Módulo (CONDICIONAL - apenas se `dataRemovalOption === 'full'`)**:
1. Busca `rollback.sql` ou `uninstall.sql` no módulo
2. Se existir e `allowDataRemoval: true` no module.json, executa script customizado
3. Extrai lista de tabelas criadas das migrations (via regex)
4. Para cada tabela:
   - Verifica se existe no banco
   - Executa `DROP TABLE IF EXISTS "{tableName}" CASCADE`
   - Registra sucesso ou aviso

**CAMADA 3 - Arquivos (SEMPRE executada)**:
- Remove diretório completo `/modules/{slug}`
- Preserva uploads em `/uploads/{slug}` (se existir)

**Response**:
```typescript
{
    success: true,
    removed: {
        coreRecords: true,
        tables: ["example_items", "example_categories"],
        files: "/modules/example-module"
    },
    message: "Módulo desinstalado"
}
```

**Auditoria**:
- Cria notificação de desinstalação
- Logs detalhados de cada etapa
- Registro de tabelas removidas

---

### 2. ModuleInstallerController (`backend/src/core/module-installer.controller.ts`)

#### 2.1 **NOVO** Endpoint DELETE

**Rota**: `DELETE /configuracoes/sistema/modulos/:slug/uninstall`

**Permissão**: SUPER_ADMIN

**Request Body**:
```json
{
  "dataRemovalOption": "keep" | "core_only" | "full",
  "confirmationName": "nome-do-modulo"
}
```

**Response de sucesso**:
```json
{
  "success": true,
  "removed": {
    "coreRecords": true,
    "tables": ["example_items"],
    "files": "/modules/example-module"
  },
  "message": "Módulo desinstalado"
}
```

**Response de erro (validação bloqueante)**:
```json
{
  "statusCode": 400,
  "message": "Módulos dependentes: Sistema Core. Desative-os primeiro"
}
```

---

## Estados do Módulo (ModuleStatus Enum)

| Estado | Descrição | Banco de Dados | Rotas/Menus | Pode Ativar |
|--------|-----------|----------------|-------------|-------------|
| `detected` | ZIP enviado, validação pendente | Não | Não | Não |
| `installed` | Arquivos extraídos, registrado | Não | Não | Não |
| `db_ready` | Migrations/seeds executados | Sim | Não | Sim |
| `active` | Módulo em operação | Sim | Sim | N/A |
| `disabled` | Desligado temporariamente | Sim | Não | Sim |

## Transições de Estado

```
[ZIP] → detected
detected → installed (upload)
installed → db_ready (update-db)
db_ready → active (activate)
active → disabled (deactivate)
disabled → active (activate novamente)
disabled → [REMOVIDO] (uninstall)
installed → [REMOVIDO] (uninstall)
```

## Fluxo Correto de Uso

### Instalação Inicial

```bash
# 1. Upload do módulo
POST /configuracoes/sistema/modulos/upload
# Status: installed

# 2. Preparar banco de dados
POST /configuracoes/sistema/modulos/{slug}/update-db
# Status: db_ready

# 3. Ativar módulo
POST /configuracoes/sistema/modulos/{slug}/activate
# Status: active
```

### Desativação Temporária

```bash
# 1. Desativar módulo
POST /configuracoes/sistema/modulos/{slug}/deactivate
# Status: disabled

# 2. Reativar quando necessário
POST /configuracoes/sistema/modulos/{slug}/activate
# Status: active
```

### Desinstalação Completa

```bash
# 1. Desativar módulo (se ativo)
POST /configuracoes/sistema/modulos/{slug}/deactivate
# Status: disabled

# 2. Desinstalar com opção de remoção
DELETE /configuracoes/sistema/modulos/{slug}/uninstall
Body: {
  "dataRemovalOption": "keep",
  "confirmationName": "nome-do-modulo"
}
# Status: REMOVIDO
```

## Proteções de Segurança Implementadas

### 1. Instalação Segura
- ✅ Nenhum código do módulo é executado
- ✅ Nenhuma migration é disparada automaticamente
- ✅ Nenhum script NPM é executado
- ✅ Status inicial seguro: `installed`

### 2. Ativação Controlada
- ✅ Requer banco preparado (`db_ready`)
- ✅ Valida dependências antes de ativar
- ✅ BLOQUEIA ativação se dependências ausentes

### 3. Desativação Inteligente
- ✅ Verifica dependências inversas
- ✅ BLOQUEIA desativação se outros módulos dependem
- ✅ Preserva dados e arquivos

### 4. Desinstalação Segura
- ✅ Requer status `disabled` ou `installed`
- ✅ Verifica dependências inversas
- ✅ Verifica uso por tenants
- ✅ Requer confirmação dupla (nome do módulo)
- ✅ Oferece opções de preservação de dados
- ✅ Remove registros do CORE em cascata
- ✅ Não remove tabelas por padrão
- ✅ Permite rollback customizado via script
- ✅ Auditoria completa de ações

## Validações Implementadas

### Regras de Instalação
- VL-01: Arquivo deve ser .zip ✅
- VL-02: Tamanho máximo 50MB ✅
- VL-03: module.json deve existir ✅
- VL-04: Slug deve ser único ✅
- VL-05: Slug apenas [a-zA-Z0-9_-] ✅
- VL-06: Campos obrigatórios: slug, name, version ✅

### Regras de Preparação de Banco
- VL-07: Status deve ser `installed` ✅
- VL-08: Migration deve ser .sql válido ✅
- VL-09: Migration não pode ter sido executada ✅
- VL-10: Sintaxe SQL deve ser válida ✅

### Regras de Ativação
- VL-11: Status deve ser `db_ready` ✅
- VL-12: Dependências devem estar ativas ✅
- VL-13: Apenas SUPER_ADMIN pode ativar ✅

### Regras de Desinstalação
- VL-14: Status deve ser `disabled` ou `installed` ✅
- VL-15: Nenhum módulo ativo pode depender deste ✅
- VL-16: Nenhum tenant pode ter módulo habilitado ✅
- VL-17: Confirmação de nome deve ser exata ✅
- VL-18: Tabelas com FK são protegidas ⚠️ (parcial - via CASCADE no DROP)

## Notificações Implementadas

### Módulo Instalado
```json
{
  "title": "Módulo Instalado",
  "message": "Módulo {name} instalado com sucesso. Execute a preparação do banco de dados antes de ativar.",
  "severity": "info",
  "audience": "super_admin",
  "source": "core",
  "module": "{slug}",
  "context": "/configuracoes/sistema/modulos"
}
```

### Banco de Dados Atualizado
```json
{
  "title": "Banco de Dados Atualizado",
  "message": "Módulo {name} está pronto. {X} migrations e {Y} seeds executados.",
  "severity": "info",
  "audience": "super_admin",
  "source": "core",
  "module": "{slug}"
}
```

### Módulo Ativado
```json
{
  "title": "Módulo Ativado",
  "message": "Módulo {name} está agora operacional no sistema.",
  "severity": "info",
  "audience": "super_admin",
  "source": "core",
  "module": "{slug}"
}
```

### Erro ao Preparar Banco
```json
{
  "title": "Erro ao Preparar Banco",
  "message": "Falha ao atualizar banco do módulo {name}: {error}",
  "severity": "critical",
  "audience": "super_admin",
  "source": "core",
  "module": "{slug}"
}
```

### Módulo Desinstalado
```json
{
  "title": "Módulo Desinstalado",
  "message": "Módulo {name} foi removido do sistema",
  "severity": "warning",
  "audience": "super_admin",
  "source": "core",
  "module": "{slug}"
}
```

## Exemplo de module.json com Dependências

```json
{
  "slug": "modulo-financeiro",
  "name": "Financeiro",
  "version": "1.0.0",
  "description": "Módulo de gestão financeira",
  "dependencies": ["modulo-base", "modulo-comum"],
  "allowDataRemoval": true,
  "menus": [
    {
      "label": "Financeiro",
      "icon": "DollarSign",
      "route": "/modules/financeiro",
      "order": 20
    }
  ]
}
```

**Campos de Desinstalação**:
- `allowDataRemoval`: Se `true`, permite execução de rollback/uninstall customizado
- Scripts opcionais: `rollback.sql` ou `uninstall.sql`

## Testes Sugeridos

### Teste 01: Instalação Sem Execução
1. Fazer upload de módulo válido
2. Verificar status = `installed`
3. Verificar que nenhuma migration foi executada
4. Verificar notificação de instalação

### Teste 02: Preparação de Banco
1. Módulo com status `installed`
2. Executar `/update-db`
3. Verificar migrations executadas
4. Verificar seeds executadas
5. Verificar status = `db_ready`

### Teste 03: Ativação com Dependências
1. Módulo A depende de Módulo B
2. Módulo B está `disabled`
3. Tentar ativar Módulo A → deve bloquear
4. Ativar Módulo B
5. Ativar Módulo A → deve funcionar

### Teste 04: Desativação com Dependentes
1. Módulo A está `active`
2. Módulo B (dependente) está `active`
3. Tentar desativar Módulo A → deve bloquear
4. Desativar Módulo B
5. Desativar Módulo A → deve funcionar

### Teste 05: Desinstalação Segura (Manter Dados)
1. Módulo com status `disabled`
2. Desinstalar com `dataRemovalOption: 'keep'`
3. Verificar remoção de registros do CORE
4. Verificar preservação de tabelas
5. Verificar remoção de arquivos

### Teste 06: Desinstalação Completa (Remover Tudo)
1. Módulo com status `disabled`
2. Desinstalar com `dataRemovalOption: 'full'`
3. Verificar remoção de registros do CORE
4. Verificar remoção de tabelas criadas
5. Verificar remoção de arquivos

### Teste 07: Bloqueio por Tenants
1. Módulo habilitado para 2 tenants
2. Tentar desinstalar → deve bloquear
3. Desabilitar módulo em todos os tenants
4. Desinstalar → deve funcionar

### Teste 08: Confirmação de Nome
1. Tentar desinstalar com nome incorreto
2. Verificar erro "Nome de confirmação incorreto"
3. Desinstalar com nome correto
4. Verificar sucesso

## Compatibilidade com Código Existente

✅ **Totalmente compatível**

As alterações são retrocompatíveis:
- Métodos existentes foram **melhorados**, não removidos
- Novos métodos foram **adicionados**
- Endpoints existentes continuam funcionando
- Nenhuma breaking change foi introduzida

## Próximos Passos (Frontend)

Para completar a implementação, o frontend deve:

1. **Adicionar botões condicionais por status**:
   - `installed` → Botão "Preparar Banco"
   - `db_ready` → Botão "Ativar"
   - `active` → Botão "Desativar"
   - `disabled` → Botões "Ativar" e "Desinstalar"

2. **Implementar dialog de preparação de banco**:
   - Listar migrations e seeds pendentes
   - Botão "Executar Preparação"

3. **Implementar dialog de desinstalação**:
   - Primeira confirmação simples
   - Segunda confirmação com opções:
     - ( ) Manter dados e tabelas
     - ( ) Remover APENAS registros do CORE
     - ( ) Remover TUDO incluindo tabelas
   - Campo de digitação do nome do módulo

4. **Melhorar exibição de status**:
   - Indicador visual por status
   - Mensagens de ajuda contextuais

5. **Implementar tratamento de erros**:
   - Exibir mensagens de validação bloqueante
   - Sugerir ações corretivas

## Referências

- Design Document: `.qoder/quests/module-installation-lifecycle.md`
- Código modificado:
  - `backend/src/core/module-installer.service.ts`
  - `backend/src/core/module-installer.controller.ts`
- Schema Prisma: `backend/prisma/schema.prisma`
- Enums: `ModuleStatus`, `MigrationType`

## Conclusão

O ciclo de vida de módulos foi completamente refatorado para seguir princípios de segurança, previsibilidade e reversibilidade. Todas as operações críticas agora possuem validações bloqueantes e opções de preservação de dados.

**Status**: ✅ Implementação Backend Completa
**Pendente**: Interface Frontend (dialogs e validações)
