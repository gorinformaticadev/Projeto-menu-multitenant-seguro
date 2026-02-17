
> Segurança: NUNCA versione segredos reais em arquivos .env no Git. Use variáveis no ambiente/secret manager e mantenha apenas exemplos no repositório.
# Instalador automatizado â€“ Projeto Menu Multitenant

Script de instalaÃ§Ã£o e atualizaÃ§Ã£o para o monorepo, alinhado Ã  pasta `multitenant-docker-acme` e ao fluxo de CI/CD (build e deploy via GitHub Actions).

## Requisitos

- **Sistema:** Linux (testado em Debian/Ubuntu).
- **PrivilÃ©gios:** execuÃ§Ã£o como root (`sudo`).
- **DependÃªncias:** Docker e Docker Compose (plugin v2). O script tenta instalar o Docker se nÃ£o estiver presente; o Compose deve estar instalado (ex.: `apt-get install docker-compose-plugin`).
- **Rede:** servidor com acesso Ã  internet para pull de imagens e, se usar certificado, domÃ­nio apontando para o host.

## Uso

### InstalaÃ§Ã£o inicial

A partir da raiz do repositÃ³rio:

```bash
sudo bash install/install.sh install [OPÃ‡Ã•ES]
```

**OpÃ§Ãµes:**

| OpÃ§Ã£o | DescriÃ§Ã£o |
|-------|-----------|
| `-d`, `--domain DOMAIN` | DomÃ­nio principal (ex.: `app.empresa.com.br`) |
| `-e`, `--email EMAIL` | Email para Let's Encrypt e administrador |
| `-u`, `--docker-user USER` | UsuÃ¡rio Docker Hub das imagens (ex.: `gorinformaticadev`) |
| `-a`, `--admin-email EMAIL` | Email do admin (default: mesmo de `-e`) |
| `-p`, `--admin-pass SENHA` | Senha inicial do admin (default: `123456`) |
| `-n`, `--no-prompt` | NÃ£o perguntar; usar apenas variÃ¡veis de ambiente |

**Exemplos:**

```bash
# Interativo (o script pergunta domÃ­nio, email, etc.)
sudo bash install/install.sh install

# Com parÃ¢metros
sudo bash install/install.sh install -d menu.empresa.com.br -e admin@empresa.com.br -u gorinformaticadev

# NÃ£o interativo (variÃ¡veis de ambiente)
sudo INSTALL_DOMAIN=app.empresa.com LETSENCRYPT_EMAIL=admin@empresa.com DOCKERHUB_USERNAME=gorinformaticadev \
  bash install/install.sh install --no-prompt
```

### AtualizaÃ§Ã£o

```bash
sudo bash install/install.sh update [branch]
```

- Sem argumentos: faz pull das imagens e reinicia os containers com `docker-compose.prod.yml`.
- Com `branch`: atualiza o repositÃ³rio Git para a branch indicada e depois pull + restart (ex.: `update develop`).

**Exemplos:**

```bash
sudo bash install/install.sh update
sudo bash install/install.sh update main
```

### Obter ou renovar certificado Let's Encrypt

Se na instalaÃ§Ã£o o certificado nÃ£o foi obtido (ex.: DNS ainda nÃ£o apontava), ou para renovar manualmente:

```bash
sudo bash install/install.sh cert
```

Usa `DOMAIN` e `LETSENCRYPT_EMAIL` de `install/.env.production`. Para renovaÃ§Ã£o automÃ¡tica (cron), use `install/renew-cert.sh`.

### VerificaÃ§Ã£o do ambiente

Para conferir se Docker, containers, Nginx, portas e certificados estÃ£o corretos, use o script de checagem (a partir da **raiz do projeto**):

```bash
bash install/check.sh
```

O script verifica:

| VerificaÃ§Ã£o | DescriÃ§Ã£o |
|-------------|-----------|
| **Docker** | Instalado e daemon em execuÃ§Ã£o |
| **Docker Compose** | Plugin disponÃ­vel |
| **docker-compose.prod.yml** | Arquivo presente na raiz |
| **Containers** | ExistÃªncia e status de: `multitenant-nginx`, `multitenant-frontend`, `multitenant-backend`, `multitenant-postgres`, `multitenant-redis` (running e healthy quando houver healthcheck) |
| **Nginx** | Arquivo de config em `nginx/conf.d/default.conf` |
| **Portas** | 80 e 443 em escuta no host (`ss` ou `netstat`) |
| **Certificado** | ExistÃªncia e validade de `nginx/certs/cert.pem` e `nginx/certs/key.pem` |
| **Teste HTTP/HTTPS** | `curl` em `http://127.0.0.1:80/` e `https://127.0.0.1:443/` |

No final o script mostra um resumo de `docker compose ps` e o resultado dos curls. Para saÃ­da em uma linha (ex.: logs), use:

```bash
bash install/check.sh --json
```

### Comandos manuais (stack de produÃ§Ã£o)

Sempre a partir da **raiz do monorepo**, usando o env em `install/`:

```bash
cd /caminho/Projeto-menu-multitenant-seguro

# Subir
docker compose --env-file install/.env.production -f docker-compose.prod.yml up -d

# Parar
docker compose --env-file install/.env.production -f docker-compose.prod.yml down

# Build (ex.: apÃ³s alterar backend/frontend)
docker compose --env-file install/.env.production -f docker-compose.prod.yml build
docker compose --env-file install/.env.production -f docker-compose.prod.yml up -d
```

## VariÃ¡veis de ambiente

O instalador grava as variÃ¡veis em dois lugares:

- **`install/.env.production`** â€“ usado pela stack Docker (Compose com `--env-file install/.env.production`). NÃ£o fica `.env` na raiz do monorepo.
- **`apps/backend/.env`** e **`apps/frontend/.env.local`** â€“ criados a partir de `.env.example` e `.env.local.example`, com os mesmos valores da instalaÃ§Ã£o. Servem para desenvolvimento local e para manter a mesma estrutura do projeto original; os containers em produÃ§Ã£o recebem as variÃ¡veis pelo Compose, nÃ£o por esses arquivos.

AlÃ©m das variÃ¡veis jÃ¡ usadas pelo `docker-compose` e pelas apps, foram adicionadas as seguintes:

### Novas variÃ¡veis (instalaÃ§Ã£o)

| VariÃ¡vel | ObrigatÃ³ria | DescriÃ§Ã£o |
|----------|-------------|-----------|
| `INSTALL_DOMAIN` | Sim* | DomÃ­nio principal da instalaÃ§Ã£o (espelho de `DOMAIN`). |
| `LETSENCRYPT_EMAIL` | Sim* | Email para Let's Encrypt e notificaÃ§Ãµes. |
| `DOCKERHUB_USERNAME` | Sim* | UsuÃ¡rio Docker Hub para `multitenant-frontend:latest` e `multitenant-backend:latest`. |
| `INSTALL_ADMIN_EMAIL` | NÃ£o | Email do primeiro administrador (default: `LETSENCRYPT_EMAIL`). |
| `INSTALL_ADMIN_PASSWORD` | NÃ£o | Senha inicial do admin (default: `123456`). |

\* Na instalaÃ§Ã£o interativa podem ser informadas pela linha de comando; em modo `--no-prompt` devem estar definidas no ambiente.

### VariÃ¡veis jÃ¡ existentes (preenchidas/geradas pelo instalador)

- **DomÃ­nio:** `DOMAIN`, `FRONTEND_URL`, `NEXT_PUBLIC_API_URL`, `VIRTUAL_HOST`, `LETSENCRYPT_HOST`
- **Banco:** `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DATABASE_URL`
- **Segredos:** `JWT_SECRET`, `ENCRYPTION_KEY` (gerados se nÃ£o existirem)
- **Ambiente:** `NODE_ENV`, `PORT`

O template completo estÃ¡ em `install/.env.installer.example`. O instalador usa esse arquivo como base quando existe; caso contrÃ¡rio usa o `.env.example` da raiz.

## Fluxo do instalador

1. **Checagens:** Bash, root, Docker e Docker Compose.
2. **InstalaÃ§Ã£o:**
   - Cria/atualiza `install/.env.production` (a partir de `.env.installer.example` ou `.env.example`).
   - Cria `apps/backend/.env` e `apps/frontend/.env.local` a partir dos `.env.example` e `.env.local.example` do projeto, preenchendo com os mesmos valores (uso em desenvolvimento local ou referÃªncia; a stack Docker usa apenas `install/.env.production`).
   - Gera `JWT_SECRET` e `ENCRYPTION_KEY` se nÃ£o definidos.
   - Gera senha do banco se nÃ£o definida.
   - Preenche/atualiza variÃ¡veis de domÃ­nio, admin e Docker Hub.
   - Cria `nginx/conf.d` e `nginx/certs`; gera `default.conf` a partir de `install/nginx-docker.conf.template` (upstream por nome de serviÃ§o: `frontend:5000`, `backend:4000`) e gera certificado autoassinado para HTTPS.
   - Executa `docker compose -f docker-compose.prod.yml pull` (ou build local se falhar), `down` e `up -d`.
3. **AtualizaÃ§Ã£o:** (opcional) checkout da branch; `docker compose -f docker-compose.prod.yml pull`, `down`, `up -d`.

Isso segue a mesma ideia de criaÃ§Ã£o de containers, instalaÃ§Ã£o inicial e rotina de atualizaÃ§Ã£o da pasta `multitenant-docker-acme`.

## Multitenancy

O instalador estÃ¡ preparado para cenÃ¡rio multitenant:

- Um Ãºnico domÃ­nio Ã© configurado por execuÃ§Ã£o (`INSTALL_DOMAIN` / `-d`).
- Para vÃ¡rios tenants, pode-se rodar o instalador em diretÃ³rios ou ambientes diferentes (um `.env` por tenant) ou usar depois o proxy/ACME existente (por exemplo `install-acme` / `update-acme`) para integrar mÃºltiplos domÃ­nios.

O instalador gera a config Nginx e **tenta obter certificado Let's Encrypt** automaticamente (apÃ³s subir a stack). Se o domÃ­nio jÃ¡ estiver apontando para o servidor e a porta 80 acessÃ­vel, o certificado vÃ¡lido Ã© instalado em `nginx/certs/`. Caso contrÃ¡rio, Ã© usado um certificado autoassinado (aviso no navegador atÃ© obter Let's Encrypt).

## ResiliÃªncia e erros

- O script usa `set -Eeuo pipefail` e `trap ... ERR` para falhar na primeira falha e exibir mensagem de erro.
- Se o Docker nÃ£o estiver instalado, o script tenta instalar via `get.docker.com`.
- Se o Docker Compose nÃ£o existir, o script informa e encerra com instruÃ§Ã£o de instalaÃ§Ã£o.
- Email Ã© validado por regex.
- Falhas em `docker compose pull` ou `up -d` interrompem o script com mensagem clara.

## Compatibilidade com CI/CD

O instalador nÃ£o altera o pipeline em `.github/workflows/ci-cd.yml`:

- As imagens continuam sendo construÃ­das a partir da raiz do monorepo (`context: .`, `apps/backend/Dockerfile`, `apps/frontend/Dockerfile`) e tagadas como `DOCKER_USERNAME/multitenant-backend:latest` e `.../multitenant-frontend:latest`.
- O instalador apenas consome essas imagens via `DOCKERHUB_USERNAME` em `install/.env.production` e usa o mesmo `docker-compose.prod.yml` (nginx + frontend + backend + db + redis), garantindo que a lÃ³gica de deploy seja respeitada.

## SoluÃ§Ã£o de problemas

- **Certificado vÃ¡lido (Let's Encrypt):** O instalador tenta obter o cert automaticamente. Se falhar (DNS nÃ£o apontando, porta 80 bloqueada), rode depois: `sudo bash install/install.sh cert` (usa DOMAIN e LETSENCRYPT_EMAIL de `install/.env.production`). Para renovaÃ§Ã£o automÃ¡tica, agende: `0 3 * * * root /caminho/Projeto-menu-multitenant-seguro/install/renew-cert.sh`.
- **Aviso de certificado:** Se ainda aparecer aviso, o Let's Encrypt nÃ£o foi obtido; use o comando `cert` acima apÃ³s garantir que o domÃ­nio aponta para o servidor e a porta 80 estÃ¡ aberta.

- **NÃ£o consigo fazer login:** O backend precisa de `FRONTEND_URL` com a URL pÃºblica (ex.: `https://seu-dominio.com`) para CORS aceitar o browser; e o frontend precisa chamar a API pela mesma origem (`/api`). Confira em `install/.env.production`: `FRONTEND_URL=https://SEU_DOMINIO`. Reconstrua a imagem do frontend para que a URL da API seja relativa: `docker compose --env-file install/.env.production -f docker-compose.prod.yml build --no-cache frontend` e depois `up -d`.

- **502 Bad Gateway em HTTP** ou **"NÃ£o foi possÃ­vel acessar este site" em HTTPS**: o Nginx precisa usar os nomes dos serviÃ§os Docker (`frontend:5000`, `backend:4000`), nÃ£o `127.0.0.1`. O instalador usa `install/nginx-docker.conf.template`. Se a instalaÃ§Ã£o foi feita antes dessa alteraÃ§Ã£o, reexecute o instalador (com o mesmo domÃ­nio) ou copie manualmente:
  - `install/nginx-docker.conf.template` â†’ `nginx/conf.d/default.conf` (substitua `__DOMAIN__` pelo seu domÃ­nio).
  - Gere certificado em `nginx/certs/`: `openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout nginx/certs/key.pem -out nginx/certs/cert.pem -subj "/CN=SEU_DOMINIO"`.
  - Reinicie: `docker compose -f docker-compose.prod.yml restart nginx`.
- **HTTPS com certificado invÃ¡lido**: o certificado autoassinado gera aviso no navegador; Ã© esperado. Para produÃ§Ã£o, use Let's Encrypt e coloque os arquivos em `nginx/certs/` (ex.: `cert.pem` e `key.pem`).

## Arquivos envolvidos

| Arquivo | FunÃ§Ã£o |
|---------|--------|
| `install/install.sh` | Script principal (install / update). |
| `install/check.sh` | Script de verificaÃ§Ã£o (Docker, containers, Nginx, portas, certificados). |
| `install/renew-cert.sh` | RenovaÃ§Ã£o Let's Encrypt (para cron). |
| `install/nginx-docker.conf.template` | Template Nginx para Docker (HTTP + HTTPS). |
| `install/nginx-docker-http-only.conf.template` | Template sÃ³ HTTP (quando nÃ£o hÃ¡ cert). |
| `install/.env.installer.example` | Template de variÃ¡veis. |
| `install/.env.production` | Arquivo de env da stack (gerado pelo instalador; nÃ£o commitar). |
| `install/README-INSTALADOR.md` | Este guia. |
| `docker-compose.prod.yml` | Stack (nginx, frontend, backend, db, redis). |

## Resumo das variÃ¡veis novas em `install/.env.production`

As variÃ¡veis **novas** que o instalador adiciona ou documenta em `install/.env.production` sÃ£o:

- `INSTALL_DOMAIN` â€“ domÃ­nio da instalaÃ§Ã£o.
- `INSTALL_ADMIN_EMAIL` â€“ email do administrador.
- `INSTALL_ADMIN_PASSWORD` â€“ senha inicial do admin.
- `DOCKERHUB_USERNAME` â€“ usuÃ¡rio Docker Hub das imagens (o instalador garante que exista em `install/.env.production`).

As demais (`DOMAIN`, `LETSENCRYPT_EMAIL`, `DB_*`, `JWT_SECRET`, `ENCRYPTION_KEY`, etc.) jÃ¡ existiam; o instalador apenas as preenche ou gera quando necessÃ¡rio.


