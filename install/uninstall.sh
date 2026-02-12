#!/bin/bash

# ===============================
# Desinstalador Seguro Automático - Projeto Multitenant
# Suporta: Modo Nginx Externo e Modo Nginx-proxy (Docker)
# ===============================

echored() {
    echo -ne "\033[41m\033[37m\033[1m  $1  \033[0m\n"
}

echoblue() {
    echo -ne "\033[44m\033[37m\033[1m  $1  \033[0m\n"
}

# ===============================
# Checagens iniciais
# ===============================
if [[ $EUID -ne 0 ]]; then
    echored "Este script precisa ser executado como root."
    exit 1
fi

# ===============================
# Detecta diretório da instalação
# ===============================
INSTALL_DIR=$(find / -maxdepth 3 -type f -name ".env" 2>/dev/null | grep multitenant | head -n 1 | xargs dirname)

if [ -z "$INSTALL_DIR" ]; then
    echored "Não foi possível localizar a instalação do Multitenant."
    exit 1
fi

echoblue "Instalação localizada em: $INSTALL_DIR"
cd "$INSTALL_DIR"

# Carrega variáveis do .env
if [ -f ".env" ]; then
    set -a
    source .env
    set +a
fi

DOMAIN="${DOMAIN:-}"
PROXY_NETWORK="${PROXY_NETWORK:-nginx-proxy}"
INSTALL_DIR="${INSTALL_DIR:-/opt/multitenant}"

# ===============================
# Cria backup
# ===============================
BACKUP_DIR="$HOME/multitenant_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echoblue "Criando backup de volumes e arquivos..."

# Lista volumes relacionados à aplicação
docker volume ls -q | grep -E "(multitenant|nginx-proxy)" > /tmp/volumes_list.txt 2>/dev/null || true
while read volume; do
    if [ -n "$volume" ]; then
        docker run --rm -v "$volume":/data -v "$BACKUP_DIR":/backup alpine tar czf /backup/${volume}.tar.gz -C /data . 2>/dev/null || true
    fi
done < /tmp/volumes_list.txt

# Backup arquivos da instalação (se ainda existir)
if [ -d "$INSTALL_DIR" ]; then
    tar czf "$BACKUP_DIR/multitenant_files.tar.gz" -C "$INSTALL_DIR" . 2>/dev/null || true
fi

echoblue "Backup criado em: $BACKUP_DIR"

# ===============================
# Para e remove containers da aplicação
# ===============================
echoblue "Parando e removendo containers da aplicação..."

# Tenta múltiplos compose files
docker compose -f docker-compose.yml -f docker-compose.prod.external.yml -f docker-compose.proxy.yml down 2>/dev/null || true
docker compose -f docker-compose.yml -f docker-compose.external-nginx.yml down 2>/dev/null || true
docker compose down 2>/dev/null || true

# Remove containers órfãos relacionados
for container in $(docker ps -aq --filter "name=multitenant" 2>/dev/null); do
    docker rm -f "$container" 2>/dev/null || true
done

# ===============================
# Remove containers do nginx-proxy interno (se existir)
# ===============================
echoblue "Verificando nginx-proxy interno..."

if docker ps -a --format '{{.Names}}' | grep -q "nginx-proxy"; then
    echoblue "Parando e removendo nginx-proxy e acme-companion..."
    docker rm -f nginx-proxy acme-companion 2>/dev/null || true
fi

# ===============================
# Remove volumes da aplicação
# ===============================
echoblue "Removendo volumes relacionados à aplicação..."

while read volume; do
    if [ -n "$volume" ]; then
        docker volume rm "$volume" 2>/dev/null || echored "Falha ao remover volume: $volume"
    fi
done < /tmp/volumes_list.txt

# Remove volumes específicos conhecidos
docker volume rm multitenant_postgres_data_prod 2>/dev/null || true
docker volume rm multitenant_redis_data_prod 2>/dev/null || true
docker volume rm nginx-proxy_certs 2>/dev/null || true
docker volume rm nginx-proxy_acme 2>/dev/null || true

# ===============================
# Remove redes Docker
# ===============================
echoblue "Removendo redes Docker..."

for network in app-network nginx-proxy proxy-nw multitenant-network; do
    if docker network inspect "$network" >/dev/null 2>&1; then
        docker network rm "$network" 2>/dev/null || echored "Falha ao remover rede: $network"
    fi
done

# ===============================
# Remove arquivos da aplicação
# ===============================
echoblue "Removendo arquivos da aplicação..."

if [ -d "$INSTALL_DIR" ]; then
    rm -rf "$INSTALL_DIR"
fi

# ===============================
# Remove configuração Nginx externa
# ===============================
if [ -n "$DOMAIN" ]; then
    echoblue "Removendo configuração Nginx externa..."
    NGINX_FILE="/etc/nginx/sites-available/${DOMAIN}.conf"
    NGINX_LINK="/etc/nginx/sites-enabled/${DOMAIN}.conf"

    [ -f "$NGINX_FILE" ] && rm -f "$NGINX_FILE"
    [ -f "$NGINX_LINK" ] && rm -f "$NGINX_LINK"

    # Remove possíveis includes do nginx-proxy
    if [ -f "/etc/nginx/conf.d/${DOMAIN}.conf" ]; then
        rm -f "/etc/nginx/conf.d/${DOMAIN}.conf"
    fi

    # Recarrega nginx se instalado
    if command -v nginx >/dev/null 2>&1; then
        if nginx -t >/dev/null 2>&1; then
            systemctl reload nginx 2>/dev/null || nginx -s reload 2>/dev/null || true
        fi
    fi
fi

# ===============================
# Remove nginx-proxy interno (se criado em /opt)
# ===============================
echoblue "Removendo nginx-proxy interno (se existir)..."

if [ -d "/opt/nginx-proxy" ]; then
    rm -rf /opt/nginx-proxy
fi

# Remove pastas acme se existirem
rm -rf /opt/acme.sh 2>/dev/null || true
rm -rf "$HOME/.acme.sh" 2>/dev/null || true

# ===============================
# Limpa certificados Let's Encrypt (opcional, perguntar)
# ===============================
echoblue "============================================"
echoblue "  DESINSTALAÇÃO QUASE COMPLETA!           "
echoblue "============================================"
echo ""
echo "O que foi removido:"
echo "  - Containers da aplicação"
echo "  - Volumes Docker (dados perdidos!)"
echo "  - Redes Docker"
echo "  - Arquivos em: $INSTALL_DIR"
echo "  - Configurações Nginx externas"
echo "  - Proxy nginx interno (se existir)"
echo ""
echo "O que foi MANTIDO:"
echo "  - Docker daemon"
echo "  - Nginx (se instalado no host)"
echo "  - Outros containers não relacionados"
echo ""
echo "AVISO: Os dados do banco de dados e uploads foram removidos!"
echo "Backup salvo em: $BACKUP_DIR"
echo ""

# ===============================
# Pergunta sobre certificado SSL (mudar servidor?)
# ===============================
read -p "Deseja liberar a porta 80/443 para novo servidor? (s/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    echoblue "Libertando portas 80/443..."
    # Remove qualquer configuração que possa estar ocupando as portas
    pkill -f nginx 2>/dev/null || true
    sleep 1
    echoblue "Portas 80/443 liberadas."
fi

echoblue "Desinstalação completa!"
