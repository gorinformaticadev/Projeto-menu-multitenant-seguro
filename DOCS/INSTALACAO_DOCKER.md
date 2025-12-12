# 🐳 Instalação com Docker

Este guia descreve como executar o sistema utilizando Docker e Docker Compose.

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter:

- ✅ Docker Engine 20.10+ instalado
- ✅ Docker Compose 1.29+ instalado

## 🚀 Opções de Execução

### Opção 1: Desenvolvimento (Recomendado)

Para desenvolvimento, use o arquivo `docker-compose.dev.yml` que monta os volumes para hot reload:

```bash
# Construir e iniciar todos os serviços
docker-compose -f docker-compose.dev.yml up --build

# Para executar em background
docker-compose -f docker-compose.dev.yml up --build -d

# Parar os serviços
docker-compose -f docker-compose.dev.yml down
```

### Opção 2: Produção

Para ambiente de produção, use o arquivo `docker-compose.yml`:

```bash
# Construir e iniciar todos os serviços
docker-compose up --build

# Para executar em background
docker-compose up --build -d

# Parar os serviços
docker-compose down
```

## 🗂️ Estrutura dos Arquivos Docker

### Backend Dockerfile
- Multi-stage build para otimização
- Usuário não-root para segurança
- Build de produção na imagem final

### Frontend Dockerfile
- Multi-stage build para otimização
- Usuário não-root para segurança
- Build otimizado do Next.js

### Docker Compose (Desenvolvimento)
- PostgreSQL container
- Volumes montados para desenvolvimento
- Hot reload ativado
- Rede interna isolada

### Docker Compose (Produção)
- Configurações otimizadas para produção
- Health checks para monitoramento
- Restart policies
- Variáveis de ambiente externalizadas

## ⚙️ Configuração de Ambiente

### Variáveis de Ambiente

#### Backend (.env)
Copie o arquivo de exemplo e ajuste conforme necessário:

```bash
cd backend
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

#### Frontend (.env.local)
Copie o arquivo de exemplo:

```bash
cd frontend
cp .env.local.example .env.local
# Edite o arquivo .env.local se necessário
```

## 🧪 Executando Comandos nos Containers

### Acessar o shell do container Backend
```bash
docker-compose exec backend sh
```

### Acessar o shell do container Frontend
```bash
docker-compose exec frontend sh
```

### Executar migrações do banco de dados
```bash
# Para ambiente de desenvolvimento
docker-compose -f docker-compose.dev.yml exec backend npm run prisma:migrate

# Para ambiente de produção
docker-compose exec backend npm run prisma:migrate
```

### Popular o banco com dados iniciais
```bash
# Para ambiente de desenvolvimento
docker-compose -f docker-compose.dev.yml exec backend npx ts-node prisma/seed.ts

# Para ambiente de produção
docker-compose exec backend npx ts-node prisma/seed.ts
```

## 📊 Monitoramento

### Ver logs em tempo real
```bash
# Todos os serviços
docker-compose logs -f

# Serviço específico
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db
```

### Ver status dos serviços
```bash
docker-compose ps
```

## 🔧 Troubleshooting

### Erro: "Port already in use"
```bash
# Verificar processos usando portas
docker-compose ps

# Parar todos os containers
docker-compose down

# Remover containers parados
docker container prune
```

### Erro: "Cannot connect to database"
1. Verifique se o serviço `db` está rodando:
   ```bash
   docker-compose ps
   ```

2. Verifique as variáveis de ambiente de conexão:
   ```bash
   docker-compose exec backend printenv | grep DATABASE
   ```

### Erro: "Module not found"
```bash
# Reconstruir os containers
docker-compose down
docker-compose up --build
```

## 🎯 Acessar o Sistema

Após iniciar os serviços, acesse:

- **Frontend**: http://localhost:5000
- **Backend API**: http://localhost:4000
- **Banco de dados**: localhost:5432 (PostgreSQL)

### Credenciais de Teste

#### 🔑 SUPER_ADMIN (Acesso Total)
```
Email: admin@system.com
Senha: admin123
```

#### 🔑 ADMIN (Tenant)
```
Email: admin@empresa1.com
Senha: admin123
```

#### 🔑 USER (Usuário Comum)
```
Email: user@empresa1.com
Senha: user123
```

## 🛡️ Segurança

### Imagens
- Usuários não-root nas imagens de produção
- Multi-stage builds para reduzir superfície de ataque
- Imagens base Alpine para menor tamanho

### Rede
- Isolamento de rede entre serviços
- Somente portas necessárias expostas

### Volumes
- Persistência de dados do banco
- Montagem seletiva de volumes para desenvolvimento

## 🔄 CI/CD

O projeto inclui configuração para GitHub Actions em `.github/workflows/ci-cd.yml` que realiza:

1. Testes automatizados
2. Build das imagens Docker
3. Push para registry (quando configurado)

## 📚 Próximos Passos

1. **Explorar o código-fonte**
2. **Testar diferentes níveis de acesso**
3. **Adicionar novas funcionalidades**
4. **Consultar a documentação completa**

## 🆘 Precisa de Ajuda?

1. Verifique esta documentação
2. Consulte a documentação completa em `README.md`
3. Abra uma issue no repositório