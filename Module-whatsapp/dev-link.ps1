<#
.SYNOPSIS
Script para vincular o módulo ao sistema principal para desenvolvimento em tempo real.

.DESCRIPTION
Este script cria JUNCTIONS (Links Simbólicos) das pastas backend e frontend deste módulo
para dentro das pastas apps/backend e apps/frontend do sistema principal.
Dessa forma, qualquer alteração feita aqui reflete imediatamente no sistema,
permitindo desenvolvimento isolado mas com execução integrada.
#>

$ErrorActionPreference = "Stop"

# Caminhos (Assumindo que estamos em ./Module-whatsapp)
$CurrentDir = Get-Location
$BackendTarget = "$CurrentDir\backend"
$FrontendTarget = "$CurrentDir\frontend"

$SystemBackendPath = "$CurrentDir\..\apps\backend\src\modules\module-whatsapp"
$SystemFrontendPath = "$CurrentDir\..\apps\frontend\src\app\modules\module-whatsapp"

Write-Host "🔌 Iniciando vínculo de desenvolvimento para Module-whatsapp..." -ForegroundColor Cyan

# 1. Vincular Backend
Write-Host "   Processando Backend..." -ForegroundColor Yellow
if (Test-Path $SystemBackendPath) {
    if ((Get-Item $SystemBackendPath).Attributes -match "ReparsePoint") {
        # É um link, remove apenas o link
        cmd /c rmdir "$SystemBackendPath"
    } else {
        # É uma pasta real, remove recursivamente (backup recomendado se não fosse dev)
        Remove-Item -Path $SystemBackendPath -Recurse -Force
    }
}
# Cria a pasta pai se não existir
if (!(Test-Path "$CurrentDir\..\apps\backend\src\modules")) {
    New-Item -ItemType Directory -Force -Path "$CurrentDir\..\apps\backend\src\modules" | Out-Null
}
# Cria o Link
New-Item -ItemType Junction -Path $SystemBackendPath -Target $BackendTarget | Out-Null
Write-Host "   ✅ Backend vinculado: $SystemBackendPath -> $BackendTarget" -ForegroundColor Green

# 2. Vincular Frontend
Write-Host "   Processando Frontend..." -ForegroundColor Yellow
if (Test-Path $SystemFrontendPath) {
    if ((Get-Item $SystemFrontendPath).Attributes -match "ReparsePoint") {
        cmd /c rmdir "$SystemFrontendPath"
    } else {
        Remove-Item -Path $SystemFrontendPath -Recurse -Force
    }
}
# Cria a pasta pai se não existir
if (!(Test-Path "$CurrentDir\..\apps\frontend\src\app\modules")) {
    New-Item -ItemType Directory -Force -Path "$CurrentDir\..\apps\frontend\src\app\modules" | Out-Null
}
New-Item -ItemType Junction -Path $SystemFrontendPath -Target $FrontendTarget | Out-Null
Write-Host "   ✅ Frontend vinculado: $SystemFrontendPath -> $FrontendTarget" -ForegroundColor Green

# 3. Instalar Dependências Específicas
Write-Host "📦 Verificando dependências..." -ForegroundColor Cyan
Write-Host "   Instalando 'whaileys' no Backend principal..."
Push-Location "$CurrentDir\..\apps\backend"
# Adiciona whaileys se não existir (usando npm install para garantir)
# Nota: Em um mundo ideal, usariamos npm link, mas instalaremos direto para simplicidade
npm install whaileys pino @hapi/boom qrcode-terminal
Pop-Location

Write-Host "   Instalando pacotes no Frontend principal..."
Push-Location "$CurrentDir\..\apps\frontend"
npm install socket.io-client qrcode.react
Pop-Location

Write-Host "`n🚀 PRONTO PARA DESENVOLVER!" -ForegroundColor Green
Write-Host "Para rodar:"
Write-Host "1. Abra um terminal em 'apps/backend' e rode 'npm run start:dev'"
Write-Host "2. Abra outro terminal em 'apps/frontend' e rode 'npm run dev'"
Write-Host "3. O módulo estará disponível em '/whatsapp'"
