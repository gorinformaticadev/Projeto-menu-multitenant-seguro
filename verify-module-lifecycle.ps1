# Script de Verificação Rápida - Ciclo de Vida de Módulos
# Data: 18/12/2025

Write-Host "🔍 Verificando implementação do ciclo de vida de módulos..." -ForegroundColor Cyan
Write-Host ""

# Verificar arquivos backend
Write-Host "📦 Backend:" -ForegroundColor Yellow
$backendFiles = @(
    "backend\src\core\module-installer.service.ts",
    "backend\src\core\ModuleLoader.ts"
)

foreach ($file in $backendFiles) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file não encontrado!" -ForegroundColor Red
    }
}

Write-Host ""

# Verificar arquivos frontend
Write-Host "🎨 Frontend:" -ForegroundColor Yellow
$frontendFiles = @(
    "frontend\src\lib\module-utils.ts",
    "frontend\src\components\ui\tooltip.tsx",
    "frontend\src\app\configuracoes\sistema\modulos\components\ModuleManagement.tsx"
)

foreach ($file in $frontendFiles) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file não encontrado!" -ForegroundColor Red
    }
}

Write-Host ""

# Verificar documentação
Write-Host "📄 Documentação:" -ForegroundColor Yellow
$docFiles = @(
    "DOCS\IMPLEMENTACAO_CICLO_VIDA_MODULOS_COMPLETA.md",
    ".qoder\quests\module-lifecycle-management.md"
)

foreach ($file in $docFiles) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file não encontrado!" -ForegroundColor Red
    }
}

Write-Host ""

# Verificar Prisma Client
Write-Host "🔧 Prisma Client:" -ForegroundColor Yellow
if (Test-Path "backend\node_modules\@prisma\client") {
    Write-Host "  ✅ Prisma Client gerado" -ForegroundColor Green
    
    # Verificar se exports necessários existem
    $prismaIndex = Get-Content "backend\node_modules\@prisma\client\index.d.ts" -Raw
    
    $exports = @("Role", "ModuleStatus", "MigrationType", "EmailConfiguration", "User")
    $allExportsFound = $true
    
    foreach ($export in $exports) {
        if ($prismaIndex -match "export.*$export") {
            Write-Host "    ✅ Export $export encontrado" -ForegroundColor Green
        } else {
            Write-Host "    ❌ Export $export não encontrado" -ForegroundColor Red
            $allExportsFound = $false
        }
    }
} else {
    Write-Host "  ❌ Prisma Client não encontrado!" -ForegroundColor Red
}

Write-Host ""
Write-Host "🎉 Verificação concluída!" -ForegroundColor Cyan
Write-Host ""

# Resumo da implementação
Write-Host "📊 Resumo da Implementação:" -ForegroundColor Cyan
Write-Host "  • Matriz de controle de ações por status implementada" -ForegroundColor White
Write-Host "  • Validações rigorosas de status no backend" -ForegroundColor White
Write-Host "  • Interface com controle de botões baseado em status" -ForegroundColor White
Write-Host "  • Suporte a reativação de módulos disabled" -ForegroundColor White
Write-Host "  • Tooltips e mensagens de orientação contextuais" -ForegroundColor White
Write-Host ""

Write-Host "Para testar o sistema:" -ForegroundColor Yellow
Write-Host "  1. Inicie o backend: cd backend && npm run start:dev" -ForegroundColor White
Write-Host "  2. Inicie o frontend: cd frontend && npm run dev" -ForegroundColor White
Write-Host "  3. Acesse: http://localhost:3000/configuracoes/sistema/modulos" -ForegroundColor White
Write-Host ""
