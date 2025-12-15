# Refatoração do Gerenciamento de Módulos - Controle de Migrations e Seeds

## Visão Geral

Refatoração do sistema de gerenciamento de módulos para implementar controle preciso de execução de migrations e seeds, garantindo que o botão "Atualizar Banco de Dados" apareça apenas quando houver pendências reais e que nenhuma migration ou seed seja executada duas vezes.

## Contexto Atual

### Situação Existente

O sistema atual possui:

- Tabela `modules` com campo `databaseVersion` que armazena a versão do módulo aplicada ao banco
- Verificação baseada em comparação de versões entre módulo e banco
- Detecção de migrations/seeds baseada apenas na existência de arquivos
- Execução de todas as migrations encontradas na pasta, sem controle individual
- Execução completa de seeds sem controle de duplicação

### Problemas Identificados

| Problema | Impacto |
|----------|---------|
| Não existe controle individual de migrations executadas | Migrations podem ser executadas múltiplas vezes causando erros |
| Não existe controle de seeds executados | Seeds podem duplicar dados no banco |
| Verificação baseada apenas em existência de arquivos | Botão aparece mesmo quando tudo já foi executado |
| Campo `databaseVersion` apenas armazena versão | Não rastreia quais migrations/seeds foram aplicados |
| Impossível adicionar novas migrations a módulo já instalado | Não há como diferenciar migrations novas de antigas |

## Objetivo da Refatoração

Implementar um sistema robusto de controle de execução que:

1. Rastreie individualmente cada migration e seed executado
2. Exiba o botão "Atualizar Banco" apenas quando existirem pendências reais
3. Permita adicionar novas migrations a módulos existentes
4. Forneça rastreabilidade completa de todas as operações de banco
5. Previna execuções duplicadas de forma confiável

## Análise de Solução

### Nova Estrutura de Dados

#### Tabela de Controle de Migrations

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Identificador único do registro |
| moduleName | String | Nome do módulo (FK para modules.name) |
| fileName | String | Nome do arquivo de migration (ex: 001_create_table.sql) |
| type | Enum | Tipo do arquivo: MIGRATION ou SEED |
| checksum | String | Hash SHA-256 do conteúdo do arquivo |
| status | Enum | Status: PENDING, EXECUTING, COMPLETED, FAILED, ROLLED_BACK |
| executedAt | DateTime | Data/hora da execução (null se pendente) |
| executionTime | Integer | Tempo de execução em milissegundos |
| errorMessage | String | Mensagem de erro caso falhe (nullable) |
| executedBy | String | ID do usuário que executou (nullable) |
| rollbackAt | DateTime | Data/hora de rollback se aplicável (nullable) |
| createdAt | DateTime | Data de registro |
| updatedAt | DateTime | Última atualização |

**Índices:**
- Único: (moduleName, fileName, type)
- Index: (moduleName, status)
- Index: (status)
- Index: (executedAt)

### Fluxo de Controle de Migrations

#### Fase 1: Descoberta

Ao listar módulos instalados, o sistema deve:

1. Buscar todos os arquivos .sql na pasta `migrations/` do módulo
2. Buscar arquivo `seed.sql` na raiz ou pasta `seeds/`
3. Para cada arquivo encontrado:
   - Calcular checksum SHA-256 do conteúdo
   - Consultar tabela de controle se existe registro
   - Se não existe, criar registro com status PENDING
   - Se existe, comparar checksum:
     - Checksum diferente = arquivo modificado = registrar como nova migration
     - Checksum igual = já executado ou pendente

#### Fase 2: Verificação de Pendências

Para determinar se há atualizações disponíveis:

1. Consultar registros do módulo com status PENDING
2. Se existir pelo menos um registro PENDING:
   - `hasDatabaseUpdates = true`
   - Contar quantas migrations pendentes
   - Contar quantos seeds pendentes
3. Se todos os registros estão COMPLETED:
   - `hasDatabaseUpdates = false`
   - Botão não deve aparecer

#### Fase 3: Execução

Ao clicar em "Atualizar Banco de Dados":

1. **Preparação:**
   - Buscar todos os registros PENDING do módulo
   - Ordenar migrations por fileName (ordem alfabética)
   - Criar backup do banco de dados
   - Iniciar transação de log

2. **Execução de Migrations:**
   - Para cada migration PENDING:
     - Atualizar status para EXECUTING
     - Registrar timestamp de início
     - Executar SQL
     - Se sucesso: status = COMPLETED, registrar executedAt e executionTime
     - Se erro: status = FAILED, registrar errorMessage, abortar processo

3. **Execução de Seeds:**
   - Para cada seed PENDING:
     - Atualizar status para EXECUTING
     - Executar SQL
     - Se sucesso: status = COMPLETED
     - Se erro: status = FAILED, abortar (seeds não fazem rollback de migrations)

4. **Finalização:**
   - Atualizar campo `databaseVersion` na tabela modules
   - Registrar usuário que executou
   - Limpar backup se tudo bem-sucedido
   - Retornar resultado detalhado

5. **Tratamento de Erro:**
   - Manter status FAILED nos registros com erro
   - Restaurar backup se configurado
   - Registrar log detalhado do erro
   - Permitir reexecução após correção

### Lógica de Exibição do Botão

O botão "Atualizar Banco de Dados" deve ser exibido quando:

```
Condição 1: Módulo possui pasta migrations/ OU arquivo seed.sql
E
Condição 2: Existe pelo menos um registro na tabela de controle com status PENDING
```

O botão NÃO deve ser exibido quando:

```
Condição A: Módulo não possui migrations nem seeds
OU
Condição B: Todos os registros do módulo estão com status COMPLETED
```

### Interface do Usuário

#### Card do Módulo - Estados Visuais

| Estado | Badge | Contador | Botão |
|--------|-------|----------|-------|
| Sem migrations/seeds | - | - | Não exibe |
| Tudo atualizado | "✓ Banco Atualizado" (verde) | - | Não exibe |
| Com pendências | "⚠ Atualização Pendente" (amarelo) | "2 migrations, 1 seed" | "Atualizar Banco" |
| Executando | "⟳ Atualizando..." (azul) | - | Desabilitado com spinner |
| Erro na última execução | "✗ Erro na Atualização" (vermelho) | "1 migration falhou" | "Tentar Novamente" |

#### Informações Detalhadas

Ao clicar em "Detalhes" do módulo, exibir:

- Lista de migrations:
  - Nome do arquivo
  - Status (Pendente / Executada / Erro)
  - Data de execução (se aplicável)
  - Tempo de execução
  - Mensagem de erro (se houver)

- Lista de seeds:
  - Nome do arquivo
  - Status
  - Data de execução

## Estrutura de Implementação

### Backend - Camadas

#### 1. Schema Prisma

Adicionar novo model para controle de migrations:

**Localização:** `backend/prisma/schema.prisma`

**Campos:**
- Conforme tabela detalhada acima
- Relacionamento com Module via moduleName
- Enums para type e status

#### 2. Service - ModuleMigrationService

**Localização:** `backend/src/modules/module-migration.service.ts`

**Responsabilidades:**
- Descoberta de migrations e seeds em pastas de módulos
- Cálculo de checksums de arquivos
- Registro de migrations/seeds na tabela de controle
- Consulta de pendências
- Execução controlada de migrations e seeds
- Atualização de status e metadados

**Métodos principais:**

| Método | Propósito |
|--------|-----------|
| `discoverModuleMigrations(moduleName)` | Escanear pasta do módulo e registrar migrations/seeds |
| `getPendingMigrations(moduleName)` | Retornar lista de migrations pendentes |
| `getPendingSeeds(moduleName)` | Retornar lista de seeds pendentes |
| `hasPendingUpdates(moduleName)` | Verificar se há pendências (boolean) |
| `executePendingMigrations(moduleName, userId)` | Executar todas as migrations pendentes em ordem |
| `executePendingSeeds(moduleName, userId)` | Executar todos os seeds pendentes |
| `getMigrationStatus(moduleName)` | Obter status detalhado de todas as migrations/seeds |
| `calculateFileChecksum(filePath)` | Calcular SHA-256 de arquivo |
| `markMigrationAsExecuted(id, metadata)` | Atualizar registro após execução |
| `markMigrationAsFailed(id, error)` | Registrar falha |
| `retryFailedMigration(id, userId)` | Reexecutar migration que falhou |

#### 3. Refatoração do ModuleInstallerService

**Localização:** `backend/src/modules/module-installer.service.ts`

**Alterações necessárias:**

**Método `listInstalledModules()`:**
- Remover lógica atual de `checkModuleUpdates`
- Integrar com `ModuleMigrationService.hasPendingUpdates()`
- Incluir contadores de pendências no retorno

**Método `updateModuleDatabase()`:**
- Delegar execução para `ModuleMigrationService`
- Manter lógica de backup e rollback
- Melhorar retorno com detalhes da execução

**Método `runMigrations()` (privado):**
- Deprecado - substituir por `ModuleMigrationService.executePendingMigrations()`
- Manter por compatibilidade temporária durante transição

**Método `runSeed()` (privado):**
- Deprecado - substituir por `ModuleMigrationService.executePendingSeeds()`
- Manter por compatibilidade temporária

**Novos métodos:**
- `syncModuleMigrations(moduleName)` - Chamar discovery após instalação/atualização
- `getMigrationDetails(moduleName)` - Obter detalhes para UI

#### 4. Controller - Novos Endpoints

**Localização:** `backend/src/modules/modules.controller.ts`

**Novos endpoints:**

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/modules/:name/migrations/status` | GET | Obter status detalhado de migrations/seeds |
| `/modules/:name/migrations/pending` | GET | Listar apenas pendências |
| `/modules/:name/migrations/sync` | POST | Forçar sincronização (descoberta) |
| `/modules/:name/migrations/retry/:id` | POST | Reexecutar migration que falhou |

**Endpoints modificados:**

| Endpoint | Alteração |
|----------|-----------|
| `/modules/:name/update-database` | Usar novo service, retornar detalhes completos |
| `/modules/:name/check-updates` | Usar novo service para verificação |
| `/modules/installed` | Incluir contadores de pendências |

### Frontend - Componentes

#### 1. Interface TypeScript

**Localização:** `frontend/src/app/configuracoes/sistema/modulos/components/ModuleManagement.tsx`

**Novas interfaces:**

```
interface MigrationRecord {
  id: string
  fileName: string
  type: 'MIGRATION' | 'SEED'
  status: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED'
  executedAt: string | null
  executionTime: number | null
  errorMessage: string | null
}

interface ModuleMigrationStatus {
  moduleName: string
  pendingMigrations: number
  pendingSeeds: number
  completedMigrations: number
  completedSeeds: number
  failedMigrations: number
  failedSeeds: number
  migrations: MigrationRecord[]
  seeds: MigrationRecord[]
}

interface InstalledModule {
  // ... campos existentes
  hasDatabaseUpdates: boolean
  pendingMigrationsCount: number
  pendingSeedsCount: number
  failedMigrationsCount: number
  migrationStatus: 'updated' | 'pending' | 'error' | 'unknown'
}
```

#### 2. Componente ModuleManagement

**Alterações no card do módulo:**

- Exibir badge condicional baseado em `migrationStatus`
- Exibir contadores quando houver pendências
- Exibir botão apenas quando `hasDatabaseUpdates === true`
- Implementar estados de loading durante execução
- Exibir erro e botão "Tentar Novamente" quando houver falha

**Nova função:**
```
async loadMigrationDetails(moduleName: string)
  - Chamar GET /modules/:name/migrations/status
  - Abrir modal com detalhes
  - Permitir reexecução de migrations falhadas
```

#### 3. Novo Componente - MigrationDetailsDialog

**Propósito:** Exibir detalhes de migrations e seeds de um módulo

**Elementos:**
- Tabela de migrations com status, data, tempo de execução
- Tabela de seeds com status e data
- Botão "Reexecutar" para migrations falhadas
- Indicadores visuais de status (ícones coloridos)
- Mensagens de erro expandíveis

## Fluxo de Trabalho

### Instalação de Novo Módulo

1. Usuário faz upload do módulo ZIP
2. Sistema extrai e valida module.json
3. Sistema copia arquivos para pasta modules/
4. **NOVO:** Sistema chama `ModuleMigrationService.discoverModuleMigrations()`
5. Service escaneia pasta migrations/ e seeds/
6. Service registra todos os arquivos encontrados com status PENDING
7. Sistema executa migrations pendentes (instalação automática)
8. Sistema atualiza status para COMPLETED
9. Sistema redireciona para aba "Módulos Instalados"
10. Módulo aparece com badge "✓ Banco Atualizado"

### Atualização de Módulo Existente

1. Usuário faz upload de nova versão do módulo
2. Sistema substitui arquivos
3. **NOVO:** Sistema chama `discoverModuleMigrations()`
4. Service escaneia e compara checksums:
   - Migrations antigas já executadas: mantém status COMPLETED
   - Migrations novas: cria registro PENDING
   - Migrations modificadas: cria novo registro PENDING (com sufixo no nome)
5. Sistema atualiza versão na tabela modules
6. Se houver pendências, badge muda para "⚠ Atualização Pendente"
7. Botão "Atualizar Banco" aparece
8. Usuário clica e apenas novas migrations são executadas

### Execução Manual de Atualizações

1. Usuário visualiza módulo com badge "⚠ Atualização Pendente"
2. Usuário vê contador: "2 migrations, 1 seed pendentes"
3. Usuário clica em "Atualizar Banco"
4. Frontend chama POST /modules/:name/update-database
5. Backend:
   - Cria backup
   - Busca registros PENDING
   - Executa em ordem
   - Atualiza status de cada um
   - Atualiza databaseVersion
6. Frontend recebe resposta com detalhes
7. Frontend atualiza UI:
   - Remove botão
   - Atualiza badge para "✓ Banco Atualizado"
   - Exibe toast de sucesso

### Tratamento de Erro

1. Durante execução, uma migration falha
2. Backend:
   - Marca migration como FAILED
   - Registra errorMessage
   - Interrompe execução
   - Restaura backup
3. Frontend atualiza UI:
   - Badge "✗ Erro na Atualização"
   - Contador "1 migration falhou"
   - Botão "Tentar Novamente"
4. Usuário clica em "Detalhes"
5. Modal exibe migration falhada com mensagem de erro
6. Usuário pode:
   - Corrigir SQL no arquivo
   - Clicar "Sincronizar" para atualizar checksum
   - Clicar "Reexecutar"

## Considerações Técnicas

### Segurança

- Apenas SUPER_ADMIN pode executar migrations
- Registrar ID do usuário em todas as operações
- Validar integridade de arquivos via checksum
- Prevenir SQL injection em nomes de arquivos
- Logar todas as operações de banco sensíveis

### Performance

- Calcular checksums apenas quando necessário (não a cada listagem)
- Cache de status de pendências por módulo (invalidar após execução)
- Executar discovery apenas em momentos-chave (instalação, atualização, sincronização manual)
- Índices otimizados na tabela de controle

### Confiabilidade

- Backup automático antes de qualquer execução
- Rollback automático em caso de erro
- Transações de banco quando aplicável
- Logs detalhados de cada passo
- Estado consistente mesmo após falhas

### Manutenibilidade

- Service separado para lógica de migrations
- Métodos pequenos e focados
- Testes unitários para cada método crítico
- Documentação inline de regras de negócio
- Nomes descritivos e semânticos

## Impacto em Funcionalidades Existentes

### Módulos Já Instalados

**Problema:** Módulos instalados antes da refatoração não têm registros na tabela de controle

**Solução:** Migration de transição que:
1. Escaneia todos os módulos instalados
2. Para cada módulo:
   - Descobre migrations/seeds
   - Cria registros com status COMPLETED (assumindo que já foram executados)
   - Define checksum atual dos arquivos
   - Define executedAt com data da migration de transição

**Script:** `backend/prisma/migrations/add_module_migration_control.sql`

### Módulos em Desenvolvimento

Desenvolvedores de módulos devem:
- Continuar criando migrations na pasta `migrations/`
- Usar nomenclatura sequencial (001_xxx.sql, 002_xxx.sql)
- Nunca modificar migrations já executadas em produção
- Criar novas migrations para alterações
- Seeds devem ser idempotentes quando possível

## Validações e Regras de Negócio

### Validações de Arquivo

| Validação | Regra |
|-----------|-------|
| Nome do arquivo | Deve seguir padrão: NNN_descricao.sql (onde NNN é numérico) |
| Conteúdo | Deve ser SQL válido (validação básica de sintaxe) |
| Tamanho | Limite de 10MB por arquivo |
| Encoding | UTF-8 obrigatório |
| Extensão | Apenas .sql aceito |

### Regras de Execução

| Regra | Descrição |
|-------|-----------|
| Ordem | Migrations executadas em ordem alfabética de fileName |
| Atomicidade | Uma migration não pode depender de outra na mesma execução |
| Idempotência | Seeds devem verificar existência antes de inserir (recomendado) |
| Rollback | Apenas rollback completo (não rollback individual de migration) |
| Reexecução | Apenas migrations FAILED podem ser reexecutadas |

### Regras de Checksum

| Cenário | Ação |
|---------|------|
| Checksum diferente em arquivo já COMPLETED | Criar novo registro PENDING com sufixo _v2 |
| Checksum igual | Manter registro existente |
| Arquivo removido | Manter registro histórico (não deletar) |
| Arquivo renomeado | Tratar como novo arquivo |

## Testes e Validação

### Casos de Teste Principais

| Caso | Validação |
|------|-----------|
| Instalar módulo com migrations | Migrations executadas e registradas como COMPLETED |
| Instalar módulo sem migrations | Nenhum registro criado, botão não aparece |
| Atualizar módulo com novas migrations | Apenas novas migrations executadas |
| Executar com migration que falha | Status FAILED, backup restaurado, botão permanece |
| Reexecutar migration falhada | Após correção, executa e marca COMPLETED |
| Modificar migration já executada | Nova entrada criada, antiga preservada |
| Módulo com seed | Seed executado e registrado |
| Sincronização manual | Discovery executado, registros atualizados |

### Cenários de Rollback

- Falha na primeira migration: sem alteração no banco
- Falha na segunda migration: primeira migration revertida via backup
- Falha em seed: migrations permanecem, seed marcado FAILED
- Erro de sistema durante execução: estado consistente via transações

## Extensibilidade Futura

### Melhorias Possíveis

- Sistema de rollback individual de migrations (down migrations)
- Dry-run: simular execução sem aplicar mudanças
- Agendamento de execução de migrations
- Notificações quando novas migrations estão disponíveis
- Dashboard de saúde de migrations por módulo
- Exportação de histórico de execuções
- Comparação de schema esperado vs real
- Detecção automática de drift de schema

### Hooks de Extensão

- Pre-migration hook: executar lógica antes da migration
- Post-migration hook: executar lógica após migration
- Validation hook: validar estado do banco após execução
- Notification hook: notificar administradores sobre execuções

## Cronograma de Implementação

### Fase 1: Infraestrutura (Fundação)
- Criar model ModuleMigration no schema Prisma
- Executar migration do Prisma para criar tabela
- Criar ModuleMigrationService básico
- Implementar discovery de arquivos
- Implementar cálculo de checksum

### Fase 2: Controle de Execução
- Implementar métodos de execução controlada
- Integrar com sistema de backup existente
- Implementar tratamento de erros
- Criar endpoints no controller

### Fase 3: Integração Backend
- Refatorar ModuleInstallerService
- Atualizar listInstalledModules
- Atualizar updateModuleDatabase
- Testar fluxos de instalação e atualização

### Fase 4: Interface Frontend
- Atualizar interfaces TypeScript
- Modificar ModuleManagement component
- Criar MigrationDetailsDialog
- Implementar estados visuais

### Fase 5: Migration de Transição
- Criar script de migração para módulos existentes
- Executar discovery em módulos instalados
- Validar dados migrados

### Fase 6: Testes e Validação
- Testes unitários do service
- Testes de integração
- Testes de UI
- Validação em ambiente de staging

### Fase 7: Documentação e Deploy
- Atualizar documentação de desenvolvimento de módulos
- Criar guia de migração
- Deploy em produção
- Monitoramento pós-deploy

## Dependências e Pré-requisitos

### Dependências Técnicas
- Prisma ORM (já instalado)
- Node.js crypto module para checksums (nativo)
- PostgreSQL (já configurado)

### Pré-requisitos
- Backup do banco de dados antes do deploy
- Testar migration de transição em staging
- Documentar módulos existentes e suas migrations
- Comunicar mudanças aos desenvolvedores de módulos

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Migration de transição falha | Média | Alto | Testar extensivamente em staging, ter rollback manual |
| Performance degradada por checksums | Baixa | Médio | Calcular apenas quando necessário, cache de resultados |
| Conflitos com módulos em desenvolvimento | Média | Médio | Documentar mudanças, período de adaptação |
| Dados inconsistentes após erro | Baixa | Alto | Sistema robusto de backup/rollback, transações |
| Checksum diferente por encoding | Baixa | Médio | Normalizar encoding UTF-8, documentar requisito |

## Métricas de Sucesso

- Zero execuções duplicadas de migrations em produção
- Tempo médio de execução de migrations < 30 segundos
- Taxa de erro < 1% das execuções
- 100% dos módulos com controle de migrations após transição
- Redução de 100% de tickets relacionados a migrations duplicadas
- Satisfação dos desenvolvedores de módulos com novo sistema
