#!/usr/bin/env bash

echoblue() {
    echo -ne "\033[44m\033[37m\033[1m  $1  \033[0m\n"
}

echored() {
    echo -ne "\033[41m\033[37m\033[1m  $1  \033[0m\n"
}

if [[ $EUID -ne 0 ]]; then
    echored "Este script precisa ser executado como root."
    exit 1
fi

while true; do
    echo ""
    echoblue "=============================="
    echoblue "     MULTITENANT MANAGER      "
    echoblue "=============================="
    echo "Escolha uma opcao:"
    echo "1) Instalar/Integrar com nginx-proxy + acme"
    echo "2) Atualizar"
    echo "3) Desinstalar"
    echo "4) Sair"
    echo -n "Opcao: "
    read -r OP

    case $OP in
        1)
            read -r -p "DOMAIN: " DOMAIN
            read -r -p "LETSENCRYPT_EMAIL: " LETSENCRYPT_EMAIL
            read -r -p "APP_NAME (slug): " APP_NAME
            read -r -p "APP_SERVICE (servico compose): " APP_SERVICE
            read -r -p "APP_INTERNAL_PORT: " APP_INTERNAL_PORT
            read -r -p "Arquivo compose principal (ex: /srv/app/docker-compose.yml): " APP_COMPOSE
            read -r -p "Arquivo compose extra opcional (ou Enter): " APP_COMPOSE_EXTRA

            if [[ -z "$DOMAIN" || -z "$LETSENCRYPT_EMAIL" || -z "$APP_NAME" || -z "$APP_SERVICE" || -z "$APP_INTERNAL_PORT" || -z "$APP_COMPOSE" ]]; then
                echored "Campos obrigatorios nao preenchidos."
                continue
            fi

            echoblue "Iniciando instalacao..."
            if [[ -n "$APP_COMPOSE_EXTRA" ]]; then
                ./setup.sh \
                    --domain "$DOMAIN" \
                    --email "$LETSENCRYPT_EMAIL" \
                    --app-name "$APP_NAME" \
                    --app-service "$APP_SERVICE" \
                    --app-port "$APP_INTERNAL_PORT" \
                    --app-compose "$APP_COMPOSE" \
                    --app-compose "$APP_COMPOSE_EXTRA"
            else
                ./setup.sh \
                    --domain "$DOMAIN" \
                    --email "$LETSENCRYPT_EMAIL" \
                    --app-name "$APP_NAME" \
                    --app-service "$APP_SERVICE" \
                    --app-port "$APP_INTERNAL_PORT" \
                    --app-compose "$APP_COMPOSE"
            fi
            ;;
        2)
            echoblue "Iniciando atualizacao..."
            ./update.sh
            ;;
        3)
            echoblue "Iniciando desinstalacao..."
            ./uninstall.sh
            ;;
        4)
            echoblue "Saindo..."
            exit 0
            ;;
        *)
            echored "Opcao invalida. Tente novamente."
            ;;
    esac
done
