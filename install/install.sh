#!/bin/bash

echoblue() {
    echo -ne "\033[44m\033[37m\033[1m  $1  \033[0m\n"
}

echored() {
    echo -ne "\033[41m\033[37m\033[1m  $1  \033[0m\n"
}

# ===============================
# Checagem de root
# ===============================
if [[ $EUID -ne 0 ]]; then
    echored "Este script precisa ser executado como root."
    exit 1
fi

# ===============================
# Menu Interativo
# ===============================
while true; do
    echo ""
    echoblue "=============================="
    echoblue "     MULTITENANT MANAGER      "
    echoblue "=============================="
    echo "Escolha uma opção:"
    echo "1) Instalar"
    echo "2) Atualizar"
    echo "3) Desinstalar"
    echo "4) Sair"
    echo -n "Opção: "
    read OP

    case $OP in
        1)
            echoblue "Iniciando instalação..."
            ./setup.sh
            ;;
        2)
            echoblue "Iniciando atualização..."
            ./update.sh
            ;;
        3)
            echoblue "Iniciando desinstalação..."
            ./uninstall.sh
            ;;
        4)
            echoblue "Saindo..."
            exit 0
            ;;
        *)
            echored "Opção inválida. Tente novamente."
            ;;
    esac
done
