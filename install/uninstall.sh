#!/bin/bash

# ==========================================================
# Desinstalador Robusto - Projeto Multitenant
# ==========================================================

# Cores para feedback
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Checagem de root
if [[ $EUID -ne 0 ]]; then
   log_error "Este script precisa ser executado como root (sudo)."
   exit 1
fi

PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
ENV_FILE="$PROJECT_ROOT/install/.env.production"

echo -e "${BLUE}==========================================================${NC}"
echo -e "${BLUE}      DESINSTALADOR DO PROJETO MULTITENANT                ${NC}"
echo -e "${BLUE}==========================================================${NC}"
echo -e "\nEscolha o tipo de desinstalação:\n"
echo -e "1) ${YELLOW}Apenas a Aplicação${NC} (Remove containers, volumes e arquivos do projeto)"
echo -e "2) ${RED}Limpeza Total do VPS${NC} (Remove TUDO: Aplicação + Docker + Nginx + Certificados)"
echo -e "q) Sair\n"

read -p "Opção: " opt

case $opt in
    1)
        echo -e "\n${YELLOW}⚠️  AVISO: Isso apagará todos os dados do banco e arquivos do projeto!${NC}"
        read -p "Tem certeza? (s/N): " confirm
        [[ ! $confirm =~ ^[Ss]$ ]] && exit 0
        
        log_info "Iniciando remoção da aplicação..."
        
        cd "$PROJECT_ROOT"
        if [[ -f "docker-compose.prod.yml" ]]; then
            log_info "Parando containers e removendo volumes..."
            docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml down -v --remove-orphans
        fi
        
        log_info "Removendo imagens locais do projeto..."
        # Pega apenas os IDs das imagens (coluna 3) que contenham 'multitenant' no nome
        docker images --format "{{.Repository}} {{.ID}}" | grep "multitenant" | awk '{print $2}' | xargs -r docker rmi -f
        ;;
        
    2)
        echo -e "\n${RED}⚠️  AVISO CRÍTICO: ISSO REMOVERÁ O DOCKER E O NGINX DO SISTEMA!${NC}"
        echo -e "${RED}Esta ação é irreversível e afetará outros sites no mesmo VPS.${NC}"
        read -p "VOCÊ TEM CERTEZA ABSOLUTA? (digite 'SIM' para confirmar): " confirm
        [[ "$confirm" != "SIM" ]] && exit 0
        
        log_info "Iniciando limpeza total do sistema..."
        
        # 1. Parar aplicação
        cd "$PROJECT_ROOT"
        docker compose -f docker-compose.prod.yml down -v 2>/dev/null || true
        
        # 2. Remover Docker e dependências
        log_info "Removendo Docker..."
        apt-get purge -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin docker-ce-rootless-extras
        rm -rf /var/lib/docker
        rm -rf /var/lib/containerd
        
        # 3. Remover Nginx
        log_info "Removendo Nginx..."
        apt-get purge -y nginx nginx-common nginx-full
        rm -rf /etc/nginx
        
        # 4. Remover Certificados
        log_info "Removendo certificados e Certbot..."
        apt-get purge -y certbot
        rm -rf /etc/letsencrypt
        
        # 5. Limpar pacotes órfãos
        apt-get autoremove -y
        ;;
        
    *)
        exit 0
        ;;
esac

# Limpeza final do diretório do projeto (para ambas as opções)
log_info "Removendo arquivos do repositório..."

# Agenda a remoção do diretório para 1 segundo após o script terminar para evitar erro de "file in use"
(sleep 1 && rm -rf "$PROJECT_ROOT") &

log_success "Desinstalação concluída com sucesso!"
echo -e "\nO VPS está limpo para uma nova instalação.\n"
