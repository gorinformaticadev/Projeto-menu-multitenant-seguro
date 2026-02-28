# Instalacao VPS DEV (Branch dev, sem imagem Docker)

Este guia define o fluxo de **staging/dev** com as seguintes regras:

- Fonte obrigatoria: branch `dev`.
- Sem uso de imagem pre-buildada do registry.
- Build obrigatorio no proprio servidor (VPS).

## Pre-requisitos

- VPS Ubuntu 22.04 LTS (recomendado).
- Dominio de dev, por exemplo: `dev.suaempresa.com.br`.
- Portas 80 e 443 liberadas.
- Docker, Docker Compose plugin e Git instalados.

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-plugin git
sudo systemctl enable --now docker
```

## 1. Clonar somente a branch dev

```bash
git clone --branch dev --single-branch https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro.git
cd Projeto-menu-multitenant-seguro
git branch --show-current
```

Saida esperada: `dev`.

## 2. Instalar em modo local build only (sem pull de imagem)

Execute o instalador em modo de build local:

```bash
sudo bash install/install.sh install \
  -d dev.suaempresa.com.br \
  -e admin@suaempresa.com.br \
  -l
```

O parametro `-l` (`--local-build-only`) faz o instalador:

- Ignorar pull de imagens Docker do registry.
- Fazer build local de `backend` e `frontend` no VPS.
- Subir os containers com o build local.

## 3. Atualizacao continua da branch dev (com build no servidor)

Para atualizar mantendo o mesmo padrao (codigo da branch `dev` + build local):

```bash
git checkout dev
git pull origin dev
sudo bash install/install.sh update dev
```

Como `LOCAL_BUILD_ONLY=true` fica salvo em `install/.env.production`, o comando `update` continuara em modo build local.

## 4. Validacao rapida

```bash
docker ps
docker logs -f multitenant-backend
docker logs -f multitenant-frontend
```

As configuracoes da instalacao ficam em `install/.env.production`.
