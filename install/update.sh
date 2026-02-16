#!/bin/bash

# ===============================
# Atualizador Interativo - Projeto Multitenant
# ===============================

echoblue() {
    echo -ne "\033[44m\033[37m\033[1m  $1  \033[0m\n"
}

echored() {
    echo -ne "\033[41m\033[37m\033[1m  $1  \033[0m\n"
}

# ===============================
# Checagens iniciais
# ===============================
if [[ $EUID -ne 0 ]]; then
    echored "Este script precisa ser executado como root."
    exit 1
fi

# ===============================
# Localiza instalação
# ===============================
# Tenta primeiro o diretório atual (se estiver dentro do repositório)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -d "$PROJECT_ROOT/.git" ]; then
    INSTALL_DIR="$PROJECT_ROOT"
else
    # Fallback: Busca pelo diretório que contém .git e tem "multitenant" no nome
    # Limitamos a busca para ser mais performática e evitar erros de permissão
    INSTALL_DIR=$(find /home /root /opt /var/www -maxdepth 3 -type d -name ".git" 2>/dev/null | grep -i "multitenant" | head -n 1 | xargs -r dirname)
fi

if [ -z "$INSTALL_DIR" ] || [ ! -d "$INSTALL_DIR" ]; then
    echored "Não foi possível localizar a instalação do Multitenant."
    echo "Dica: Execute este script de dentro da pasta do projeto."
    exit 1
fi

echoblue "Instalação localizada em: $INSTALL_DIR"
cd "$INSTALL_DIR"

# ===============================
# Verifica se é um repositório Git
# ===============================
if [ ! -d ".git" ]; then
    echored "Não é um repositório Git válido em $INSTALL_DIR. Abortando atualização."
    exit 1
fi

# ===============================
# Lista branches disponíveis
# ===============================
echoblue "Buscando atualizações no repositório..."
git fetch --all --prune

echoblue "Branches disponíveis:"
git branch -r | grep -v HEAD | sed 's|origin/||' | sort -u

read -p "Digite a branch que deseja atualizar (ou pressione Enter para usar a atual): " SELECTED_BRANCH

if [ -z "$SELECTED_BRANCH" ]; then
    SELECTED_BRANCH=$(git rev-parse --abbrev-ref HEAD)
fi

echoblue "Atualizando para a branch: $SELECTED_BRANCH"

# ===============================
# Salva alterações locais se houver
# ===============================
if ! git diff-index --quiet HEAD --; then
    echored "Existem alterações locais. Salvando com git stash..."
    git stash push -m "Atualizador automático em $(date +'%Y-%m-%d %H:%M:%S')"
fi

# ===============================
# Atualiza branch
# ===============================
git checkout "$SELECTED_BRANCH"
git pull origin "$SELECTED_BRANCH"

# ===============================
# Atualiza containers
# ===============================
echoblue "Atualizando containers Docker..."

# Detecta qual arquivo compose usar
COMPOSE_FILE="docker-compose.yml"
if [ -f "docker-compose.prod.yml" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
fi

# Tenta localizar o arquivo .env
ENV_FILE=".env"
if [ -f "install/.env.production" ]; then
    ENV_FILE="install/.env.production"
elif [ -f ".env.production" ]; then
    ENV_FILE=".env.production"
fi

echoblue "Usando $COMPOSE_FILE com $ENV_FILE"

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --remove-orphans

# ===============================
# Mensagem final
# ===============================
echoblue "Atualização completa!"
echo "A aplicação foi atualizada mantendo volumes, .env e configurações existentes."
