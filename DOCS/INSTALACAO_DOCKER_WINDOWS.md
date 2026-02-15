# 🐳 Guia de Instalação Docker Local (Windows)

Este guia cobre a instalação e execução do projeto em ambiente de desenvolvimento local no Windows, utilizando Docker Desktop.

## ✅ Pré-requisitos

1.  **Docker Desktop** instalado e rodando.
    *   [Download Docker Desktop](https://www.docker.com/products/docker-desktop/)
    *   Certifique-se de que o **WSL 2** está configurado como backend (recomendado).
2.  **Git** instalado.
    *   [Download Git](https://git-scm.com/download/win)
3.  **Terminal**: PowerShell, CMD ou Git Bash.

---

## 🚀 Passo a Passo

### 1. Clonar o Repositório

Abra seu terminal e clone o projeto para uma pasta de sua preferência.

```bash
git clone https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro.git
cd Projeto-menu-multitenant-seguro
```

### 2. Configurar Variáveis de Ambiente

O ambiente Docker de produção local utiliza um arquivo específico para carregar as variáveis. Vamos criar uma cópia do exemplo.

1.  Vá até a pasta `install`.
2.  Copie o arquivo `.env.production.local.example` (ou `.env.production`) para `.env.production`.
    *   *Nota: Se não houver um exemplo específico para local, crie um arquivo `install/.env.production` com o seguinte conteúdo básico:*

```bash
# install/.env.production

# Configurações de Domínio (Localhost)
DOMAIN=localhost
FRONTEND_URL=http://localhost:5000
NEXT_PUBLIC_API_URL=http://localhost:4000/api
# Nota: Em Docker local sem Nginx proxy, o frontend acessa o backend diretamente na porta 4000.
# Se usar o Nginx incluso no docker-compose.prod.yml, use http://localhost:80/api

# Banco de Dados
DB_USER=multitenant
DB_PASSWORD=multitenant
DB_NAME=multitenant_db
DATABASE_URL=postgresql://multitenant:multitenant@db:5432/multitenant_db?schema=public

# Secrets (Gere strings aleatórias se for produção, para local pode ser simples)
JWT_SECRET=segredo_local_jwt_123
ENCRYPTION_KEY=chave_secreta_local_32_chars_1234567

# Ambiente
NODE_ENV=production
PORT=4000
```

### 3. Ajustes para Windows (Permissões)

O Docker no Windows pode ter problemas com permissões de volumes. Para evitar erros ao subir o backend:

1.  Certifique-se de que não existem volumes antigos conflitantes:
    ```powershell
    docker volume rm projeto-menu-multitenant-seguro_uploads
    ```
    *(Este comando removerá uploads antigos. Pule se não quiser perder dados, mas saiba que pode gerar erro de permissão EACCES).*

### 4. Subir os Containers

Execute o comando abaixo na raiz do projeto. Ele instrui o Docker Compose a usar o arquivo de produção, mas lendo as variáveis que definimos.

```powershell
docker compose --env-file install/.env.production -f docker-compose.prod.yml up -d --build
```

*   `--env-file`: Carrega as variáveis do arquivo que criamos.
*   `-f`: Usa o arquivo de composição de produção.
*   `-d`: Roda em segundo plano (detached).
*   `--build`: Força a recriação das imagens (garante que alterações recentes no código sejam aplicadas).

### 5. Configurar o Banco de Dados

Após os containers subirem, o banco de dados estará vazio. Precisamos criar as tabelas (migrations) e popular com dados iniciais (seeds).

1.  Aguarde o backend iniciar (veja os logs com `docker logs -f multitenant-backend`).
2.  Quando vir a mensagem "Nest application successfully started", abra um novo terminal e rode:

```powershell
# Criar tabelas
docker exec -it multitenant-backend npx prisma migrate deploy

# (Opcional) Popular dados iniciais - se houver seeds configurados
docker exec -it multitenant-backend npx prisma db seed
```

### 6. Acessar o Projeto

*   **Frontend:** [http://localhost:5000](http://localhost:5000) (ou http://localhost se o Nginx estiver ativo na porta 80).
*   **Backend API:** [http://localhost:4000/api](http://localhost:4000/api)
*   **Healthcheck:** [http://localhost:4000/api/health](http://localhost:4000/api/health)

---

## 🛠️ Comandos Úteis (Dia a Dia)

### Parar Tudo
```powershell
docker compose -f docker-compose.prod.yml down
```

### Ver Logs (Backend)
```powershell
docker logs -f multitenant-backend
```

### Reiniciar Apenas o Backend (após alterar código)
```powershell
docker compose --env-file install/.env.production -f docker-compose.prod.yml restart backend
```
*(Nota: Para alterações de código surtirem efeito real em produção, é ideal fazer o rebuild: `docker compose ... up -d --build backend`)*

## ⚠️ Solução de Problemas Comuns

**Erro: "permission denied, mkdir '/app/uploads'..."**
*   **Causa:** Volume Docker criado com usuário root.
*   **Solução:**
    ```powershell
    docker compose -f docker-compose.prod.yml down
    docker volume rm projeto-menu-multitenant-seguro_uploads
    docker compose --env-file install/.env.production -f docker-compose.prod.yml up -d
    ```

**Erro: "Connection refused" no banco de dados**
*   **Causa:** O container do banco ainda não está pronto quando o backend tenta conectar.
*   **Solução:** O backend reiniciará automaticamente até conseguir. Apenas aguarde alguns segundos.
