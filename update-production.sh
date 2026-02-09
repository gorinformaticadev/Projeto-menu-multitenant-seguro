#!/bin/bash
# update-production.sh — Atualização segura sem perder .env

set -e

if [ ! -f .env ]; then
  echo "ERRO: .env não encontrado — atualização abortada."
  exit 1
fi

echo "Fazendo backup do .env..."
cp .env /tmp/.env.backup

echo "Atualizando repositório..."
git pull origin main

mv /tmp/.env.backup .env

echo "Rodando instalação novamente..."
./install-production.sh $(grep DOMAIN .env | cut -d= -f2) "admin@seuemail.com"

echo "Atualização concluída."
