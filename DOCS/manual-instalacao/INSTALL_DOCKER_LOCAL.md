# Instalação Docker Local (Simulação de Produção)

Este guia descreve como rodar a **versão de produção** da aplicação em sua máquina local. Isso é útil para verificar se o build de produção está funcionando corretamente antes de realizar o deploy em um servidor real.

**Atenção:** Neste modo, não há *hot-reload*. As alterações no código só serão refletidas após re-construir as imagens.

## Pré-requisitos

1.  **Docker Desktop**.
2.  **Git**.

## Passo a Passo

### 1. Preparar Arquivo de Ambiente

Crie o arquivo de ambiente de produção local. Usaremos o exemplo do instalador como base.

```bash
cp install/.env.installer.example install/.env.production
```

Edite o arquivo `install/.env.production` e ajuste as URLs para `localhost`:

```ini
DOMAIN=localhost
FRONTEND_URL=http://localhost:5000
NEXT_PUBLIC_API_URL=http://localhost:4000/api
# Demais credenciais de banco e JWT podem ser mantidas ou geradas
```

### 2. Construir e Iniciar (Build Local)

Como estamos rodando localmente e provavelmente não queremos baixar imagens do registro (GHCR), forçaremos o build local das imagens de produção.

Use o comando abaixo para compilar o Frontend e Backend otimizados:

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.prod.build.yml --env-file install/.env.production up -d --build
```

**Nota:** O processo de build de produção pode levar alguns minutos, pois o Next.js realiza otimizações estáticas.

### 3. Configurar Banco de Dados

O banco de produção inicia vazio. É necessário rodar as migrações (deploy):

```bash
docker compose -f docker-compose.prod.yml --env-file install/.env.production exec backend npx prisma migrate deploy
```

Rodar seeds (se necessário):
```bash
docker compose -f docker-compose.prod.yml --env-file install/.env.production exec backend npx prisma db seed
```

### 4. Acessar a Aplicação

Neste cenário local sem Nginx reverso configurado para SSL (autossignado), acessaremos diretamente os serviços expostos (se as portas estiverem mapeadas no docker-compose.prod.yml, caso contrário, precisaremos ajustar).

O `docker-compose.prod.yml` padrão **não expõe portas do backend/frontend diretamente** para a máquina host (elas ficam atrás do Nginx interno).

Para acessar localmente, a melhor estratégia é usar o Nginx incluso na stack:

1.  Garanta que o `hosts` do seu windows aponte um domínio fictício, ex: `app.local`, para `127.0.0.1`.
2.  Configure o `install/.env.production` com `DOMAIN=app.local`.
3.  O Nginx estará ouvindo na porta 80 e 443 locais.

Se preferir acesso direto via IP/Porta (sem Nginx), você precisará criar um arquivo `docker-compose.override.yml` temporário para expor as portas:

```yaml
# docker-compose.override.yml
services:
  frontend:
    ports:
      - "5000:5000"
  backend:
    ports:
      - "4000:4000"
```

E rodar:
```bash
docker compose -f docker-compose.prod.yml -f docker-compose.prod.build.yml -f docker-compose.override.yml --env-file install/.env.production up -d
```

### 5. Limpar Ambiente

Para parar e remover os volumes (resetar banco):

```bash
docker compose -f docker-compose.prod.yml --env-file install/.env.production down -v
```
