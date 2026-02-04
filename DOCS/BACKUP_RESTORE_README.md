# Funcionalidade de Backup e Restore de Banco de Dados

## Visão Geral

Funcionalidade completa de backup e restore do banco de dados PostgreSQL integrada na página de configurações do sistema (`/configuracoes/sistema/updates`).

## Funcionalidades Implementadas

### Backend (NestJS)

#### Módulo: `BackupModule`
Localização: `apps/backend/src/backup/`

**Componentes:**
- `backup.controller.ts` - Controller com endpoints REST
- `backup.service.ts` - Lógica de negócio para backup/restore
- `backup.module.ts` - Módulo NestJS com dependências
- `dto/create-backup.dto.ts` - DTO para criação de backup
- `dto/restore-backup.dto.ts` - DTO para restore

**Endpoints Disponíveis:**

1. **POST /api/backup/create**
   - Cria backup completo do banco de dados
   - Rate limit: 5 requisições por hora
   - Retorna metadados e URL de download

2. **GET /api/backup/download/:backupId**
   - Download de arquivo de backup gerado
   - Stream de arquivo com headers apropriados

3. **POST /api/backup/restore**
   - Restaura banco de dados a partir de arquivo
   - Rate limit: 2 requisições por hora
   - Requer confirmação textual "CONFIRMAR"

4. **POST /api/backup/validate**
   - Valida arquivo de backup antes de processar
   - Verifica formato, tamanho e integridade

5. **GET /api/backup/logs**
   - Retorna histórico de operações
   - Suporta filtros por tipo e status
   - Limite máximo de 200 registros

#### Banco de Dados

**Nova Tabela: `backup_logs`**

Armazena histórico de todas as operações de backup e restore:
- ID único
- Tipo de operação (BACKUP ou RESTORE)
- Status (STARTED, SUCCESS, FAILED, CANCELLED)
- Nome do arquivo
- Tamanho do arquivo
- Timestamps de início e conclusão
- Duração em segundos
- Usuário executor
- IP de origem
- Mensagem de erro (se houver)
- Metadados adicionais (JSON)

**Enums Adicionados:**
- `BackupOperation`: BACKUP, RESTORE
- `BackupStatus`: STARTED, SUCCESS, FAILED, CANCELLED

#### Segurança

- ✅ Acesso restrito a SUPER_ADMIN
- ✅ Rate limiting rigoroso
- ✅ Validação de arquivos
- ✅ Auditoria completa de operações
- ✅ Backup de segurança antes de restore
- ✅ Sanitização de entrada

#### Comandos PostgreSQL Utilizados

**Backup:**
```bash
pg_dump --host=$DB_HOST --port=$DB_PORT --username=$DB_USER --dbname=$DB_NAME --format=custom --file=backup.dump
```

**Restore:**
```bash
pg_restore --host=$DB_HOST --port=$DB_PORT --username=$DB_USER --dbname=$DB_NAME --clean --if-exists --no-owner --no-acl --verbose backup.dump
```

### Frontend (Next.js)

#### Componentes

**Localização:** `apps/frontend/src/app/configuracoes/sistema/updates/components/`

1. **BackupSection.tsx**
   - Interface para criar backups
   - Download automático após criação
   - Feedback visual de progresso
   - Informações sobre o processo

2. **RestoreSection.tsx**
   - Upload de arquivos com drag-and-drop
   - Validação em tempo real
   - Modal de confirmação com avisos
   - Campo de confirmação textual obrigatório
   - Feedback de progresso durante restore

#### Nova Aba na Página de Updates

**Aba "Backup & Restore"** adicionada à navegação com:
- Seção de Backup
- Seção de Restore
- Histórico de operações de backup/restore

## Fluxo de Uso

### Criar Backup

1. Acesse `/configuracoes/sistema/updates`
2. Clique na aba "Backup & Restore"
3. Clique em "Criar Backup Agora"
4. Aguarde processamento (indicador de progresso)
5. Download inicia automaticamente
6. Operação registrada no histórico

### Restaurar Backup

1. Na aba "Backup & Restore"
2. Selecione arquivo de backup (.sql, .dump, .backup)
3. Sistema valida arquivo automaticamente
4. Se válido, clique em "Restaurar Backup"
5. Leia avisos no modal de confirmação
6. Digite "CONFIRMAR" no campo
7. Confirme operação
8. Aguarde conclusão (backup de segurança criado automaticamente)
9. Operação registrada no histórico

## Segurança e Confiabilidade

### Validações

- ✅ Extensão de arquivo (.sql, .dump, .backup)
- ✅ Tamanho máximo (2GB por padrão)
- ✅ Conteúdo do arquivo (verifica se é PostgreSQL dump)
- ✅ Confirmação textual obrigatória para restore

### Proteções

- ✅ Backup de segurança automático antes de restore
- ✅ Operações executadas com timeout (15 minutos)
- ✅ Geração de checksum SHA256 para integridade
- ✅ Arquivos temporários limpos automaticamente
- ✅ Todas as operações auditadas

### Tratamento de Erros

- ✅ Mensagens claras e acionáveis
- ✅ Logs detalhados para debugging
- ✅ Rollback em caso de falha
- ✅ Estado do sistema preservado

## Variáveis de Ambiente

Adicione ao `.env` do backend:

```env
# Backup Configuration
BACKUP_MAX_SIZE=2147483648        # 2GB em bytes
BACKUP_TIMEOUT=900                # 15 minutos em segundos
BACKUP_TEMP_DIR=temp/backups      # Diretório temporário
BACKUP_RETENTION_HOURS=1          # Tempo de retenção de arquivos
```

## Migration

A migration foi criada e aplicada:
```bash
npx prisma migrate dev --name add-backup-logs
```

Arquivo gerado: `prisma/migrations/20260120123848_add_backup_logs/migration.sql`

## Testes Recomendados

1. **Teste de Backup:**
   - Criar backup com banco vazio
   - Criar backup com dados
   - Verificar integridade do arquivo
   - Testar download

2. **Teste de Restore:**
   - Restaurar backup válido
   - Tentar restaurar arquivo inválido
   - Verificar criação de backup de segurança
   - Verificar dados após restore

3. **Teste de Segurança:**
   - Tentar acessar sem autenticação
   - Tentar acessar com usuário não-SUPER_ADMIN
   - Verificar rate limiting
   - Tentar upload de arquivo malicioso

4. **Teste de Interface:**
   - Validação de arquivo em tempo real
   - Modal de confirmação
   - Feedback de progresso
   - Exibição de erros

## Limitações Conhecidas

1. Operações síncronas - grandes bancos podem demorar
2. Timeout configurado em 15 minutos
3. Tamanho máximo de arquivo: 2GB
4. Requer ferramentas PostgreSQL (`pg_dump`, `pg_restore`) no servidor

## Melhorias Futuras

- [ ] Processamento assíncrono com WebSockets para progresso em tempo real
- [ ] Compressão adicional de arquivos
- [ ] Backup incremental
- [ ] Agendamento automático de backups
- [ ] Armazenamento em cloud (S3, Google Cloud Storage)
- [ ] Notificações por email após operações

## Autor

Implementado conforme design document: `backup-and-restore-feature.md`

Data de Implementação: 20 de Janeiro de 2026
