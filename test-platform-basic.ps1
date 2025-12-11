# Teste básico das configurações da plataforma

$baseUrl = "http://localhost:4000"
$email = "admin@sistema.com"
$password = "Admin123!"

Write-Host "Testando configurações da plataforma..." -ForegroundColor Green

# Login
$loginBody = @{
    email = $email
    password = $password
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body $loginBody -ContentType "application/json"

if ($loginResponse.accessToken) {
    Write-Host "Login OK" -ForegroundColor Green
    
    $headers = @{
        "Authorization" = "Bearer $($loginResponse.accessToken)"
        "Content-Type" = "application/json"
    }
    
    # Testar busca de configurações
    $config = Invoke-RestMethod -Uri "$baseUrl/platform-config" -Method GET -Headers $headers
    Write-Host "Nome atual: $($config.platformName)" -ForegroundColor Cyan
    
    # Testar atualização
    $newConfig = @{
        platformName = "Teste Plataforma"
        platformEmail = "teste@exemplo.com"
        platformPhone = "(11) 12345-6789"
    } | ConvertTo-Json
    
    $updateResult = Invoke-RestMethod -Uri "$baseUrl/platform-config" -Method PUT -Body $newConfig -Headers $headers
    Write-Host "Novo nome: $($updateResult.platformName)" -ForegroundColor Green
    
    Write-Host "Teste concluído com sucesso!" -ForegroundColor Green
} else {
    Write-Host "Erro no login" -ForegroundColor Red
}