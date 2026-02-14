# Instalador automatizado – Projeto Menu Multitenant

Script de instalação e atualização para o monorepo, alinhado à pasta `multitenant-docker-acme` e ao fluxo de CI/CD (build e deploy via GitHub Actions).

## Requisitos

- **Sistema:** Linux (testado em Debian/Ubuntu).
- **Privilégios:** execução como root (`sudo`).
- **Dependências:** Docker e Docker Compose (plugin v2). O script tenta instalar o Docker se não estiver presente; o Compose deve estar instalado (ex.: `apt-get install docker-compose-plugin`).
- **Rede:** servidor com acesso à internet para pull de imagens e, se usar certificado, domínio apontando para o host.

## Uso

### Instalação inicial

A partir da raiz do repositório:

```bash
sudo bash install/install.sh install [OPÇÕES]
```

**Opções:**

| Opção | Descrição |
|-------|-----------|
| `-d`, `--domain DOMAIN` | Domínio principal (ex.: `app.empresa.com.br`) |
| `-e`, `--email EMAIL` | Email para Let's Encrypt e administrador |
| `-u`, `--docker-user USER` | Usuário Docker Hub das imagens (ex.: `gorinformaticadev`) |
| `-a`, `--admin-email EMAIL` | Email do admin (default: mesmo de `-e`) |
| `-p`, `--admin-pass SENHA` | Senha inicial do admin (default: `123456`) |
| `-n`, `--no-prompt` | Não perguntar; usar apenas variáveis de ambiente |

**Exemplos:**

```bash
# Interativo (o script pergunta domínio, email, etc.)
sudo bash install/install.sh install

# Com parâmetros
sudo bash install/install.sh install -d menu.empresa.com.br -e admin@empresa.com.br -u gorinformaticadev

# Não interativo (variáveis de ambiente)
sudo INSTALL_DOMAIN=app.empresa.com LETSENCRYPT_EMAIL=admin@empresa.com DOCKERHUB_USERNAME=gorinformaticadev \
  bash install/install.sh install --no-prompt
```

### Atualização

```bash
sudo bash install/install.sh update [branch]
```

- Sem argumentos: faz pull das imagens e reinicia os containers com `docker-compose.prod.yml`.
- Com `branch`: atualiza o repositório Git para a branch indicada e depois pull + restart (ex.: `update develop`).

**Exemplos:**

```bash
sudo bash install/install.sh update
sudo bash install/install.sh update main
```

## Variáveis de ambiente

O instalador gera/atualiza o `.env` na **raiz do projeto**. Além das variáveis já usadas pelo `docker-compose` e pelas apps, foram adicionadas as seguintes, pensadas para o momento da instalação e multitenancy:

### Novas variáveis (instalação)

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `INSTALL_DOMAIN` | Sim* | Domínio principal da instalação (espelho de `DOMAIN`). |
| `LETSENCRYPT_EMAIL` | Sim* | Email para Let's Encrypt e notificações. |
| `DOCKERHUB_USERNAME` | Sim* | Usuário Docker Hub para `multitenant-frontend:latest` e `multitenant-backend:latest`. |
| `INSTALL_ADMIN_EMAIL` | Não | Email do primeiro administrador (default: `LETSENCRYPT_EMAIL`). |
| `INSTALL_ADMIN_PASSWORD` | Não | Senha inicial do admin (default: `123456`). |

\* Na instalação interativa podem ser informadas pela linha de comando; em modo `--no-prompt` devem estar definidas no ambiente.

### Variáveis já existentes (preenchidas/geradas pelo instalador)

- **Domínio:** `DOMAIN`, `FRONTEND_URL`, `NEXT_PUBLIC_API_URL`, `VIRTUAL_HOST`, `LETSENCRYPT_HOST`
- **Banco:** `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DATABASE_URL`
- **Segredos:** `JWT_SECRET`, `ENCRYPTION_KEY` (gerados se não existirem)
- **Ambiente:** `NODE_ENV`, `PORT`

O template completo está em `install/.env.installer.example`. O instalador usa esse arquivo como base quando existe; caso contrário usa o `.env.example` da raiz.

## Fluxo do instalador

1. **Checagens:** Bash, root, Docker e Docker Compose.
2. **Instalação:**
   - Cria/atualiza `.env` (a partir de `.env.installer.example` ou `.env.example`).
   - Gera `JWT_SECRET` e `ENCRYPTION_KEY` se não definidos.
   - Gera senha do banco se não definida.
   - Preenche/atualiza variáveis de domínio, admin e Docker Hub.
   - Cria `nginx/conf.d` e `nginx/certs` e gera `nginx/conf.d/default.conf` a partir do template em `multitenant-docker-acme/confs/nginx-multitenant.conf` (quando existir).
   - Executa `docker compose -f docker-compose.prod.yml pull`, `down` e `up -d`.
3. **Atualização:** (opcional) checkout da branch; `docker compose -f docker-compose.prod.yml pull`, `down`, `up -d`.

Isso segue a mesma ideia de criação de containers, instalação inicial e rotina de atualização da pasta `multitenant-docker-acme`.

## Multitenancy

O instalador está preparado para cenário multitenant:

- Um único domínio é configurado por execução (`INSTALL_DOMAIN` / `-d`).
- Para vários tenants, pode-se rodar o instalador em diretórios ou ambientes diferentes (um `.env` por tenant) ou usar depois o proxy/ACME existente (por exemplo `install-acme` / `update-acme`) para integrar múltiplos domínios.

A configuração de Nginx gerada usa o template em `multitenant-docker-acme/confs/nginx-multitenant.conf`; os certificados SSL devem ser obtidos manualmente ou por outro mecanismo (ex.: certbot) até que o nginx do `docker-compose.prod.yml` esteja integrado a um ACME automático.

## Resiliência e erros

- O script usa `set -Eeuo pipefail` e `trap ... ERR` para falhar na primeira falha e exibir mensagem de erro.
- Se o Docker não estiver instalado, o script tenta instalar via `get.docker.com`.
- Se o Docker Compose não existir, o script informa e encerra com instrução de instalação.
- Email é validado por regex.
- Falhas em `docker compose pull` ou `up -d` interrompem o script com mensagem clara.

## Compatibilidade com CI/CD

O instalador não altera o pipeline em `.github/workflows/ci-cd.yml`:

- As imagens continuam sendo construídas a partir da raiz do monorepo (`context: .`, `apps/backend/Dockerfile`, `apps/frontend/Dockerfile`) e tagadas como `DOCKER_USERNAME/multitenant-backend:latest` e `.../multitenant-frontend:latest`.
- O instalador apenas consome essas imagens via `DOCKERHUB_USERNAME` no `.env` e usa o mesmo `docker-compose.prod.yml` (nginx + frontend + backend + db + redis), garantindo que a lógica de deploy seja respeitada.

## Arquivos envolvidos

| Arquivo | Função |
|---------|--------|
| `install/install.sh` | Script principal (install / update). |
| `install/.env.installer.example` | Template de variáveis com as novas opções de instalação. |
| `install/README-INSTALADOR.md` | Este guia. |
| `docker-compose.prod.yml` | Stack usada pelo instalador (nginx, frontend, backend, db, redis). |
| `multitenant-docker-acme/confs/nginx-multitenant.conf` | Template de Nginx (domínio substituído pelo instalador). |

## Resumo das variáveis novas no `.env`

As variáveis **novas** que o instalador adiciona ou documenta no `.env` são:

- `INSTALL_DOMAIN` – domínio da instalação.
- `INSTALL_ADMIN_EMAIL` – email do administrador.
- `INSTALL_ADMIN_PASSWORD` – senha inicial do admin.
- `DOCKERHUB_USERNAME` – usuário Docker Hub das imagens (já usado pelo compose; o instalador garante que exista no `.env`).

As demais (`DOMAIN`, `LETSENCRYPT_EMAIL`, `DB_*`, `JWT_SECRET`, `ENCRYPTION_KEY`, etc.) já existiam; o instalador apenas as preenche ou gera quando necessário.
