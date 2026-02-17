# Script para reiniciar o backend NestJS

Write-Host "🔄 Reiniciando Backend..." -ForegroundColor Cyan
Write-Host ""

# Verificar se está na raiz do projeto
if (-not (Test-Path "backend")) {
    Write-Host "❌ Erro: Execute este script na raiz do projeto!" -ForegroundColor Red
    exit 1
}

# Parar processos Node que estão rodando na porta 4000
Write-Host "🛑 Parando processos na porta 4000..." -ForegroundColor Yellow
try {
    $process = Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
    if ($process) {
        Stop-Process -Id $process -Force
        Write-Host "✅ Processo parado (PID: $process)" -ForegroundColor Green
        Start-Sleep -Seconds 2
    } else {
        Write-Host "ℹ️  Nenhum processo rodando na porta 4000" -ForegroundColor Gray
    }
} catch {
    Write-Host "ℹ️  Porta 4000 já está livre" -ForegroundColor Gray
}

Write-Host ""
Write-Host "🚀 Iniciando backend..." -ForegroundColor Yellow
Write-Host ""

# Iniciar o backend
Set-Location backend
npm run start:dev
