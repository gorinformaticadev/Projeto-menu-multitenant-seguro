#!/bin/bash

# Script para iniciar ambiente completo de staging
# Uso: ./start-staging.sh

echo "🚀 Iniciando ambiente de staging completo..."
echo "=========================================="

# Verificar se os arquivos de configuração existem
if [ ! -f "backend/.env.staging" ]; then
    echo "❌ Arquivo backend/.env.staging não encontrado!"
    echo "📝 Copie backend/.env.staging.example para backend/.env.staging e configure"
    exit 1
fi

if [ ! -f "frontend/.env.staging" ]; then
    echo "❌ Arquivo frontend/.env.staging não encontrado!"
    echo "📝 Copie frontend/.env.staging.example para frontend/.env.staging e configure"
    exit 1
fi

echo "✅ Arquivos de configuração encontrados"

# Criar diretório de uploads para staging
mkdir -p backend/uploads/staging/logos
echo "📁 Diretório de uploads staging criado"

# Iniciar backend em background
echo "🔧 Iniciando backend staging..."
cd backend
NODE_ENV=staging npm run start:dev > ../logs/backend-staging.log 2>&1 &
BACKEND_PID=$!
cd ..

echo "✅ Backend iniciado (PID: $BACKEND_PID)"

# Aguardar backend iniciar
echo "⏳ Aguardando backend inicializar..."
sleep 10

# Verificar se backend está rodando
if curl -s http://localhost:4001/health > /dev/null 2>&1; then
    echo "✅ Backend staging rodando em http://localhost:4001"
else
    echo "⚠️ Backend pode não estar totalmente inicializado ainda"
fi

# Iniciar frontend em background
echo "🎨 Iniciando frontend staging..."
cd frontend
NODE_ENV=staging npm run dev -- -p 5001 > ../logs/frontend-staging.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo "✅ Frontend iniciado (PID: $FRONTEND_PID)"

echo ""
echo "🎉 Ambiente de staging iniciado com sucesso!"
echo "=========================================="
echo "🌐 Frontend: http://localhost:5001"
echo "🔧 Backend:  http://localhost:4001"
echo "📊 Logs:      ./logs/"
echo ""
echo "🛑 Para parar: ./stop-staging.sh"
echo "📝 Para ver logs: tail -f logs/backend-staging.log"
echo ""

# Criar arquivo de PIDs para facilitar parada
echo "$BACKEND_PID" > .staging-pids
echo "$FRONTEND_PID" >> .staging-pids

# Manter script rodando
trap 'echo ""; echo "🛑 Encerrando ambiente de staging..."; ./stop-staging.sh; exit 0' INT

echo "📊 Monitorando ambiente... (Ctrl+C para parar)"
wait