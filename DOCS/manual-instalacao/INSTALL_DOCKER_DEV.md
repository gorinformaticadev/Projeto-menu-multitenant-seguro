# Instalação Docker (Desenvolvimento)

Este guia descreve como configurar o ambiente de desenvolvimento local usando Docker. É ideal para programadores que desejam trabalhar no código fonte.

## Pré-requisitos

1.  **Docker Desktop** (com integração WSL2 no Windows).
2.  **Git** instalado.
3.  **Node.js** (opcional, mas recomendado para rodar scripts auxiliares).

## Passo a Passo

### 1. Clonar o Repositório

```bash
git clone https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro.git
cd Projeto-menu-multitenant-seguro
```

### 2. Configurar Variáveis de Ambiente

Copie os arquivos de exemplo para criar suas configurações locais. O Docker Compose de desenvolvimento já injeta valores padrão, mas é boa prática ter os arquivos `.env`.

**Backend:**
```bash
cp apps/backend/.env.example apps/backend/.env
```

**Frontend:**
```bash
cp apps/frontend/.env.example apps/frontend/.env.local
```

### 3. Iniciar o Ambiente

Execute o comando abaixo para construir as imagens e iniciar os containers em modo de desenvolvimento (com *hot-reload*):

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

Isso iniciará:
*   **PostgreSQL** (Porta 5432)
*   **Backend API** (Porta 4000)
*   **Frontend Next.js** (Porta 5000)

### 4. Configurar o Banco de Dados

Com os containers rodando, execute as migrações para criar as tabelas:

```bash
docker exec -it multitenant-backend pnpm prisma migrate dev --name init
```

Opcionalmente, popule o banco com dados de teste:
```bash
docker exec -it multitenant-backend pnpm prisma db seed
```

### 5. Acessar a Aplicação

*   **Frontend:** [http://localhost:5000](http://localhost:5000)
*   **API:** [http://localhost:4000/api/health](http://localhost:4000/api/health)
*   **Swagger Docs:** [http://localhost:4000/api](http://localhost:4000/api)

### 6. Comandos Úteis

*   **Ver logs:** `docker compose -f docker-compose.dev.yml logs -f`
*   **Parar containers:** `docker compose -f docker-compose.dev.yml down`
*   **Reconstruir containers:** `docker compose -f docker-compose.dev.yml build --no-cache`
