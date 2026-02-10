#!/bin/bash

# ===============================
# Desinstalador Seguro Automático - Projeto Multitenant
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

# Lê domínio do .env para backup nginx
DOMAIN=$(grep "^DOMAIN=" .env | cut -d '=' -f2)

# ===============================
# Cria backup
# ===============================
BACKUP_DIR="$HOME/multitenant_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echoblue "Criando backup de volumes e arquivos..."

# Lista volumes relacionados à aplicação
docker volume ls -q | grep multitenant > /tmp/volumes_list.txt
while read volume; do
    docker run --rm -v "$volume":/data -v "$BACKUP_DIR":/backup alpine tar czf /backup/${volume}.tar.gz -C /data .
done < /tmp/volumes_list.txt

# Backup arquivos da instalação
tar czf "$BACKUP_DIR/multitenant_files.tar.gz" -C "$INSTALL_DIR" .

echoblue "Backup criado em: $BACKUP_DIR"

# ===============================
# Para e remove containers da aplicação
# ===============================
echoblue "Parando e removendo containers da aplicação..."
docker compose down

# ===============================
# Remove volumes da aplicação
# ===============================
echoblue "Removendo volumes relacionados à aplicação..."
while read volume; do
    docker volume rm "$volume" || echored "Falha ao remover volume $volume"
done < /tmp/volumes_list.txt

# ===============================
# Remove arquivos da aplicação
# ===============================
echoblue "Removendo arquivos da aplicação..."
rm -rf "$INSTALL_DIR"

# ===============================
# Remove configuração Nginx específica
# ===============================
if [ -n "$DOMAIN" ]; then
    NGINX_FILE="/etc/nginx/sites-available/${DOMAIN}.conf"
    NGINX_LINK="/etc/nginx/sites-enabled/${DOMAIN}.conf"

    [ -f "$NGINX_FILE" ] && rm -f "$NGINX_FILE"
    [ -f "$NGINX_LINK" ] && rm -f "$NGINX_LINK"

    if nginx -t &> /dev/null; then
        systemctl reload nginx
    fi
fi

# ===============================
# Mensagem final
# ===============================
echoblue "Desinstalação completa!"
echo "Backup da aplicação salvo em: $BACKUP_DIR"
echo "Docker, Nginx e outros serviços foram mantidos."
