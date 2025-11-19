@echo off
REM Script para parar ambiente de staging
REM Uso: stop-staging.bat

echo 🛑 Parando ambiente de staging...

REM Procurar processos do Node.js rodando nas portas certas
for /f "tokens=2" %%i in ('netstat -ano ^| findstr ":4001" ^| findstr "LISTENING"') do (
    echo 🔧 Matando processo backend (porta 4001, PID: %%i)
    taskkill /PID %%i /F >nul 2>&1
)

for /f "tokens=2" %%i in ('netstat -ano ^| findstr ":5001" ^| findstr "LISTENING"') do (
    echo 🎨 Matando processo frontend (porta 5001, PID: %%i)
    taskkill /PID %%i /F >nul 2>&1
)

REM Aguardar processos encerrarem
timeout /t 2 /nobreak > nul

REM Verificar se ainda há processos
netstat -ano | findstr ":4001" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️ Backend ainda pode estar rodando
) else (
    echo ✅ Backend parado
)

netstat -ano | findstr ":5001" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️ Frontend ainda pode estar rodando
) else (
    echo ✅ Frontend parado
)

REM Remover arquivo de PIDs se existir
if exist .staging-pids del .staging-pids

echo.
echo ✅ Ambiente de staging parado
echo 💡 Para reiniciar: start-staging.bat
pause