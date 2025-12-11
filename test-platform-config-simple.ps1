# Script simples para testar as configurações da plataforma

Write-Host "=== TESTE DE CONFIGURAÇÕES DA PLATAFORMA ===" -ForegroundColor Green
Write-Host ""

# Definir variáveis
$baseUrl = "http://localhost:3001"
$email = "admin@teste.com"
$password = "Admin123!"

Write-Host "1. Fazendo login como SUPER_ADMIN..." -ForegroundColor Yellow
try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body (@{
        email = $email
        password = $password
    } | ConvertTo-Json) -ContentType "application/json"

    if ($loginResponse.accessToken) {
        Write-Host "✓ Login realizado com sucesso" -ForegroundColor Green
        $token = $loginResponse.accessToken
        $headers = @{
            "Authorization" = "Bearer $token"
            "Content-Type" = "application/json"
        }
    } else {
        Write-Host "✗ Erro no login" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Erro no login: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "2. Testando configurações atuais da plataforma..." -ForegroundColor Yellow
try {
    $currentConfig = Invoke-RestMethod -Uri "$baseUrl/platform-config" -Method GET -Headers $headers
    Write-Host "✓ Configurações atuais:" -ForegroundColor Green
    Write-Host "  Nome: $($currentConfig.platformName)" -ForegroundColor Cyan
    Write-Host "  Email: $($currentConfig.platformEmail)" -ForegroundColor Cyan
    Write-Host "  Telefone: $($currentConfig.platformPhone)" -ForegroundColor Cyan
} catch {
    Write-Host "✗ Erro ao buscar configurações: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "3. Testando atualização de configurações..." -ForegroundColor Yellow
$newConfig = @{
    platformName = "Minha Plataforma Teste"
    platformEmail = "contato@minhaplataforma.com"
    platformPhone = "(11) 98765-4321"
}

try {
    $updateResponse = Invoke-RestMethod -Uri "$baseUrl/platform-config" -Method PUT -Body ($newConfig | ConvertTo-Json) -Headers $headers
    Write-Host "✓ Configurações atualizadas com sucesso:" -ForegroundColor Green
    Write-Host "  Nome: $($updateResponse.platformName)" -ForegroundColor Cyan
    Write-Host "  Email: $($updateResponse.platformEmail)" -ForegroundColor Cyan
    Write-Host "  Telefone: $($updateResponse.platformPhone)" -ForegroundColor Cyan
} catch {
    Write-Host "✗ Erro ao atualizar configurações: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "4. Restaurando configurações padrão..." -ForegroundColor Yellow
$defaultConfig = @{
    platformName = "Sistema Multitenant"
    platformEmail = "contato@sistema.com"
    platformPhone = "(11) 99999-9999"
}

try {
    $restoreResponse = Invoke-RestMethod -Uri "$baseUrl/platform-config" -Method PUT -Body ($defaultConfig | ConvertTo-Json) -Headers $headers
    Write-Host "✓ Configurações padrão restauradas" -ForegroundColor Green
} catch {
    Write-Host "✗ Erro ao restaurar configurações: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== TESTE CONCLUÍDO ===" -ForegroundColor Green
Write-Host ""
Write-Host "Para testar no frontend:" -ForegroundColor Cyan
Write-Host "1. Acesse http://localhost:3000/configuracoes/seguranca" -ForegroundColor White
Write-Host "2. Vá até 'Configurações da Plataforma'" -ForegroundColor White
Write-Host "3. Altere o nome, email e telefone" -ForegroundColor White
Write-Host "4. Salve as configurações" -ForegroundColor White
Write-Host "5. Verifique se o título da página mudou" -ForegroundColor White