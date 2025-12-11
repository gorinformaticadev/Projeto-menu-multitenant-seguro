# 🚀 Sistema de Atualizações - README

## 📋 Visão Geral

Sistema completo de atualizações automáticas via Git, implementado seguindo as especificações da documentação `sistema-update.ms` e as regras de desenvolvimento estabelecidas.

## ⚡ Instalação Rápida

```bash
# 1. Instalar dependências
cd backend
npm install semver @types/semver

# 2. Executar migração
npx prisma migrate deploy

# 3. Configurar .env (adicionar)
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env
echo "UPDATE_BACKUP_DIR=/var/backups/app" >> .env
echo "UPDATE_LOG_DIR=/var/log/app-updates" >> .env

# 4. Reiniciar backend
npm run start:dev
```

## 🎯 Acesso Rápido

- **Interface**: `http://localhost:3000/configuracoes/sistema/updates`
- **Navegação**: Menu → Configurações → Sistema de Atualizações
- **API Status**: `GET /api/update/status`
- **Logs**: `/var/log/app-updates/`
- **Backups**: `/var/backups/app/`

## 📚 Documentação

| Arquivo | Descrição |
|---------|-----------|
| `SISTEMA_UPDATES_IMPLEMENTADO.md` | Documentação completa da implementação |
| `GUIA_INSTALACAO_SISTEMA_UPDATES.md` | Guia detalhado de instalação |
| `sistema-update.ms` | Especificação original do sistema |

## 🔧 Funcionalidades

- ✅ **Verificação Automática**: CronJob diário para novas versões
- ✅ **Backup Automático**: Backup completo antes de cada atualização
- ✅ **Rollback Inteligente**: Recuperação automática em caso de falha
- ✅ **Interface Web**: Dashboard completo para administradores
- ✅ **Auditoria Completa**: Logs detalhados de todas as operações
- ✅ **Segurança**: Acesso restrito a SUPER_ADMIN com rate limiting

## 🚨 Requisitos

- **Backend**: NestJS 10+ com TypeScript
- **Banco**: PostgreSQL com Prisma ORM
- **Sistema**: Linux/Mac (scripts bash)
- **Ferramentas**: Git, Node.js, PM2, pg_dump

## 🔒 Segurança

- **Autenticação**: JWT + Guards
- **Autorização**: Apenas SUPER_ADMIN
- **Rate Limiting**: Proteção contra abuso
- **Criptografia**: Tokens Git criptografados
- **Validação**: DTOs com class-validator

## 📊 Endpoints

```http
GET  /api/update/status           # Status do sistema
GET  /api/update/check            # Verificar atualizações
POST /api/update/execute          # Executar atualização
PUT  /api/update/config           # Configurar sistema
GET  /api/update/logs             # Histórico
GET  /api/update/test-connection  # Testar Git
```

## 🛠️ Scripts

```bash
# Atualização completa
./backend/scripts/update.sh v1.2.3 npm

# Apenas backup (teste)
./backend/scripts/update.sh

# Limpeza de backups
./backend/scripts/cleanup.sh

# Instalação automática
./backend/scripts/install-update-system.sh
```

## 🎯 Configuração Inicial

1. **Acessar**: Menu → Configurações → Sistema de Atualizações
2. **Configurar**: Repositório Git na aba "Configurações"
3. **Testar**: Conectividade com o repositório
4. **Verificar**: Primeira verificação de atualizações

## 📈 Monitoramento

```bash
# Status dos serviços
pm2 status

# Logs de atualização
tail -f /var/log/app-updates/update-*.log

# Espaço em disco
df -h /var/backups/app

# Backups disponíveis
ls -la /var/backups/app/
```

## 🚨 Troubleshooting

| Problema | Solução |
|----------|---------|
| Erro de permissão | `chmod +x backend/scripts/*.sh` |
| Diretório não existe | `mkdir -p /var/backups/app /var/log/app-updates` |
| pg_dump não encontrado | Instalar PostgreSQL client |
| Prisma não atualizado | `npx prisma generate` |

## 📞 Suporte

- **Documentação**: Pasta `DOCS/`
- **Logs**: `/var/log/app-updates/`
- **Issues**: Verificar logs de erro
- **Backup**: Sempre disponível em `/var/backups/app/`

## ✅ Status da Implementação

- ✅ Backend NestJS completo
- ✅ Scripts de automação
- ✅ Interface frontend
- ✅ Banco de dados
- ✅ Documentação
- ✅ Segurança
- ✅ Testes básicos

## 🎉 Pronto para Uso!

O sistema está completamente implementado e pronto para uso em produção. Siga o guia de instalação e configure conforme suas necessidades.