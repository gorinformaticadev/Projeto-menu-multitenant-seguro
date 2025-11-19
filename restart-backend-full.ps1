# Script completo para reiniciar backend com regeneração do Prisma Client

Write-Host "🔄 Reiniciando Backend (com Prisma Generate)..." -ForegroundColor Cyan
Write-Host ""

# Verificar se está na raiz do projeto
if (-not (Test-Path "backend")) {
    Write-Host "❌ Erro: Execute este script na raiz do projeto!" -ForegroundColor Red
    exit 1
}

# Passo 1: Parar processos Node na porta 4000
Write-Host "🛑 Passo 1/3: Parando processos na porta 4000..." -ForegroundColor Yellow
try {
    $process = Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
    if ($process) {
        Stop-Process -Id $process -Force
        Write-Host "✅ Processo parado (PID: $process)" -ForegroundColor Green
        Write-Host "⏳ Aguardando 5 segundos para liberar recursos..." -ForegroundColor Gray
        Start-Sleep -Seconds 5
    } else {
        Write-Host "ℹ️  Nenhum processo rodando na porta 4000" -ForegroundColor Gray
    }
} catch {
    Write-Host "ℹ️  Porta 4000 já está livre" -ForegroundColor Gray
}

Write-Host ""

# Passo 2: Regenerar Prisma Client
Write-Host "🔧 Passo 2/3: Regenerando Prisma Client..." -ForegroundColor Yellow
Set-Location backend
try {
    npx prisma generate
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Prisma Client regenerado com sucesso!" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Aviso: Houve um problema ao regenerar o Prisma Client" -ForegroundColor Yellow
        Write-Host "   Tentando continuar mesmo assim..." -ForegroundColor Gray
    }
} catch {
    Write-Host "⚠️  Erro ao regenerar Prisma Client: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "   Tentando continuar mesmo assim..." -ForegroundColor Gray
}

Write-Host ""

# Passo 3: Iniciar o backend
Write-Host "🚀 Passo 3/3: Iniciando backend..." -ForegroundColor Yellow
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

npm run start:dev
