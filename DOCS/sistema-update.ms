# Sistema de Atualização Baseado em Git

## Visão Geral

O Sistema de Atualização Baseado em Git é uma solução completa para gerenciar atualizações de aplicações web de forma segura e automatizada. Ele permite que administradores verifiquem, baixem e apliquem atualizações diretamente do repositório Git, com recursos de backup automático, rollback em caso de falhas e auditoria completa.

## Arquitetura do Sistema

O sistema é composto por três camadas principais:

1. **Backend NestJS**: API REST que gerencia a lógica de atualização
2. **Scripts Shell**: Scripts Bash responsáveis pelas operações do sistema
3. **Interface Frontend**: UI para interação com o usuário

### Componentes Principais

#### 1. UpdateService (Backend)
Serviço responsável por verificar versões disponíveis no repositório Git:
- Executa `git ls-remote --tags origin` para buscar tags remotas
- Compara versões usando a biblioteca `semver`
- Atualiza status no banco de dados
- Suporta configuração de repositório via campos separados (usuário, repositório, token)

#### 2. UpdateCron (Backend)
CronJob que verifica atualizações automaticamente:
- Executa diariamente à meia-noite
- Atualiza status de disponibilidade de atualizações
- Registra logs detalhados com timestamps

#### 3. UpdateController (Backend)
API REST que expõe endpoints para:
- Verificação de status de atualização
- Execução de atualizações
- Consulta de logs e estatísticas
- Teste de conectividade

#### 4. Scripts Shell
- `update.sh`: Script principal de atualização com backup, rollback e reinício automático
- `cleanup.sh`: Script de limpeza automática de backups antigos

## Funcionamento Detalhado

### 1. Verificação de Atualizações

O sistema verifica automaticamente por novas versões a cada 24 horas:

```
1. UpdateCron.executar()
2. UpdateService.checkForUpdates()
3. git ls-remote --tags origin
4. Parse e validação de tags semver
5. Comparação com versão atual
6. Atualização de status no banco de dados
```

### 2. Processo de Atualização

Quando um administrador inicia uma atualização:

```
1. Validação de segurança (usuário SUPER_ADMIN)
2. Criação de lock file para evitar execuções concorrentes
3. Backup completo (arquivos + banco de dados)
4. Checkout da nova versão via Git
5. Instalação de dependências (npm/pnpm)
6. Execução de migrações do banco
7. Build do frontend e backend
8. Reinício dos serviços via PM2
9. Rollback automático em caso de falha
```

### 3. Gestão de Backups

O sistema cria backups automáticos antes de cada atualização:
- Cópia completa dos arquivos da aplicação (excluindo node_modules, .git, etc.)
- Dump completo do banco de dados PostgreSQL
- Armazenamento em `/var/backups/app/` com timestamp
- Limpeza automática de backups antigos (>10 dias, mantendo mínimo de 3)

## Configuração Necessária

### Banco de Dados

Campos adicionais na tabela `system_settings`:
```sql
ALTER TABLE "system_settings" ADD COLUMN "app_version" TEXT;
ALTER TABLE "system_settings" ADD COLUMN "git_token" TEXT;
ALTER TABLE "system_settings" ADD COLUMN "git_username" TEXT;
ALTER TABLE "system_settings" ADD COLUMN "git_repository" TEXT;
ALTER TABLE "system_settings" ADD COLUMN "git_release_branch" TEXT DEFAULT 'main';
ALTER TABLE "system_settings" ADD COLUMN "package_manager" TEXT DEFAULT 'npm';
ALTER TABLE "system_settings" ADD COLUMN "update_check_enabled" BOOLEAN DEFAULT true;
ALTER TABLE "system_settings" ADD COLUMN "last_update_check" TIMESTAMP;
ALTER TABLE "system_settings" ADD COLUMN "available_version" TEXT;
ALTER TABLE "system_settings" ADD COLUMN "update_available" BOOLEAN DEFAULT false;
```

### Variáveis de Ambiente

```env
# Configurações do Sistema de Atualização
UPDATE_BACKUP_DIR=/var/backups/app
UPDATE_LOG_DIR=/var/log/app-updates
PM2_APP_NAME_BACKEND=backend
PM2_APP_NAME_FRONTEND=frontend

# Credenciais do PostgreSQL (já devem existir)
DATABASE_URL=postgresql://usuario:senha@localhost:5432/nome_banco
```

### Permissões Necessárias

- Usuário deve ter permissão para executar comandos Git
- Acesso de leitura/escrita aos diretórios da aplicação
- Permissão para criar backups em `/var/backups/app`
- Permissão para escrever logs em `/var/log/app-updates`
- Acesso ao PostgreSQL para criar dumps

## Endpoints da API

### Verificação de Status
```
GET /api/update/status
- Retorna status atual da aplicação
- Acessível para usuários autenticados
```

### Verificação de Atualizações
```
GET /api/update/check
- Força verificação de novas versões
- Acessível apenas para SUPER_ADMIN
```

### Execução de Atualização
```
POST /api/update/run
- Executa atualização para versão especificada
- Acessível apenas para SUPER_ADMIN
- Body: { "version": "v1.2.3", "packageManager": "npm" }
```

### Logs e Auditoria
```
GET /api/update/logs
- Retorna histórico de atualizações
- Acessível apenas para SUPER_ADMIN

GET /api/update/logs/:id
- Retorna detalhes de uma atualização específica
```

## Scripts Shell

### update.sh

Script principal de atualização com as seguintes características:

1. **Lock Management**: Previne execuções concorrentes
2. **Backup Automático**: Cria backup completo antes da atualização
3. **Rollback Automático**: Restaura versão anterior em caso de falha
4. **Validação de Pré-requisitos**: Verifica ferramentas necessárias
5. **Atualização Completa**: Git checkout, dependências, migrações, build
6. **Reinício de Serviços**: Reinicia aplicação via PM2

Modos de uso:
```bash
# Modo teste (apenas backup)
./scripts/update.sh

# Modo completo (backup + atualização)
./scripts/update.sh v1.2.3 npm
```

### cleanup.sh

Script de limpeza automática:
- Remove backups com mais de 10 dias
- Preserva sempre os 3 backups mais recentes
- Registra operações em logs

```bash
# Executar limpeza
./scripts/cleanup.sh

# Exibir informações dos backups
./scripts/cleanup.sh info
```

## Segurança

### Validações Implementadas

1. **Autenticação**: Todos os endpoints requerem token JWT
2. **Autorização**: Apenas SUPER_ADMIN pode executar atualizações
3. **Rate Limiting**: Limite de requisições por minuto/hora
4. **Validação de Inputs**: Formatos de versão, URLs e paths
5. **Sanitização de Logs**: Tokens e senhas são mascarados
6. **Criptografia**: Tokens Git são armazenados criptografados

### Práticas de Segurança

1. **Tokens Criptografados**: Armazenamento seguro de credenciais
2. **Lock Files**: Prevenção de execuções concorrentes
3. **Timeouts**: Limite de tempo para operações longas
4. **Auditoria**: Registro completo de todas as operações
5. **Rollback Automático**: Recuperação em caso de falhas

## Troubleshooting

### Problemas Comuns

#### Atualização Falhou
```bash
# Verificar logs
tail -100 /var/log/app-updates/update-*.log

# Verificar espaço em disco
df -h

# Verificar conectividade Git
git ls-remote --tags origin
```

#### Atualização Travada
```bash
# Verificar processo em execução
ps aux | grep update.sh

# Verificar lock file
ls -la /tmp/app-update.lock

# Remover lock se travado por mais de 2 horas
rm /tmp/app-update.lock
```

#### Rollback Falhou
Procedimento de emergência:
1. Parar serviços: `pm2 stop all`
2. Identificar backup mais recente: `ls -lt /var/backups/app/`
3. Restaurar arquivos e banco manualmente
4. Reiniciar serviços: `pm2 restart all`

## Manutenção

### Monitoramento Regular

```bash
# Verificar espaço em disco
df -h
du -sh /var/backups/app

# Verificar logs
tail -50 /var/log/app-updates/update-*.log

# Verificar histórico de atualizações
SELECT * FROM update_logs ORDER BY started_at DESC LIMIT 10;
```

### Configuração do Cron

Adicionar ao crontab para limpeza automática:
```bash
# Limpeza diária às 2h da manhã
0 2 * * * /caminho/para/scripts/cleanup.sh >> /var/log/app-updates/cleanup.log 2>&1
```

## Implementação em Outros Projetos

### Passos Necessários

1. **Integração do Backend**
   - Copiar módulo `backend/src/update/`
   - Adicionar campos necessários ao schema do banco
   - Configurar rotas e guards de autenticação

2. **Configuração dos Scripts**
   - Copiar `scripts/update.sh` e `scripts/cleanup.sh`
   - Ajustar paths conforme estrutura do projeto
   - Tornar scripts executáveis: `chmod +x scripts/*.sh`

3. **Configuração do Banco**
   - Executar migrações para adicionar campos
   - Configurar valores iniciais nas settings

4. **Configuração do Sistema**
   - Criar diretórios de backup e logs
   - Configurar permissões adequadas
   - Definir variáveis de ambiente

5. **Integração com PM2**
   - Configurar ecosystem para os serviços
   - Ajustar nomes dos processos no script

### Personalização

Para adaptar a outros projetos:

1. **Estrutura de Diretórios**: Ajustar paths nos scripts
2. **Gerenciador de Pacotes**: Suporta npm, pnpm e yarn
3. **Banco de Dados**: Adaptar scripts para MySQL/MongoDB
4. **Build Commands**: Modificar comandos de build conforme framework
5. **Serviços**: Ajustar reinício para outros process managers

## Conclusão

O Sistema de Atualização Baseado em Git oferece uma solução robusta e segura para manter aplicações web atualizadas. Com recursos de backup automático, rollback inteligente e auditoria completa, ele minimiza riscos e maximiza a confiabilidade do processo de atualização.

A arquitetura modular permite fácil adaptação para diferentes tecnologias e frameworks, tornando-o uma solução versátil para diversos tipos de projetos.