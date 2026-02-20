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
echogreen() {
    echo -ne "\033[42m\033[30m\033[1m  $1  \033[0m\n"
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
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -d "$PROJECT_ROOT/.git" ]; then
    INSTALL_DIR="$PROJECT_ROOT"
else
    INSTALL_DIR=$(find /home /root /opt /var/www -maxdepth 3 -type d -name ".git" 2>/dev/null | grep -i "multitenant" | head -n 1 | xargs -r dirname)
fi

if [ -z "$INSTALL_DIR" ] || [ ! -d "$INSTALL_DIR" ]; then
    echored "Não foi possível localizar a instalação do Multitenant."
    exit 1
fi

echoblue "Instalação localizada em: $INSTALL_DIR"
cd "$INSTALL_DIR"

# ===============================
# Verifica se é um repositório Git
# ===============================
if [ ! -d ".git" ]; then
    echored "Não é um repositório Git válido. Abortando."
    exit 1
fi

# ===============================
# Lista branches disponíveis
# ===============================
echoblue "Buscando atualizações..."
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

COMPOSE_FILE="docker-compose.yml"
if [ -f "docker-compose.prod.yml" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
fi

ENV_FILE=".env"
if [ -f "install/.env.production" ]; then
    ENV_FILE="install/.env.production"
elif [ -f ".env.production" ]; then
    ENV_FILE=".env.production"
fi

echoblue "Usando $COMPOSE_FILE com $ENV_FILE"

# ===============================
# Atualiza containers Docker
# ===============================
echoblue "Atualizando containers Docker..."

# Tenta fazer pull das novas imagens do registry (compose.prod.yml usa imagens pré-construídas)
echoblue "Baixando imagens atualizadas do registry..."
if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull 2>/dev/null; then
    echogreen "Imagens atualizadas com sucesso."
else
    echored "Aviso: Não foi possível fazer pull das imagens. Usando imagens locais existentes."
fi

# Recria os containers com as imagens atualizadas
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --remove-orphans

# ===============================
# Verifica saúde do backend
# ===============================
echoblue "Aguardando o backend ficar saudável (até 3 minutos)..."
BACKEND_HEALTHY=0
for i in $(seq 1 18); do
    sleep 10
    HEALTH=$(docker inspect --format='{{.State.Health.Status}}' multitenant-backend 2>/dev/null || echo "not_found")
    echo "  Backend status: $HEALTH (${i}/18 - $((i * 10))s)"
    if [ "$HEALTH" = "healthy" ]; then
        BACKEND_HEALTHY=1
        break
    elif [ "$HEALTH" = "unhealthy" ]; then
        echored "Backend ficou unhealthy. Verificando logs..."
        docker logs --tail 50 multitenant-backend 2>&1 || true
        break
    fi
done

if [ "$BACKEND_HEALTHY" -eq 1 ]; then
    echogreen "Backend está saudável!"
else
    echored "ATENÇÃO: Backend não ficou saudável no tempo esperado."
    echored "Execute: docker logs multitenant-backend"
    echored "para verificar os logs e identificar o problema."
fi

# ===============================
# Mensagem final
# ===============================
echoblue "Atualização completa!"
echo "A aplicação foi atualizada com sucesso."
