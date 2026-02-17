# Script para Reiniciar Backend - Correção de Upload de Módulos
Write-Host "🔄 Reiniciando Backend..." -ForegroundColor Cyan
Write-Host ""

# Navegar para o diretório do backend
Set-Location -Path "D:\Usuarios\Servidor\GORInformatica\Documents\GitHub\Projeto-menu-multitenant-seguro\backend"

Write-Host "📦 Compilando alterações..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Compilação bem-sucedida!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🔧 Reiniciando serviço..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "⚠️  ATENÇÃO: Execute manualmente:" -ForegroundColor Yellow
    Write-Host "   1. Pare o backend (Ctrl+C no terminal onde está rodando)" -ForegroundColor White
    Write-Host "   2. Execute: npm run dev" -ForegroundColor White
    Write-Host ""
    Write-Host "📋 Alterações aplicadas:" -ForegroundColor Cyan
    Write-Host "   ✅ Configuração do Multer com memoryStorage()" -ForegroundColor Green
    Write-Host "   ✅ Validação de Buffer do arquivo" -ForegroundColor Green
    Write-Host "   ✅ Limite de 50MB" -ForegroundColor Green
    Write-Host "   ✅ Filtro de extensão .zip" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "❌ Erro na compilação!" -ForegroundColor Red
    Write-Host "Verifique os erros acima e corrija antes de reiniciar." -ForegroundColor Red
}
