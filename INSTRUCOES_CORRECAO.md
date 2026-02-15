# Instruções para Correção dos Erros 502

## Resumo dos Problemas Identificados

1. **Backend crashando por falta de permissões** - Tentando criar `/app/src/modules` sem permissão
2. **Banco de dados sem migrações** - Tabela `modules` não existe
3. **DATABASE_URL mal formatada** - Hostname vazio no entrypoint

## Arquivos Corrigidos

Criei versões corrigidas dos seguintes arquivos:

1. `apps/backend/Dockerfile.FIXED` - Corrige permissões de diretórios
2. `apps/backend/docker-entrypoint.sh.FIXED` - Corrige extração do hostname e habilita migrações

---

## Passo a Passo para Aplicar as Correções

### 1️⃣ Fazer Backup dos Arquivos Originais

```bash
cd /home/ubuntu/Projeto-menu-multitenant-seguro
cp apps/backend/Dockerfile apps/backend/Dockerfile.backup
cp apps/backend/docker-entrypoint.sh apps/backend/docker-entrypoint.sh.backup
```

### 2️⃣ Baixar os Arquivos Corrigidos do Repositório

Você tem duas opções:

**Opção A: Aplicar correções manualmente**

Edite os arquivos diretamente no servidor:

```bash
nano apps/backend/Dockerfile
```

Adicione/modifique a linha 55 para:
```dockerfile
RUN mkdir -p /app/uploads/logos /app/backups /app/modules /app/src/modules && \
    chown -R nestjs:nodejs /app/uploads /app/backups /app/modules /app/src
```

Depois edite o entrypoint:
```bash
nano apps/backend/docker-entrypoint.sh
```

Modifique a linha 7 para:
```bash
DB_HOST=$(echo "${DATABASE_URL}" | sed -n 's|.*@\([^:]*\):.*|\1|p')
```

E adicione após a linha 8:
```bash
if [ -z "$DB_HOST" ]; then
  DB_HOST="localhost"
fi
```

E modifique a linha 37 para habilitar migrações por padrão:
```bash
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
```

**Opção B: Fazer commit das correções e pull no servidor**

Vou fazer commit das correções no repositório e você faz pull no servidor.

---

### 3️⃣ Verificar a DATABASE_URL

```bash
cat install/.env.production | grep DATABASE_URL
```

**Formato correto**:
```
DATABASE_URL="postgresql://postgres:SENHA@db:5432/multitenant?schema=public"
```

Se estiver diferente, corrija:
```bash
nano install/.env.production
```

---

### 4️⃣ Rebuild e Restart dos Containers

```bash
cd /home/ubuntu/Projeto-menu-multitenant-seguro

# Parar containers
docker compose --env-file install/.env.production -f docker-compose.prod.yml down

# Rebuild do backend (força reconstrução)
docker compose --env-file install/.env.production -f docker-compose.prod.yml build --no-cache backend

# Subir novamente
docker compose --env-file install/.env.production -f docker-compose.prod.yml up -d

# Acompanhar logs do backend
docker logs -f multitenant-backend
```

---

### 5️⃣ Verificar se Funcionou

Após alguns segundos, execute:

```bash
# Verificar status
docker ps

# Testar endpoint de saúde
docker exec multitenant-nginx wget -O- http://backend:4000/api/health

# Verificar logs
docker logs multitenant-backend --tail 50
```

**Resultado esperado**:
- Container `multitenant-backend` deve estar "healthy"
- O comando wget deve retornar um JSON de saúde
- Logs devem mostrar "listening on port 4000"

---

## Qual Opção Você Prefere?

**A)** Aplicar as correções manualmente no servidor (mais rápido, mas manual)

**B)** Eu faço commit no GitHub e você faz pull (mais limpo, mas requer acesso ao Git)

Me avise qual opção prefere e podemos prosseguir!
