# Script para testar as configurações de email
# Execute este script para verificar se as melhorias estão funcionando

Write-Host "=== TESTE DE CONFIGURAÇÕES DE EMAIL ===" -ForegroundColor Green
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
Write-Host "2. Testando endpoint de provedores pré-configurados..." -ForegroundColor Yellow
try {
    $providers = Invoke-RestMethod -Uri "$baseUrl/email-config/providers" -Method GET -Headers $headers
    Write-Host "✓ Provedores encontrados:" -ForegroundColor Green
    foreach ($provider in $providers) {
        Write-Host "  - $($provider.providerName)" -ForegroundColor Cyan
        Write-Host "    Host: $($provider.smtpHost):$($provider.smtpPort)" -ForegroundColor Gray
        Write-Host "    Criptografia: $($provider.encryption)" -ForegroundColor Gray
        if ($provider.description) {
            Write-Host "    Descrição: $($provider.description)" -ForegroundColor Gray
        }
        Write-Host ""
    }
} catch {
    Write-Host "✗ Erro ao buscar provedores: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "3. Testando endpoint de credenciais SMTP..." -ForegroundColor Yellow
try {
    $credentials = Invoke-RestMethod -Uri "$baseUrl/email-config/smtp-credentials" -Method GET -Headers $headers
    Write-Host "✓ Credenciais SMTP:" -ForegroundColor Green
    if ($credentials.smtpUsername) {
        Write-Host "  Usuário: $($credentials.smtpUsername)" -ForegroundColor Cyan
    } else {
        Write-Host "  Usuário: (não configurado)" -ForegroundColor Gray
    }
    if ($credentials.smtpPassword) {
        Write-Host "  Senha: (configurada)" -ForegroundColor Cyan
    } else {
        Write-Host "  Senha: (não configurada)" -ForegroundColor Gray
    }
} catch {
    Write-Host "✗ Erro ao buscar credenciais: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "4. Testando configuração ativa..." -ForegroundColor Yellow
try {
    $activeConfig = Invoke-RestMethod -Uri "$baseUrl/email-config/active" -Method GET -Headers $headers
    if ($activeConfig) {
        Write-Host "✓ Configuração ativa encontrada:" -ForegroundColor Green
        Write-Host "  Provedor: $($activeConfig.providerName)" -ForegroundColor Cyan
        Write-Host "  Host: $($activeConfig.smtpHost):$($activeConfig.smtpPort)" -ForegroundColor Cyan
        Write-Host "  Criptografia: $($activeConfig.encryption)" -ForegroundColor Cyan
    } else {
        Write-Host "ℹ Nenhuma configuração ativa encontrada" -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ Erro ao buscar configuração ativa: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "5. Testando criação de nova configuração (Gmail)..." -ForegroundColor Yellow
try {
    $newConfig = @{
        providerName = "Gmail (STARTTLS - Port 587)"
        smtpHost = "smtp.gmail.com"
        smtpPort = 587
        encryption = "STARTTLS"
        authMethod = "LOGIN"
    }
    
    $createResponse = Invoke-RestMethod -Uri "$baseUrl/email-config" -Method POST -Body ($newConfig | ConvertTo-Json) -Headers $headers
    Write-Host "✓ Nova configuração criada com sucesso:" -ForegroundColor Green
    Write-Host "  ID: $($createResponse.id)" -ForegroundColor Cyan
    Write-Host "  Provedor: $($createResponse.providerName)" -ForegroundColor Cyan
    Write-Host "  Ativa: $($createResponse.isActive)" -ForegroundColor Cyan
} catch {
    Write-Host "✗ Erro ao criar configuração: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "6. Verificando se apenas uma configuração existe..." -ForegroundColor Yellow
try {
    $allConfigs = Invoke-RestMethod -Uri "$baseUrl/email-config" -Method GET -Headers $headers
    Write-Host "✓ Total de configurações: $($allConfigs.Count)" -ForegroundColor Green
    
    if ($allConfigs.Count -eq 1) {
        Write-Host "✓ Política de configuração única está funcionando!" -ForegroundColor Green
    } elseif ($allConfigs.Count -gt 1) {
        Write-Host "⚠ Atenção: Mais de uma configuração encontrada!" -ForegroundColor Yellow
    } else {
        Write-Host "ℹ Nenhuma configuração encontrada" -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ Erro ao listar configurações: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== TESTE CONCLUÍDO ===" -ForegroundColor Green
Write-Host ""
Write-Host "Para testar o frontend:" -ForegroundColor Cyan
Write-Host "1. Acesse http://localhost:3000/configuracoes/seguranca" -ForegroundColor Gray
Write-Host "2. Faça login como SUPER_ADMIN" -ForegroundColor Gray
Write-Host "3. Role até a seção 'Configurações de Email'" -ForegroundColor Gray
Write-Host "4. Teste a seleção de provedores pré-configurados" -ForegroundColor Gray
Write-Host "5. Verifique se as credenciais são carregadas automaticamente" -ForegroundColor Gray