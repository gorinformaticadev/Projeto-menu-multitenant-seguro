#!/usr/bin/env pwsh

Write-Host "🔄 Reiniciando Frontend com fontes menores..." -ForegroundColor Cyan

# Parar processos do frontend se estiverem rodando
Write-Host "📋 Parando processos do frontend..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -eq "node" } | Stop-Process -Force -ErrorAction SilentlyContinue

# Navegar para o diretório do frontend
Set-Location frontend

# Limpar cache do Next.js
Write-Host "🧹 Limpando cache do Next.js..." -ForegroundColor Yellow
if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next"
}

# Reinstalar dependências para garantir que as mudanças do Tailwind sejam aplicadas
Write-Host "📦 Reinstalando dependências..." -ForegroundColor Yellow
npm install

# Iniciar o servidor de desenvolvimento
Write-Host "🚀 Iniciando servidor de desenvolvimento..." -ForegroundColor Green
Write-Host "✨ As fontes agora estão menores!" -ForegroundColor Green
Write-Host "📱 Acesse: http://localhost:3000" -ForegroundColor Cyan

npm run dev