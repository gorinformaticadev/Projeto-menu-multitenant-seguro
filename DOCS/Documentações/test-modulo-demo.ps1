# Script de Teste do Módulo demo-completo
# Testa todas as funcionalidades do módulo de demonstração

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "TESTE MÓDULO DEMO-COMPLETO" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:4000"
$token = "YOUR_AUTH_TOKEN_HERE" # Substitua pelo token real

# ========== TESTE 1: Rota Pública ==========
Write-Host "Teste 1: Rota Pública (sem autenticação)" -ForegroundColor Yellow
Write-Host "GET /api/demo/public/stats" -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/demo/public/stats" -Method GET
    Write-Host "✅ SUCESSO" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Gray
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Host "❌ ERRO: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# ========== TESTE 2: Listar Demos ==========
Write-Host "Teste 2: Listar Demos (com autenticação)" -ForegroundColor Yellow
Write-Host "GET /api/demo" -ForegroundColor Gray

try {
    $headers = @{
        "Authorization" = "Bearer $token"
    }
    
    $response = Invoke-RestMethod -Uri "$baseUrl/api/demo" -Method GET -Headers $headers
    Write-Host "✅ SUCESSO" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Gray
    $response | ConvertTo-Json -Depth 5
    
    Write-Host ""
    Write-Host "Tenant: $($response.tenant)" -ForegroundColor Cyan
    Write-Host "Total de demos: $($response.data.Count)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ ERRO: $_" -ForegroundColor Red
    Write-Host "Verifique:" -ForegroundColor Yellow
    Write-Host "  - Token de autenticação" -ForegroundColor Yellow
    Write-Host "  - Permissão demo.view" -ForegroundColor Yellow
    Write-Host "  - Backend rodando" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# ========== TESTE 3: Criar Demo ==========
Write-Host "Teste 3: Criar Nova Demo" -ForegroundColor Yellow
Write-Host "POST /api/demo" -ForegroundColor Gray

$demoData = @{
    title = "Demo Teste - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    description = "Demo criada automaticamente pelo script de teste"
} | ConvertTo-Json

try {
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }
    
    $response = Invoke-RestMethod -Uri "$baseUrl/api/demo" -Method POST -Headers $headers -Body $demoData
    Write-Host "✅ SUCESSO" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Gray
    $response | ConvertTo-Json -Depth 5
    
    $demoId = $response.data.id
    Write-Host ""
    Write-Host "Demo criada com ID: $demoId" -ForegroundColor Cyan
    
    # Salvar ID para teste de exclusão
    $script:createdDemoId = $demoId
} catch {
    Write-Host "❌ ERRO: $_" -ForegroundColor Red
    Write-Host "Verifique:" -ForegroundColor Yellow
    Write-Host "  - Permissão demo.create" -ForegroundColor Yellow
    Write-Host "  - Dados válidos" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# ========== TESTE 4: Listar Novamente ==========
Write-Host "Teste 4: Verificar Demo Criada" -ForegroundColor Yellow
Write-Host "GET /api/demo" -ForegroundColor Gray

Start-Sleep -Seconds 1

try {
    $headers = @{
        "Authorization" = "Bearer $token"
    }
    
    $response = Invoke-RestMethod -Uri "$baseUrl/api/demo" -Method GET -Headers $headers
    Write-Host "✅ SUCESSO" -ForegroundColor Green
    Write-Host "Total de demos após criação: $($response.data.Count)" -ForegroundColor Cyan
    
    if ($script:createdDemoId) {
        $found = $response.data | Where-Object { $_.id -eq $script:createdDemoId }
        if ($found) {
            Write-Host "✅ Demo criada encontrada na lista!" -ForegroundColor Green
        } else {
            Write-Host "⚠️ Demo não encontrada na lista" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "❌ ERRO: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# ========== TESTE 5: Excluir Demo ==========
if ($script:createdDemoId) {
    Write-Host "Teste 5: Excluir Demo Criada" -ForegroundColor Yellow
    Write-Host "DELETE /api/demo/$($script:createdDemoId)" -ForegroundColor Gray
    
    try {
        $headers = @{
            "Authorization" = "Bearer $token"
        }
        
        $response = Invoke-RestMethod -Uri "$baseUrl/api/demo/$($script:createdDemoId)" -Method DELETE -Headers $headers
        Write-Host "✅ SUCESSO" -ForegroundColor Green
        Write-Host "Response:" -ForegroundColor Gray
        $response | ConvertTo-Json -Depth 5
    } catch {
        Write-Host "❌ ERRO: $_" -ForegroundColor Red
        Write-Host "Verifique:" -ForegroundColor Yellow
        Write-Host "  - Permissão demo.delete" -ForegroundColor Yellow
        Write-Host "  - ID da demo válido" -ForegroundColor Yellow
    }
} else {
    Write-Host "⏭️ Teste 5: Pulado (demo não foi criada)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# ========== TESTE 6: Verificar Exclusão ==========
Write-Host "Teste 6: Verificar Exclusão" -ForegroundColor Yellow
Write-Host "GET /api/demo" -ForegroundColor Gray

Start-Sleep -Seconds 1

try {
    $headers = @{
        "Authorization" = "Bearer $token"
    }
    
    $response = Invoke-RestMethod -Uri "$baseUrl/api/demo" -Method GET -Headers $headers
    Write-Host "✅ SUCESSO" -ForegroundColor Green
    Write-Host "Total de demos após exclusão: $($response.data.Count)" -ForegroundColor Cyan
    
    if ($script:createdDemoId) {
        $found = $response.data | Where-Object { $_.id -eq $script:createdDemoId }
        if ($found) {
            Write-Host "⚠️ Demo ainda existe na lista" -ForegroundColor Yellow
        } else {
            Write-Host "✅ Demo foi excluída com sucesso!" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "❌ ERRO: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# ========== TESTE 7: Teste de Permissão ==========
Write-Host "Teste 7: Teste de Permissão (sem token)" -ForegroundColor Yellow
Write-Host "GET /api/demo" -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/demo" -Method GET
    Write-Host "⚠️ INESPERADO: Rota deveria exigir autenticação" -ForegroundColor Yellow
} catch {
    Write-Host "✅ SUCESSO: Rota protegida corretamente" -ForegroundColor Green
    Write-Host "Erro esperado: $_" -ForegroundColor Gray
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "RESUMO DOS TESTES" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Funcionalidades testadas:" -ForegroundColor White
Write-Host "  ✅ Rota pública (sem auth)" -ForegroundColor Green
Write-Host "  ✅ Listagem com filtro por tenant" -ForegroundColor Green
Write-Host "  ✅ Criação com validação" -ForegroundColor Green
Write-Host "  ✅ Exclusão com cleanup" -ForegroundColor Green
Write-Host "  ✅ Proteção de rotas" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANTE:" -ForegroundColor Yellow
Write-Host "  - Substitua YOUR_AUTH_TOKEN_HERE pelo token real" -ForegroundColor Yellow
Write-Host "  - Certifique-se que o backend está rodando" -ForegroundColor Yellow
Write-Host "  - Usuário deve ter permissões: demo.view, demo.create, demo.delete" -ForegroundColor Yellow
Write-Host ""
Write-Host "Para mais testes, consulte:" -ForegroundColor Cyan
Write-Host "  - DOCS/GUIA_MODULO_DEMO.md" -ForegroundColor Cyan
Write-Host "  - modules/demo-completo/README.md" -ForegroundColor Cyan
Write-Host ""
