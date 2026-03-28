# Instalacao Rapida - Sistema Multitenant Seguro

## Instalacao com Um Comando

### Para Linux/Mac (Bash)

```bash
./install-system.sh
```

### Para Windows (PowerShell)

```powershell
.\install-system.ps1
```

## Opcoes de Instalacao

### Ambiente de Desenvolvimento (Padrao)
```powershell
.\install-system.ps1 -Dev
```

### Ambiente de Producao
```powershell
.\install-system.ps1 -Prod
```

### Ambiente de Staging
```powershell
.\install-system.ps1 -Staging
```

### Configuracoes Personalizadas
```powershell
.\install-system.ps1 -DbPassword "minha_senha" -JwtSecret "meu_secret" -AdminPassword "admin123"
```

## Pre-requisitos

- Docker instalado e em execucao
- Docker Compose instalado
- Git instalado
- Conexao com a internet

## O Que Sera Instalado

1. Verifica pre-requisitos
2. Gera configuracoes seguras (senhas e secrets aleatorios)
3. Cria Docker Compose
4. Inicia containers (banco, backend, frontend)
5. Popula banco de dados (migrations e seed inicial)
6. Mostra credenciais finais

## Credenciais Geradas Automaticamente

### Usuarios do Sistema
- **SUPER_ADMIN**: admin@system.com
- **ADMIN Tenant**: admin@empresa1.com
- **USER Comum**: user@empresa1.com

*Senha padrao sera gerada automaticamente e mostrada no final*

### Acesso aos Servicos
- **Frontend**: http://localhost:5000
- **Backend API**: http://localhost:4000
- **Banco de Dados**: localhost:5432

## Monitoramento Pos-Instalacao

### Verificar status dos containers
```bash
docker-compose -f docker-compose.install.yml ps
```

### Verificar logs
```bash
docker-compose -f docker-compose.install.yml logs
```

### Testar conectividade
```bash
curl http://localhost:4000/health
curl http://localhost:5000/api/health
```

## Troubleshooting

### Problemas Comuns

**Docker nao encontrado**
Instale o Docker Desktop: https://www.docker.com/products/docker-desktop

**Permissoes insuficientes (Linux/Mac)**
```bash
chmod +x install-system.sh
```

**Portas ocupadas**
```bash
# Verificar processos nas portas
netstat -ano | findstr :5000
netstat -ano | findstr :4000
```

### Reiniciar instalacao
```bash
# Parar containers existentes
docker-compose -f docker-compose.install.yml down

# Remover volumes (opcional - apaga dados)
docker volume prune

# Executar instalacao novamente
.\install-system.ps1
```

## Seguranca

### Recomendacoes Pos-Instalacao

1. Altere as senhas padrao em ambientes de producao
2. Configure HTTPS para acesso externo
3. Revise permissoes de usuarios e acesso
4. Configure backups regulares do banco de dados
5. Monitore logs para atividades suspeitas

### Ambientes Recomendados

- **Desenvolvimento**: Use senhas simples, hot reload habilitado
- **Staging**: Configuracoes intermediarias, dados de teste
- **Producao**: Senhas complexas, HTTPS obrigatorio, monitoramento avancado

## Estrutura Criada

```
projeto/
├── .env                      # Configuracoes do ambiente
├── docker-compose.install.yml # Docker Compose da instalacao
├── postgres_data/            # Dados persistentes do banco
├── apps/
│   ├── backend/uploads/      # Uploads do sistema
│   └── ...                   # Codigo fonte
└── ...                       # Outros arquivos
```

## Atualizacoes e Manutencao

### Atualizar sistema
```bash
# Parar sistema atual
docker-compose -f docker-compose.install.yml down

# Pull ultimas alteracoes
git pull

# Reexecutar instalacao
.\install-system.ps1
```

### Backup do sistema
```bash
# Backup do banco de dados
docker-compose -f docker-compose.install.yml exec db pg_dump -U multitenant_user multitenant_db > backup.sql

# Backup completo
docker-compose -f docker-compose.install.yml down
tar -czf backup-completo-$(date +%Y%m%d).tar.gz .
```

## Referencias

- [Documentacao completa](./DOCS/INDICE_DOCUMENTACAO.md)
