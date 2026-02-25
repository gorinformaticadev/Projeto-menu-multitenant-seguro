#!/usr/bin/env bash
# =============================================================================
# Utilitários de Desinstalação - Instalador Multitenant
# =============================================================================

run_uninstall_docker() {
    local total_purge="${1:-false}"
    
    print_header "DESINSTALAÇÃO DOCKER"
    
    if [[ "$total_purge" == "true" ]]; then
        log_warn "Ação Crítica: Limpeza Total do VPS selecionada."
    fi
    
    if ! confirm_action "Isso removerá os containers e volumes da aplicação. Continuar?" "n"; then
        log_info "Cancelado."
        return 0
    fi
    
    # 1. Parar a aplicação
    local compose_file="docker-compose.prod.yml"
    local env_file=".env"
    
    if [[ ! -f "$PROJECT_ROOT/$compose_file" ]]; then
        compose_file="docker-compose.yml"
    fi
    
    if [[ -f "$PROJECT_ROOT/install/.env.production" ]]; then
        env_file="install/.env.production"
    elif [[ -f "$PROJECT_ROOT/.env.production" ]]; then
        env_file=".env.production"
    fi
    
    if [[ -f "$PROJECT_ROOT/$compose_file" ]]; then
        log_info "Removendo containers e volumes..."
        docker compose -f "$PROJECT_ROOT/$compose_file" --env-file "$PROJECT_ROOT/$env_file" down -v --remove-orphans
    fi
    
    # 2. Remover imagens do projeto
    log_info "Limpando imagens Docker do projeto..."
    docker images --format "{{.Repository}} {{.ID}}" | grep "multitenant" | awk '{print $2}' | xargs -r docker rmi -f || true
    
    # 3. Limpeza total se solicitado
    if [[ "$total_purge" == "true" ]]; then
        log_info "Removendo Docker e dependências..."
        apt-get purge -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
        rm -rf /var/lib/docker
        
        log_info "Removendo Nginx..."
        apt-get purge -y nginx nginx-common
        rm -rf /etc/nginx
        
        log_info "Removendo Certificados..."
        rm -rf /etc/letsencrypt
    fi
    
    # 4. Remover arquivos do projeto
    log_info "Removendo diretório do projeto..."
    (sleep 2 && rm -rf "$PROJECT_ROOT") &
    
    log_success "Desinstalação concluída!"
    exit 0
}

run_uninstall_native() {
    local total_purge="${1:-false}"
    
    print_header "DESINSTALAÇÃO NATIVA"
    
    if ! confirm_action "Isso removerá os serviços e arquivos da aplicação. Continuar?" "n"; then
        log_info "Cancelado."
        return 0
    fi
    
    # 1. Parar e remover serviços PM2 (se existirem)
    log_info "Removendo serviços PM2..."
    sudo -u multitenant pm2 delete multitenant-backend 2>/dev/null || true
    sudo -u multitenant pm2 delete multitenant-frontend 2>/dev/null || true
    sudo -u multitenant pm2 save 2>/dev/null || true
    sudo -u multitenant pm2 stop all 2>/dev/null || true
    sudo -u multitenant pm2 kill 2>/dev/null || true
    
    # 2. Parar e remover serviços systemd
    log_info "Removendo serviços do sistema..."
    systemctl stop multitenant-backend || true
    systemctl disable multitenant-backend || true
    systemctl stop multitenant-frontend || true
    systemctl disable multitenant-frontend || true
    rm -f /etc/systemd/system/multitenant-backend.service
    rm -f /etc/systemd/system/multitenant-frontend.service
    systemctl daemon-reload
    
    # 3. Remover arquivos de configuração do PM2
    log_info "Removendo arquivos de configuração do PM2..."
    rm -f "$PROJECT_ROOT/ecosystem.config.js"
    
    # 4. Remover configuração do Nginx
    log_info "Removendo configuração do Nginx..."
    rm -f /etc/nginx/sites-enabled/multitenant
    rm -f /etc/nginx/sites-available/multitenant
    systemctl restart nginx || true
    
    # 5. Limpeza total se solicitado
    if [[ "$total_purge" == "true" ]]; then
        log_info "Removendo Node.js, pnpm e PostgreSQL..."
        # Nota: Cuidado ao remover PostgreSQL pois pode haver outros bancos
        if confirm_action "Deseja remover o PostgreSQL (CUIDADO!)?" "n"; then
             apt-get purge -y postgresql*
             rm -rf /var/lib/postgresql
        fi
        npm uninstall -g pnpm 2>/dev/null || true
        apt-get purge -y nodejs
    fi
    
    # 6. Remover arquivos do projeto
    log_info "Removendo diretório do projeto..."
    (sleep 2 && rm -rf "$PROJECT_ROOT") &
    
    # 7. Remover usuário do sistema se solicitado
    if [[ "$total_purge" == "true" ]]; then
        log_info "Removendo usuário multitenant do sistema..."
        userdel -r multitenant 2>/dev/null || true
        log_info "Usuário multitenant removido."
    fi
    
    log_success "Desinstalação concluída!"
    exit 0
}
