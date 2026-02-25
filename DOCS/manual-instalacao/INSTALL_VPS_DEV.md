# Instalacao VPS DEV

Este guia descreve o fluxo DEV/Staging usando o instalador separado.

## Pre-requisitos

- VPS Ubuntu/Debian
- Portas 80 e 443 liberadas
- Dominio DEV apontando para o IP da VPS
- Docker e Git instalados

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-plugin git
sudo systemctl enable --now docker
```

## 1. Clonar instalador

```bash
git clone https://github.com/gorinformaticadev/install-multitenant.git install
cd install
```

## 2. Executar instalacao

```bash
sudo bash install.sh install -d dev.suaempresa.com.br -e admin@suaempresa.com.br -u gorinformatica
```

Depois selecione no menu o modo desejado para DEV (docker/native).

## 3. Atualizacao continua

```bash
sudo bash install.sh update
```

## 4. Validacao rapida

```bash
docker ps
```

