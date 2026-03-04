# Sistema Menu Multitenant Seguro

Plataforma SaaS multitenant orientada a isolamento de dados, seguranca operacional e implantacao simplificada via Docker. Projetado para operacao continua em producao com arquitetura modular pronta para evolucao funcional.

------------------------------------------------------------------------

## Visao Geral

Este repositorio entrega uma stack completa para aplicacoes SaaS multitenant:

- API backend em **NestJS** com autenticacao, autorizacao e isolamento por tenant
- Frontend administrativo moderno em **Next.js**
- Scripts oficiais para instalacao, atualizacao e remocao
- Estrutura documental centralizada para operacao e manutencao

Objetivo principal:

> Garantir isolamento entre clientes, facilidade de deploy e manutencao previsivel.

------------------------------------------------------------------------

## Principais Caracteristicas Tecnicas

### Arquitetura

- Multitenancy com separacao logica por tenant
- Backend modular preparado para expansao
- Frontend desacoplado e escalavel
- Docker Compose pronto para producao

### Operacao

- Scripts oficiais versionados
- Documentacao tecnica consolidada
- Fluxo controlado de update
- Base pronta para CI/CD

### Seguranca

- Controle de acesso centralizado
- Isolamento entre tenants
- Estrutura preparada para TLS e proxy reverso

------------------------------------------------------------------------

## Estrutura do Repositorio

```text
apps/
  backend/      -> API NestJS
  frontend/     -> Aplicacao Next.js

install/
  install.sh
  update.sh
  uninstall.sh
  scripts auxiliares

DOCS/           -> Documentacao tecnica e operacional
Scripts/        -> Scripts auxiliares e testes manuais
```

------------------------------------------------------------------------

## Instalacao Oficial

Sempre utilize os scripts da pasta `install/`.

### Instalacao inicial

```bash
sudo bash install/install.sh install -d crm.example.com.br -e seuemail@email.com -u gorinformatica
```

Alternativa interativa:

```bash
sudo bash install/install.sh install
```

------------------------------------------------------------------------

## Manuais de Instalação Detalhados

Para procedimentos passo a passo específicos, consulte os manuais abaixo:

- **[Instalação Docker - Desenvolvimento](DOCS/manual-instalacao/INSTALL_DOCKER_DEV.md)**: Guia para rodar o ambiente de desenvolvimento localmente.
- **[Instalação Docker - Local (Prod)](DOCS/manual-instalacao/INSTALL_DOCKER_LOCAL.md)**: Guia para rodar/testar o build de produção localmente.
- **[Instalação VPS - Produção](DOCS/manual-instalacao/INSTALL_VPS_PROD.md)**: Procedimento oficial para deploy em servidor VPS de Produção.
- **[Instalação VPS - Dev/Staging](DOCS/manual-instalacao/INSTALL_VPS_DEV.md)**: Procedimento para deploy em servidor VPS de Desenvolvimento/Homologação.

------------------------------------------------------------------------

## Atualizacao do Sistema

### Fluxo recomendado

```bash
sudo bash install/install.sh update
```

### Atualizacao pela branch desejada

```bash
sudo bash install/install.sh update main
```

### Atualizador interativo (legado, mantido no projeto)

```bash
sudo bash install/update.sh
```

------------------------------------------------------------------------

## Desinstalacao

```bash
sudo bash install/uninstall.sh
```

Scripts auxiliares:

- `install/check.sh` -> valida ambiente
- `install/restore-db.sh` -> wrapper de restore via API interna (Docker)
- `install/restore-native.sh` -> wrapper de restore via API interna (instalacao native/PM2)
- `install/renew-cert.sh` -> renovar certificado

------------------------------------------------------------------------

## Restore Operacional (API oficial)

Fluxo oficial de restore:

1. Restore do dump em `staging database`
2. Validacao de integridade/schema
3. Maintenance mode + quiesce (cron pausado e Prisma desconectado)
4. Promocao por swap/rename (`staging -> ativa`)
5. Smoke test + opcional `prisma migrate deploy`
6. Maintenance OFF + cron retomado

Wrappers manuais (`install/restore-db.sh` e `install/restore-native.sh`) **nao executam pg_restore direto no banco principal**.
Eles apenas chamam a API interna localhost e fazem polling do job.

Variaveis minimas para wrappers:

```bash
export BACKUP_INTERNAL_API_TOKEN="<token interno>"
export BACKUP_FILE="nome_do_backup.dump"
```

Opcional:

```bash
export BACKEND_INTERNAL_URL="http://127.0.0.1:4000/api"
export BACKUP_INTERNAL_TRUST_PROXY=false
export BACKUP_INTERNAL_ALLOWED_CIDRS="127.0.0.1/32,::1/128"
export BACKUP_INTERNAL_TRUSTED_PROXY_CIDRS="10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"
export RUN_MIGRATIONS=true
bash install/restore-db.sh
```

-----------------------------------------------------------------------

## Reset Completo do Ambiente

Por seguranca, este README **nao** inclui sequencia destrutiva automatica de reset (ex.: `git reset --hard`, purge completo de Docker, remocao forcada de diretorios).

Se precisar de reset completo, siga este fluxo:

1. Execute `install/uninstall.sh`
2. Reclone o repositorio
3. Rode nova instalacao com `install/install.sh install`

------------------------------------------------------------------------

## Documentacao Tecnica

- `DOCS/INICIO_RAPIDO.md`
- `DOCS/install/README-INSTALADOR.md`
- `DOCS/install/TROUBLESHOOTING.md`
- `DOCS/INDICE_DOCUMENTACAO.md`

------------------------------------------------------------------------

## Licenca

**AGPL-3.0**

Consulte o arquivo `LICENSE`.

------------------------------------------------------------------------

## Creditos

**GOR Informatica - Gilson Oliveira**

- Site: `https://gorinformatica.com.br`
- WhatsApp: `(61) 3359-7358`

------------------------------------------------------------------------

## Apoio ao Projeto

Contribuicoes ajudam na evolucao continua da plataforma.

![QR Code Pix](DOCS/assets/qr-code-pix.png)

## Telas
![Telas](DOCS/assets/1.png) 
![Telas](DOCS/assets/2.png) 
![Telas](DOCS/assets/3.png) 
![Telas](DOCS/assets/4.png) 
![Telas](DOCS/assets/5.png)
