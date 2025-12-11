# 🚀 Guia de Instalação - Sistema de Updates

## ⚡ Instalação Rápida

### 1. **Instalar Dependências**
```bash
cd backend
npm install semver @types/semver
```

### 2. **Executar Migração e Regenerar Prisma**
```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

### 3. **Configurar Variáveis de Ambiente**
Adicione ao arquivo `backend/.env`:
```env
# Sistema de Atualizações
UPDATE_BACKUP_DIR=/var/backups/app
UPDATE_LOG_DIR=/var/log/app-updates
PM2_APP_NAME_BACKEND=backend
PM2_APP_NAME_FRONTEND=frontend
ENCRYPTION_KEY=sua-chave-secreta-muito-forte-aqui
```

### 4. **Criar Diretórios (Linux/Mac)**
```bash
sudo mkdir -p /var/backups/app
sudo mkdir -p /var/log/app-updates
sudo chown -R $USER:$USER /var/backups/app
sudo chown -R $USER:$USER /var/log/app-updates
```

### 5. **Tornar Scripts Executáveis (Linux/Mac)**
```bash
chmod +x backend/scripts/update.sh
chmod +x backend/scripts/cleanup.sh
```

### 6. **Reiniciar Backend**
```bash
cd backend
npm run start:dev
```

## 🎯 Configuração Inicial

### 1. **Acessar Interface**
- URL: `http://localhost:3000/configuracoes/sistema/updates`
- Login: Usuário SUPER_ADMIN

### 2. **Configurar Repositório**
Na aba "Configurações":
- **Usuário GitHub**: seu-usuario
- **Repositório**: nome-do-repositorio  
- **Token**: ghp_xxxxxxxxxxxx (opcional para repos públicos)
- **Branch**: main
- **Package Manager**: npm/pnpm/yarn

### 3. **Testar Conectividade**
- Clique em "Testar Conexão"
- Verifique se a conexão foi bem-sucedida

### 4. **Primeira Verificação**
- Vá para aba "Status & Atualizações"
- Clique em "Verificar Atualizações"

## ✅ Verificação da Instalação

### Corrigir Tipagem Prisma (Após Regenerar)
```bash
# Remover casting temporário (opcional - apenas se necessário)
# Os arquivos já estão funcionais, mas para tipagem completa:
sed -i 's/(this\.prisma as any)\./this.prisma./g' backend/src/update/*.ts
```

### Teste Manual dos Scripts
```bash
# Teste de backup (modo seguro)
cd backend
./scripts/update.sh

# Verificar se backup foi criado
ls -la /var/backups/app/

# Teste de limpeza (simulação)
./scripts/cleanup.sh --dry-run
```

### Teste da API
```bash
# Obter token JWT (substitua com suas credenciais)
TOKEN=$(curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@exemplo.com","password":"senha123"}' \
  | jq -r '.accessToken')

# Testar status
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/update/status
```

## 🔧 Configuração Avançada

### Cron para Limpeza Automática
```bash
# Adicionar ao crontab
crontab -e

# Adicionar linha (limpeza diária às 2h)
0 2 * * * /caminho/para/backend/scripts/cleanup.sh >> /var/log/app-updates/cleanup.log 2>&1
```

### PM2 Ecosystem (Produção)
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'backend',
    script: 'dist/main.js',
    cwd: '/caminho/para/backend',
    env: {
      NODE_ENV: 'production'
    }
  }, {
    name: 'frontend',
    script: 'npm',
    args: 'start',
    cwd: '/caminho/para/frontend',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

## 🚨 Troubleshooting

### Erro: "Prisma não encontrado"
```bash
cd backend
npm run prisma:generate
```

### Erro: "Permissão negada nos scripts"
```bash
chmod +x backend/scripts/*.sh
```

### Erro: "Diretório de backup não existe"
```bash
mkdir -p /var/backups/app
mkdir -p /var/log/app-updates
```

### Erro: "pg_dump não encontrado"
```bash
# Ubuntu/Debian
sudo apt-get install postgresql-client

# CentOS/RHEL
sudo yum install postgresql

# macOS
brew install postgresql
```

## 📋 Checklist Final

- [ ] Dependências instaladas (`semver`)
- [ ] Migração executada (`prisma migrate deploy`)
- [ ] Cliente Prisma regenerado (`prisma generate`)
- [ ] Variáveis de ambiente configuradas
- [ ] Diretórios criados
- [ ] Scripts executáveis
- [ ] Backend reiniciado (sem erros de compilação)
- [ ] Interface acessível
- [ ] Repositório configurado
- [ ] Conectividade testada
- [ ] Primeira verificação executada

## 🎉 Pronto!

O Sistema de Updates está instalado e configurado. Agora você pode:

1. **Verificar atualizações** automaticamente (diário) ou manualmente
2. **Executar atualizações** com backup e rollback automático
3. **Monitorar histórico** de todas as operações
4. **Gerenciar backups** com limpeza automática

Para mais detalhes, consulte `DOCS/SISTEMA_UPDATES_IMPLEMENTADO.md`.