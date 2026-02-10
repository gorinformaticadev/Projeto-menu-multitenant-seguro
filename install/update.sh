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
# Localiza instalação pelo .env
# ===============================
INSTALL_DIR=$(find / -maxdepth 3 -type f -name ".env" 2>/dev/null | grep multitenant | head -n 1 | xargs dirname)

if [ -z "$INSTALL_DIR" ]; then
    echored "Não foi possível localizar a instalação do Multitenant."
    exit 1
fi

echoblue "Instalação localizada em: $INSTALL_DIR"
cd "$INSTALL_DIR"

# ===============================
# Verifica se é um repositório Git
# ===============================
if [ ! -d ".git" ]; then
    echored "Não é um repositório Git válido. Abortando atualização."
    exit 1
fi

# ===============================
# Lista branches disponíveis
# ===============================
echoblue "Branches disponíveis no repositório:"
git fetch --all
git branch -r | grep -v HEAD | sed 's|origin/||'

read -p "Digite a branch que deseja atualizar (ou pressione Enter para usar a padrão): " SELECTED_BRANCH

if [ -z "$SELECTED_BRANCH" ]; then
    DEFAULT_BRANCH=$(git rev-parse --abbrev-ref origin/HEAD | sed 's|origin/||')
    SELECTED_BRANCH=$DEFAULT_BRANCH
fi

echoblue "Atualizando para a branch: $SELECTED_BRANCH"

# ===============================
# Salva alterações locais se houver
# ===============================
if ! git diff-index --quiet HEAD --; then
    echored "Existem alterações locais. Salvando com git stash..."
    git stash push -m "Atualizador automático" &> /dev/null
fi

# ===============================
# Atualiza branch
# ===============================
git checkout $SELECTED_BRANCH
git pull origin $SELECTED_BRANCH

# ===============================
# Atualiza containers
# ===============================
echoblue "Atualizando containers Docker..."
docker compose pull
docker compose up -d --remove-orphans

# ===============================
# Mensagem final
# ===============================
echoblue "Atualização completa!"
echo "A aplicação foi atualizada mantendo volumes, .env e configurações existentes."
