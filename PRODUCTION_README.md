# 🚀 Guia de Produção - Sistema Multi-tenant

Este documento contém todas as instruções para colocar o sistema em produção.

## 📋 Pré-requisitos

- Docker e Docker Compose instalados
- Conta no Docker Hub
- Servidor VPS (Ubuntu/Debian recomendado)
- Domínio (opcional)

## 🔐 1. Configuração de Secrets no GitHub

### Acesse: Repositório → Settings → Secrets and variables → Actions

Crie estes secrets **EXATAMENTE** com estes nomes:

```
DOCKERHUB_USERNAME = gorinformaticadev
DOCKERHUB_TOKEN    = [seu_token_do_docker_hub]
DATABASE_URL       = postgresql://user:pass@db:5432/multitenant?schema=public
JWT_SECRET         = [sua_chave_jwt_segura_64_chars]
```

### Como gerar Docker Hub Token:
1. Docker Hub → Account Settings → Security
2. New Access Token → `github-actions-prod`
3. Permissions: ✅ Read, ✅ Write, ✅ Delete
4. **COPIE IMEDIATAMENTE** (token aparece uma vez só)

## 🏗️ 2. CI/CD Pipeline

### Gatilhos Automáticos:
- **Push main/develop**: Lint + Test
- **Push main**: Build Docker + Push
- **Release (tag v*)**: Build versão + Push

### Imagens Geradas:
```
gorinformatica/multitenant-backend:latest
gorinformatica/multitenant-backend:v1.0.0
gorinformatica/multitenant-backend:sha-abc123

gorinformatica/multitenant-frontend:latest
gorinformatica/multitenant-frontend:v1.0.0
gorinformatica/multitenant-frontend:sha-abc123
```

## 🐳 3. Deploy em Produção

### 3.1 Configurar Variáveis de Ambiente

```bash
# Copiar arquivo de exemplo
cp .env.prod.example .env.prod

# Editar com seus valores
nano .env.prod
```

Conteúdo do `.env.prod`:
```bash
# Database
DATABASE_URL=postgresql://user:password@db:5432/multitenant?schema=public
DB_USER=postgres
DB_PASSWORD=sua_senha_super_segura

# JWT
JWT_SECRET=sua_chave_jwt_64_caracteres_minimo
JWT_ACCESS_EXPIRES_IN=15m

# Encryption
ENCRYPTION_KEY=sua_chave_encriptacao_32_caracteres

# Docker Hub
DOCKERHUB_USERNAME=gorinformatica
```

### 3.2 Executar Deploy

```bash
# Tornar script executável (Linux/Mac)
chmod +x scripts/deploy-prod.sh

# Executar deploy
./scripts/deploy-prod.sh
```

### 3.3 Verificar Deploy

```bash
# Status dos containers
docker compose --env-file .env.prod -f docker-compose.prod.yml ps

# Logs dos serviços
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f

# Health checks
curl http://localhost:3001/health  # Backend
curl http://localhost:3000/api/health  # Frontend
```

## 🌐 4. Acesso aos Serviços

Após deploy bem-sucedido:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Database**: localhost:5432 (container interno)
- **Redis**: localhost:6379 (container interno)

## 🔄 5. Versionamento e Rollback

### Criar Nova Versão:
```bash
# Commit das mudanças
git add .
git commit -m "feat: nova funcionalidade"

# Criar tag de versão
git tag v1.1.0
git push origin main --tags
```

### Rollback:
```bash
# Ver versões disponíveis
docker images gorinformatica/multitenant-backend

# Rollback para versão específica
docker tag gorinformatica/multitenant-backend:v1.0.0 gorinformatica/multitenant-backend:latest
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
```

## 📊 6. Monitoramento

### Health Checks:
- Backend: `GET /health`
- Frontend: `GET /api/health`
- Database: PostgreSQL health check
- Redis: Redis ping

### Logs:
```bash
# Todos os logs
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f

# Log específico
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f backend
```

### Métricas:
- Container resource usage
- Application response times
- Database connections
- Error rates

## 🔒 7. Segurança em Produção

### Checklist:
- [ ] JWT secrets com 64+ caracteres
- [ ] Database passwords fortes
- [ ] Encryption keys de 32 caracteres
- [ ] Firewalls configurados
- [ ] SSL/HTTPS habilitado
- [ ] Secrets não em código
- [ ] Docker images atualizadas
- [ ] Backups automáticos

### Hardening:
```bash
# Não executar como root
# Usuários não-root nos containers
# Secrets em variáveis de ambiente
# Network isolada
# Volumes persistentes
# Health checks ativos
```

## 🚀 8. Escalabilidade

### Horizontal Scaling:
```yaml
# docker-compose.prod.yml
services:
  backend:
    deploy:
      replicas: 3
    # Load balancer necessário
```

### Database:
- Connection pooling
- Read replicas
- Backup automático

### Cache:
- Redis cluster
- CDN para assets

## 📝 9. Troubleshooting

### Container não inicia:
```bash
# Verificar logs
docker compose --env-file .env.prod -f docker-compose.prod.yml logs

# Verificar variáveis
docker compose --env-file .env.prod -f docker-compose.prod.yml config
```

### Health check falha:
```bash
# Testar manualmente
curl -f http://localhost:3001/health
curl -f http://localhost:3000/api/health
```

### Database connection:
```bash
# Verificar conexão
docker exec -it multitenant-postgres psql -U postgres -d multitenant
```

## 🎯 10. Próximos Passos

1. **Configurar domínio** e SSL
2. **Backup automático** do database
3. **Monitoring** (Prometheus/Grafana)
4. **Load balancer** (nginx/traefik)
5. **CI/CD avançado** (staging/production)

---

## 📚 Arquivos de Configuração

- `.github/workflows/ci-cd.yml` - CI/CD Pipeline
- `docker-compose.prod.yml` - Produção
- `apps/backend/Dockerfile` - Backend container
- `apps/frontend/Dockerfile` - Frontend container
- `scripts/deploy-prod.sh` - Script de deploy
- `.env.prod.example` - Variáveis exemplo

## ✅ Checklist Final

- [ ] Secrets configurados no GitHub
- [ ] Docker Hub token válido
- [ ] .env.prod configurado
- [ ] Deploy executado com sucesso
- [ ] Health checks passando
- [ ] Backup do database
- [ ] SSL configurado
- [ ] Monitoring ativo

🎉 **Sistema pronto para produção!**