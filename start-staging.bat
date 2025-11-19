@echo off
REM Script para iniciar ambiente completo de staging
REM Uso: start-staging.bat

echo 🚀 Iniciando ambiente de staging completo...
echo ==========================================

REM Verificar se os arquivos de configuração existem
if not exist "backend\.env.staging" (
    echo ❌ Arquivo backend\.env.staging não encontrado!
    echo 📝 Copie backend\.env.staging.example para backend\.env.staging e configure
    pause
    exit /b 1
)

if not exist "frontend\.env.staging" (
    echo ❌ Arquivo frontend\.env.staging não encontrado!
    echo 📝 Copie frontend\.env.staging.example para frontend\.env.staging e configure
    pause
    exit /b 1
)

echo ✅ Arquivos de configuração encontrados

REM Criar diretório de logs
if not exist "logs" mkdir logs

REM Criar diretório de uploads para staging
if not exist "backend\uploads\staging" mkdir backend\uploads\staging
if not exist "backend\uploads\staging\logos" mkdir backend\uploads\staging\logos
echo 📁 Diretório de uploads staging criado

REM Iniciar backend em background
echo 🔧 Iniciando backend staging...
cd backend
start /B cmd /C "set NODE_ENV=staging && npm run start:dev > ..\logs\backend-staging.log 2>&1"
cd ..

REM Aguardar backend iniciar
echo ⏳ Aguardando backend inicializar...
timeout /t 10 /nobreak > nul

REM Verificar se backend está rodando
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:4001/health' -TimeoutSec 5; echo '✅ Backend staging rodando em http://localhost:4001' } catch { echo '⚠️ Backend pode não estar totalmente inicializado ainda' }"

REM Iniciar frontend em background
echo 🎨 Iniciando frontend staging...
cd frontend
start /B cmd /C "set NODE_ENV=staging && npm run dev -- -p 5001 > ..\logs\frontend-staging.log 2>&1"
cd ..

echo.
echo 🎉 Ambiente de staging iniciado com sucesso!
echo ==========================================
echo 🌐 Frontend: http://localhost:5001
echo 🔧 Backend:  http://localhost:4001
echo 📊 Logs:      .\logs\
echo.
echo 🛑 Para parar: stop-staging.bat
echo 📝 Para ver logs: type logs\backend-staging.log
echo.

echo 📊 Ambiente de staging ativo... (Pressione Ctrl+C para parar)
pause > nul