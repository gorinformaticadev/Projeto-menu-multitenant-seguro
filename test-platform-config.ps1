# Script para testar as configurações da plataforma
# Execute este script para verificar se as novas funcionalidades estão funcionando

Write-Host "=== TESTE DE CONFIGURAÇÕES DA PLATAFORMA ===" -ForegroundColor Green
Write-Host ""

# Definir variáveis
$baseUrl = "http://localhost:3001"
$email = "admin@teste.com"
$password = "Admin123!"

Write-Host "1. Fazendo login como SUPER_ADMIN..." -ForegroundColor Yellow
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
Write-Host "3. Testando endpoints individuais..." -ForegroundColor Yellow

# Teste endpoint de nome
try {
    $nameResponse = Invoke-RestMethod -Uri "$baseUrl/platform-config/name" -Method GET
    Write-Host "✓ Nome da plataforma: $($nameResponse.platformName)" -ForegroundColor Green
} catch {
    Write-Host "✗ Erro ao buscar nome: $($_.Exception.Message)" -ForegroundColor Red
}

# Teste endpoint de email
try {
    $emailResponse = Invoke-RestMethod -Uri "$baseUrl/platform-config/email" -Method GET
    Write-Host "✓ Email da plataforma: $($emailResponse.platformEmail)" -ForegroundColor Green
} catch {
    Write-Host "✗ Erro ao buscar email: $($_.Exception.Message)" -ForegroundColor Red
}

# Teste endpoint de telefone
try {
    $phoneResponse = Invoke-RestMethod -Uri "$baseUrl/platform-config/phone" -Method GET
    Write-Host "✓ Telefone da plataforma: $($phoneResponse.platformPhone)" -ForegroundColor Green
} catch {
    Write-Host "✗ Erro ao buscar telefone: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "4. Testando atualização de configurações..." -ForegroundColor Yellow

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
Write-Host "5. Verificando se as alterações persistiram..." -ForegroundColor Yellow
try {
    Start-Sleep -Seconds 1  # Aguardar um pouco para garantir que a atualização foi processada
    $verifyConfig = Invoke-RestMethod -Uri "$baseUrl/platform-config" -Method GET -Headers $headers
    
    if ($verifyConfig.platformName -eq $newConfig.platformName) {
        Write-Host "✓ Nome atualizado corretamente" -ForegroundColor Green
    } else {
        Write-Host "✗ Nome não foi atualizado" -ForegroundColor Red
    }
    
    if ($verifyConfig.platformEmail -eq $newConfig.platformEmail) {
        Write-Host "✓ Email atualizado corretamente" -ForegroundColor Green
    } else {
        Write-Host "✗ Email não foi atualizado" -ForegroundColor Red
    }
    
    if ($verifyConfig.platformPhone -eq $newConfig.platformPhone) {
        Write-Host "✓ Telefone atualizado corretamente" -ForegroundColor Green
    } else {
        Write-Host "✗ Telefone não foi atualizado" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Erro ao verificar alterações: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "6. Restaurando configurações padrão..." -ForegroundColor Yellow

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
Write-Host "📋 RESUMO DAS FUNCIONALIDADES:" -ForegroundColor Cyan
Write-Host "✓ Configurações da plataforma no banco de dados" -ForegroundColor White
Write-Host "✓ Endpoints para buscar e atualizar configurações" -ForegroundColor White
Write-Host "✓ Endpoints individuais para nome, email e telefone" -ForegroundColor White
Write-Host "✓ Cache automático das configurações" -ForegroundColor White
Write-Host ""
Write-Host "🌐 TESTE NO FRONTEND:" -ForegroundColor Cyan
Write-Host "1. Acesse http://localhost:3000/configuracoes/seguranca" -ForegroundColor White
Write-Host "2. Vá até a seção 'Configurações da Plataforma'" -ForegroundColor White
Write-Host "3. Altere o nome, email e telefone" -ForegroundColor White
Write-Host "4. Salve as configurações" -ForegroundColor White
Write-Host "5. Verifique se o título da página mudou" -ForegroundColor White
Write-Host ""
Write-Host "🔧 COMO USAR NO CÓDIGO:" -ForegroundColor Cyan
Write-Host "Frontend: usePlatformConfig hook" -ForegroundColor White
Write-Host "Backend: getPlatformName, getPlatformEmail, getPlatformPhone functions" -ForegroundColor White
Write-Host "Veja DOCS/CONFIGURACOES_PLATAFORMA.md para exemplos completos" -ForegroundColor Gray