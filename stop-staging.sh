#!/bin/bash

# Script para parar ambiente de staging
# Uso: ./stop-staging.sh

echo "🛑 Parando ambiente de staging..."

# Verificar se arquivo de PIDs existe
if [ ! -f ".staging-pids" ]; then
    echo "⚠️ Arquivo .staging-pids não encontrado"
    echo "🔍 Procurando processos manualmente..."

    # Tentar encontrar processos
    BACKEND_PID=$(ps aux | grep "nest start" | grep staging | awk '{print $2}' | head -1)
    FRONTEND_PID=$(ps aux | grep "next dev" | grep 5001 | awk '{print $2}' | head -1)

    if [ ! -z "$BACKEND_PID" ]; then
        echo "🔧 Matando backend (PID: $BACKEND_PID)"
        kill $BACKEND_PID 2>/dev/null || true
    fi

    if [ ! -z "$FRONTEND_PID" ]; then
        echo "🎨 Matando frontend (PID: $FRONTEND_PID)"
        kill $FRONTEND_PID 2>/dev/null || true
    fi
else
    # Usar arquivo de PIDs
    while read -r PID; do
        if ps -p $PID > /dev/null 2>&1; then
            echo "🛑 Matando processo (PID: $PID)"
            kill $PID 2>/dev/null || true
        fi
    done < .staging-pids

    # Remover arquivo de PIDs
    rm .staging-pids
fi

# Aguardar processos encerrarem
sleep 2

# Verificar se ainda há processos rodando
BACKEND_RUNNING=$(ps aux | grep "nest start" | grep staging | wc -l)
FRONTEND_RUNNING=$(ps aux | grep "next dev" | grep 5001 | wc -l)

if [ $BACKEND_RUNNING -gt 0 ]; then
    echo "⚠️ Alguns processos backend ainda podem estar rodando"
fi

if [ $FRONTEND_RUNNING -gt 0 ]; then
    echo "⚠️ Alguns processos frontend ainda podem estar rodando"
fi

echo "✅ Ambiente de staging parado"
echo "💡 Para reiniciar: ./start-staging.sh"