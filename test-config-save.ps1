# Script para testar salvamento de configurações

Write-Host "🧪 Testando salvamento de configurações..." -ForegroundColor Cyan
Write-Host ""

# Primeiro, fazer login para obter o token
Write-Host "1️⃣ Fazendo login..." -ForegroundColor Yellow
$loginBody = @{
    email = "superadmin@system.com"
    password = "Super@123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:4000/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    $token = $loginResponse.accessToken
    Write-Host "✅ Login realizado com sucesso" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "❌ Erro no login: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Buscar configurações atuais
Write-Host "2️⃣ Buscando configurações atuais..." -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer $token"
    }
    $currentConfig = Invoke-RestMethod -Uri "http://localhost:4000/security-config" -Method GET -Headers $headers
    Write-Host "✅ Configurações obtidas:" -ForegroundColor Green
    Write-Host "   loginMaxAttempts: $($currentConfig.loginMaxAttempts)" -ForegroundColor Gray
    Write-Host "   loginLockDurationMinutes: $($currentConfig.loginLockDurationMinutes)" -ForegroundColor Gray
    Write-Host "   sessionTimeoutMinutes: $($currentConfig.sessionTimeoutMinutes)" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "❌ Erro ao buscar configurações: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    exit 1
}

# Tentar salvar configurações
Write-Host "3️⃣ Salvando configurações de teste..." -ForegroundColor Yellow
$updateBody = @{
    loginMaxAttempts = 3
    loginLockDurationMinutes = 10
    sessionTimeoutMinutes = 15
} | ConvertTo-Json

try {
    $updateResponse = Invoke-RestMethod -Uri "http://localhost:4000/security-config" -Method PUT -Body $updateBody -ContentType "application/json" -Headers $headers
    Write-Host "✅ Configurações salvas com sucesso!" -ForegroundColor Green
    Write-Host "   loginMaxAttempts: $($updateResponse.loginMaxAttempts)" -ForegroundColor Gray
    Write-Host "   loginLockDurationMinutes: $($updateResponse.loginLockDurationMinutes)" -ForegroundColor Gray
    Write-Host "   sessionTimeoutMinutes: $($updateResponse.sessionTimeoutMinutes)" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "❌ Erro ao salvar configurações:" -ForegroundColor Red
    Write-Host "   Mensagem: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "   Detalhes: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    exit 1
}

Write-Host "✨ Teste concluído com sucesso!" -ForegroundColor Green
