# Instalacao VPS Producao

Guia oficial para deploy em VPS no formato novo (instalador separado da aplicacao).

## Pre-requisitos

- Ubuntu 22.04+ ou Debian 11+
- Dominio apontado para IP da VPS
- Portas 80/443 liberadas
- Acesso root/sudo

## Dependencias base

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

## 2. Rodar instalacao

```bash
sudo bash install.sh install -d crm.example.com.br -e seuemail@email.com -u gorinformatica
```

## 3. Atualizacoes futuras

```bash
sudo bash install.sh update
```

## 4. Desinstalacao

```bash
sudo bash install.sh uninstall
```

Observacao:

- O instalador clona a aplicacao automaticamente.
- O uninstall nao remove a pasta `install`.

