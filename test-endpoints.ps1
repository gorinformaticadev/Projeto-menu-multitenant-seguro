# Script de teste dos endpoints públicos
Write-Host "🧪 Testando endpoints públicos..." -ForegroundColor Cyan
Write-Host ""

# Teste 1: Master Logo
Write-Host "1️⃣ Testando GET /tenants/public/master-logo" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:4000/tenants/public/master-logo" -Method GET -UseBasicParsing
    Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   Headers: $($response.Headers['Content-Type'])" -ForegroundColor Gray
} catch {
    Write-Host "❌ Erro: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
}

Write-Host ""

# Teste 2: Tenant Logo (exemplo com ID)
Write-Host "2️⃣ Testando GET /tenants/public/{id}/logo" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:4000/tenants/public/test-id/logo" -Method GET -UseBasicParsing
    Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   Headers: $($response.Headers['Content-Type'])" -ForegroundColor Gray
} catch {
    Write-Host "❌ Erro: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
}

Write-Host ""
Write-Host "✨ Testes concluídos!" -ForegroundColor Cyan
