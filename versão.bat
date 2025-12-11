@echo off
echo ===============================
echo  FLUXO AUTOMATICO DE RELEASE
echo ===============================

echo.
echo Adicionando arquivos...
git add .
if ERRORLEVEL 1 exit /b

echo.
echo Iniciando Commitizen...
npx cz
if ERRORLEVEL 1 exit /b

echo.
echo Gerando release e tag automaticamente...
npm run release
if ERRORLEVEL 1 exit /b

echo.
echo Enviando commits e tags para o repositório...
git push --follow-tags
if ERRORLEVEL 1 exit /b

echo.
echo ============================================
echo  PROCESSO FINALIZADO COM SUCESSO !
echo ============================================
pause
