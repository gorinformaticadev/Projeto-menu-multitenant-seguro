# 🚀 Instalação Rápida - Sistema Multitenant Seguro

## 🎯 Instalação com Um Comando

Instale o sistema completo com apenas um comando!

### Para Windows (PowerShell)

```powershell
.\install-system.ps1
```

### Para Linux/Mac (Bash)

```bash
./install-system.sh
```

## 🛠️ Opções de Instalação

### Ambiente de Desenvolvimento (Padrão)
```powershell
.\install-system.ps1 -Dev
```

### Ambiente de Produção
```powershell
.\install-system.ps1 -Prod
```

### Ambiente de Staging
```powershell
.\install-system.ps1 -Staging
```

### Configurações Personalizadas
```powershell
.\install-system.ps1 -DbPassword "minha_senha" -JwtSecret "meu_secret" -AdminPassword "admin123"
```

## 📋 Pré-requisitos

Antes de executar a instalação, certifique-se de ter:

- ✅ **Docker** instalado e em execução
- ✅ **Docker Compose** instalado
- ✅ **Git** instalado
- ✅ Conexão com a internet

## 🎯 O Que Será Instalado

O script irá:

1. **Verificar pré-requisitos** - Confirma que tudo está instalado corretamente
2. **Gerar configurações seguras** - Cria senhas e secrets aleatórios
3. **Criar Docker Compose** - Configura o ambiente de containers
4. **Iniciar containers** - Sobe os serviços (banco, backend, frontend)
5. **Popular banco de dados** - Executa migrations e seed inicial
6. **Mostrar credenciais** - Exibe todas as informações de acesso

## 🔑 Credenciais Geradas Automaticamente

Após a instalação, você receberá:

### Usuários do Sistema
- **SUPER_ADMIN**: admin@system.com
- **ADMIN Tenant**: admin@empresa1.com  
- **USER Comum**: user@empresa1.com

*Senha padrão será gerada automaticamente e mostrada no final*

### Acesso aos Serviços
- **Frontend**: http://localhost:5000
- **Backend API**: http://localhost:4000
- **Banco de Dados**: localhost:5432

## 📊 Monitoramento Pós-Instalação

### Verificar status dos containers
```powershell
docker-compose -f docker-compose.install.yml ps
```

### Verificar logs
```powershell
docker-compose -f docker-compose.install.yml logs
```

### Testar conectividade
```powershell
curl http://localhost:4000/health
curl http://localhost:5000/api/health
```

## 🆘 Troubleshooting

### Problemas Comuns

**Docker não encontrado**
```
Instale o Docker Desktop: https://www.docker.com/products/docker-desktop
```

**Permissões insuficientes (Linux/Mac)**
```bash
chmod +x install-system.sh
```

**Portas ocupadas**
```powershell
# Verificar processos nas portas
netstat -ano | findstr :5000
netstat -ano | findstr :4000
```

### Reiniciar instalação
```powershell
# Parar containers existentes
docker-compose -f docker-compose.install.yml down

# Remover volumes (opcional - apaga dados)
docker volume prune

# Executar instalação novamente
.\install-system.ps1
```

## 🛡️ Segurança

### Recomendações Pós-Instalação

1. **Altere as senhas padrão** em ambientes de produção
2. **Configure HTTPS** para acesso externo
3. **Revise permissões** de usuários e acesso
4. **Configure backups** regulares do banco de dados
5. **Monitore logs** para atividades suspeitas

### Ambientes Recomendados

- **Desenvolvimento**: Use senhas simples, hot reload habilitado
- **Staging**: Configurações intermediárias, dados de teste
- **Produção**: Senhas complexas, HTTPS obrigatório, monitoramento avançado

## 📁 Estrutura Criada

```
projeto/
├── .env                      # Configurações do ambiente
├── docker-compose.install.yml # Docker Compose da instalação
├── postgres_data/            # Dados persistentes do banco
├── apps/
│   ├── backend/uploads/      # Uploads do sistema
│   └── ...                   # Código fonte
└── ...                       # Outros arquivos
```

## 🔄 Atualizações e Manutenção

### Atualizar sistema
```powershell
# Parar sistema atual
docker-compose -f docker-compose.install.yml down

# Pull últimas alterações
git pull

# Reexecutar instalação
.\install-system.ps1
```

### Backup do sistema
```powershell
# Backup do banco de dados
docker-compose -f docker-compose.install.yml exec db pg_dump -U multitenant_user multitenant_db > backup.sql

# Backup completo
docker-compose -f docker-compose.install.yml down
tar -czf backup-completo-$(date +%Y%m%d).tar.gz .
```

## 💡 Dicas Úteis

### Acesso rápido ao sistema
```powershell
# Abrir frontend no navegador
start http://localhost:5000

# Abrir backend no navegador  
start http://localhost:4000/docs
```

### Desenvolvimento contínuo
```powershell
# Ver logs em tempo real
docker-compose -f docker-compose.install.yml logs -f

# Reiniciar serviço específico
docker-compose -f docker-compose.install.yml restart backend
```

---

**Precisa de ajuda?** Consulte a [documentação completa](./DOCS/INDICE_DOCUMENTACAO.md) ou abra uma issue.# 🚀 Instalação Rápida - Sistema Multitenant Seguro

## 🎯 Instalação com Um Comando

Instale o sistema completo com apenas um comando!

### Para Windows (PowerShell)

```powershell
.\install-system.ps1
```

### Para Linux/Mac (Bash)

```bash
./install-system.sh
```

## 🛠️ Opções de Instalação

### Ambiente de Desenvolvimento (Padrão)
```powershell
.\install-system.ps1 -Dev
```

### Ambiente de Produção
```powershell
.\install-system.ps1 -Prod
```

### Ambiente de Staging
```powershell
.\install-system.ps1 -Staging
```

### Configurações Personalizadas
```powershell
.\install-system.ps1 -DbPassword "minha_senha" -JwtSecret "meu_secret" -AdminPassword "admin123"
```

## 📋 Pré-requisitos

Antes de executar a instalação, certifique-se de ter:

- ✅ **Docker** instalado e em execução
- ✅ **Docker Compose** instalado
- ✅ **Git** instalado
- ✅ Conexão com a internet

## 🎯 O Que Será Instalado

O script irá:

1. **Verificar pré-requisitos** - Confirma que tudo está instalado corretamente
2. **Gerar configurações seguras** - Cria senhas e secrets aleatórios
3. **Criar Docker Compose** - Configura o ambiente de containers
4. **Iniciar containers** - Sobe os serviços (banco, backend, frontend)
5. **Popular banco de dados** - Executa migrations e seed inicial
6. **Mostrar credenciais** - Exibe todas as informações de acesso

## 🔑 Credenciais Geradas Automaticamente

Após a instalação, você receberá:

### Usuários do Sistema
- **SUPER_ADMIN**: admin@system.com
- **ADMIN Tenant**: admin@empresa1.com  
- **USER Comum**: user@empresa1.com

*Senha padrão será gerada automaticamente e mostrada no final*

### Acesso aos Serviços
- **Frontend**: http://localhost:5000
- **Backend API**: http://localhost:4000
- **Banco de Dados**: localhost:5432

## 📊 Monitoramento Pós-Instalação

### Verificar status dos containers
```powershell
docker-compose -f docker-compose.install.yml ps
```

### Verificar logs
```powershell
docker-compose -f docker-compose.install.yml logs
```

### Testar conectividade
```powershell
curl http://localhost:4000/health
curl http://localhost:5000/api/health
```

## 🆘 Troubleshooting

### Problemas Comuns

**Docker não encontrado**
```
Instale o Docker Desktop: https://www.docker.com/products/docker-desktop
```

**Permissões insuficientes (Linux/Mac)**
```bash
chmod +x install-system.sh
```

**Portas ocupadas**
```powershell
# Verificar processos nas portas
netstat -ano | findstr :5000
netstat -ano | findstr :4000
```

### Reiniciar instalação
```powershell
# Parar containers existentes
docker-compose -f docker-compose.install.yml down

# Remover volumes (opcional - apaga dados)
docker volume prune

# Executar instalação novamente
.\install-system.ps1
```

## 🛡️ Segurança

### Recomendações Pós-Instalação

1. **Altere as senhas padrão** em ambientes de produção
2. **Configure HTTPS** para acesso externo
3. **Revise permissões** de usuários e acesso
4. **Configure backups** regulares do banco de dados
5. **Monitore logs** para atividades suspeitas

### Ambientes Recomendados

- **Desenvolvimento**: Use senhas simples, hot reload habilitado
- **Staging**: Configurações intermediárias, dados de teste
- **Produção**: Senhas complexas, HTTPS obrigatório, monitoramento avançado

## 📁 Estrutura Criada

```
projeto/
├── .env                      # Configurações do ambiente
├── docker-compose.install.yml # Docker Compose da instalação
├── postgres_data/            # Dados persistentes do banco
├── apps/
│   ├── backend/uploads/      # Uploads do sistema
│   └── ...                   # Código fonte
└── ...                       # Outros arquivos
```

## 🔄 Atualizações e Manutenção

### Atualizar sistema
```powershell
# Parar sistema atual
docker-compose -f docker-compose.install.yml down

# Pull últimas alterações
git pull

# Reexecutar instalação
.\install-system.ps1
```

### Backup do sistema
```powershell
# Backup do banco de dados
docker-compose -f docker-compose.install.yml exec db pg_dump -U multitenant_user multitenant_db > backup.sql

# Backup completo
docker-compose -f docker-compose.install.yml down
tar -czf backup-completo-$(date +%Y%m%d).tar.gz .
```

## 💡 Dicas Úteis

### Acesso rápido ao sistema
```powershell
# Abrir frontend no navegador
start http://localhost:5000

# Abrir backend no navegador  
start http://localhost:4000/docs
```

### Desenvolvimento contínuo
```powershell
# Ver logs em tempo real
docker-compose -f docker-compose.install.yml logs -f

# Reiniciar serviço específico
docker-compose -f docker-compose.install.yml restart backend
```

---

**Precisa de ajuda?** Consulte a [documentação completa](./DOCS/INDICE_DOCUMENTACAO.md) ou abra uma issue.