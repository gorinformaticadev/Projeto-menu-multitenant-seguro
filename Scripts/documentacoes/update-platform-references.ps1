# Script para atualizar referências ao "Sistema Multitenant" nos arquivos de documentação e configuração

Write-Host "Atualizando referências ao Sistema Multitenant..." -ForegroundColor Green

# Arquivos que podem ser atualizados automaticamente (documentação, exemplos, etc.)
$filesToUpdate = @(
    "frontend/README.md",
    "backend/README.md", 
    "DOCS/README.md",
    "BOAS_VINDAS.md",
    "backend/API_EXAMPLES.md"
)

foreach ($file in $filesToUpdate) {
    if (Test-Path $file) {
        Write-Host "Atualizando $file..." -ForegroundColor Yellow
        
        $content = Get-Content $file -Raw -Encoding UTF8
        $newContent = $content -replace "Sistema Multitenant", "{{PLATFORM_NAME}}"
        
        Set-Content $file -Value $newContent -Encoding UTF8
        Write-Host "✓ $file atualizado" -ForegroundColor Green
    } else {
        Write-Host "⚠ $file não encontrado" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Arquivos atualizados com placeholder {{PLATFORM_NAME}}" -ForegroundColor Cyan
Write-Host "Estes placeholders podem ser substituídos dinamicamente quando necessário." -ForegroundColor Gray

Write-Host ""
Write-Host "Arquivos que mantêm 'Sistema Multitenant' (valores padrão):" -ForegroundColor Cyan
Write-Host "- backend/prisma/schema.prisma (valor padrão no banco)" -ForegroundColor Gray
Write-Host "- backend/src/common/constants/platform.constants.ts (valor padrão)" -ForegroundColor Gray
Write-Host "- frontend/src/hooks/usePlatformConfig.ts (valor padrão)" -ForegroundColor Gray
Write-Host "- frontend/public/manifest.json (estático)" -ForegroundColor Gray
Write-Host "- frontend/src/app/layout.tsx metadata (estático, mas título é atualizado dinamicamente)" -ForegroundColor Gray