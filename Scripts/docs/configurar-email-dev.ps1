# Script para Configurar Email em Desenvolvimento
# Configura automaticamente um provedor de email para testes

param(
    [Parameter(Mandatory=$true)]
    [string]$EmailUsuario,
    
    [Parameter(Mandatory=$true)]
    [string]$SenhaEmail,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("Gmail", "Outlook", "Titan")]
    [string]$Provedor = "Gmail"
)

Write-Host "=== CONFIGURAÇÃO AUTOMÁTICA DE EMAIL ===" -ForegroundColor Green
Write-Host ""

# Definir variáveis
$baseUrl = "http://localhost:3001"
$adminEmail = "admin@teste.com"
$adminPassword = "Admin123!"

Write-Host "📧 Configurando provedor: $Provedor" -ForegroundColor Cyan
Write-Host "👤 Usuário: $EmailUsuario" -ForegroundColor Cyan
Write-Host ""

# 1. Fazer login como SUPER_ADMIN
Write-Host "1. Fazendo login como SUPER_ADMIN..." -ForegroundColor Yellow
try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body (@{
        email = $adminEmail
        password = $adminPassword
    } | ConvertTo-Json) -ContentType "application/json"

    if ($loginResponse.accessToken) {
        Write-Host "✅ Login realizado com sucesso" -ForegroundColor Green
        $token = $loginResponse.accessToken
        $headers = @{
            "Authorization" = "Bearer $token"
            "Content-Type" = "application/json"
        }
    } else {
        Write-Host "❌ Erro no login" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Erro no login: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 2. Configurar credenciais SMTP no SecurityConfig
Write-Host ""
Write-Host "2. Salvando credenciais SMTP..." -ForegroundColor Yellow
try {
    $securityUpdate = @{
        smtpUsername = $EmailUsuario
        smtpPassword = $SenhaEmail
    }
    
    $securityResponse = Invoke-RestMethod -Uri "$baseUrl/security-config" -Method PUT -Body ($securityUpdate | ConvertTo-Json) -Headers $headers
    Write-Host "✅ Credenciais SMTP salvas com sucesso" -ForegroundColor Green
} catch {
    Write-Host "❌ Erro ao salvar credenciais: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 3. Configurar provedor de email
Write-Host ""
Write-Host "3. Configurando provedor de email..." -ForegroundColor Yellow

# Definir configurações por provedor
$emailConfig = @{}
switch ($Provedor) {
    "Gmail" {
        $emailConfig = @{
            providerName = "Gmail (STARTTLS - Port 587)"
            smtpHost = "smtp.gmail.com"
            smtpPort = 587
            encryption = "STARTTLS"
            authMethod = "LOGIN"
        }
    }
    "Outlook" {
        $emailConfig = @{
            providerName = "Hotmail/Outlook (STARTTLS - Port 587)"
            smtpHost = "smtp-mail.outlook.com"
            smtpPort = 587
            encryption = "STARTTLS"
            authMethod = "LOGIN"
        }
    }
    "Titan" {
        $emailConfig = @{
            providerName = "Titan Mail (SSL/TLS - Port 465)"
            smtpHost = "smtp.titan.email"
            smtpPort = 465
            encryption = "SSL"
            authMethod = "LOGIN"
        }
    }
}

try {
    $configResponse = Invoke-RestMethod -Uri "$baseUrl/email-config" -Method POST -Body ($emailConfig | ConvertTo-Json) -Headers $headers
    Write-Host "✅ Provedor de email configurado com sucesso" -ForegroundColor Green
    Write-Host "   ID: $($configResponse.id)" -ForegroundColor Gray
    Write-Host "   Provedor: $($configResponse.providerName)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Erro ao configurar provedor: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 4. Testar configuração
Write-Host ""
Write-Host "4. Testando configuração de email..." -ForegroundColor Yellow

$emailTeste = Read-Host "Digite um email para teste (ou pressione Enter para usar $EmailUsuario)"
if ([string]::IsNullOrWhiteSpace($emailTeste)) {
    $emailTeste = $EmailUsuario
}

try {
    $testBody = @{
        email = $emailTeste
        smtpUser = $EmailUsuario
        smtpPass = $SenhaEmail
    }
    
    $testResponse = Invoke-RestMethod -Uri "$baseUrl/email-config/test" -Method POST -Body ($testBody | ConvertTo-Json) -Headers $headers
    
    if ($testResponse.success) {
        Write-Host "✅ Email de teste enviado com sucesso!" -ForegroundColor Green
        Write-Host "   Verifique a caixa de entrada de: $emailTeste" -ForegroundColor Gray
    } else {
        Write-Host "❌ Falha no teste de email: $($testResponse.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erro no teste de email: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔍 POSSÍVEIS CAUSAS:" -ForegroundColor Yellow
    
    if ($Provedor -eq "Gmail") {
        Write-Host "   • Você está usando a senha normal em vez de 'Senha de app'" -ForegroundColor White
        Write-Host "   • Autenticação de 2 fatores não está ativada" -ForegroundColor White
        Write-Host "   • Acesse: https://myaccount.google.com/apppasswords" -ForegroundColor Gray
    } elseif ($Provedor -eq "Outlook") {
        Write-Host "   • SMTP pode estar desabilitado na conta Outlook" -ForegroundColor White
        Write-Host "   • Tente usar autenticação moderna ou senha de app" -ForegroundColor White
    }
    
    Write-Host "   • Verifique se as credenciais estão corretas" -ForegroundColor White
    Write-Host "   • Firewall pode estar bloqueando a porta SMTP" -ForegroundColor White
}

Write-Host ""
Write-Host "=== CONFIGURAÇÃO CONCLUÍDA ===" -ForegroundColor Green
Write-Host ""
Write-Host "📋 RESUMO:" -ForegroundColor Cyan
Write-Host "   Provedor: $($emailConfig.providerName)" -ForegroundColor White
Write-Host "   Servidor: $($emailConfig.smtpHost):$($emailConfig.smtpPort)" -ForegroundColor White
Write-Host "   Criptografia: $($emailConfig.encryption)" -ForegroundColor White
Write-Host "   Usuário: $EmailUsuario" -ForegroundColor White
Write-Host ""

Write-Host "🌐 ACESSE A INTERFACE:" -ForegroundColor Cyan
Write-Host "   http://localhost:3000/configuracoes/seguranca" -ForegroundColor Gray
Write-Host ""

Write-Host "💡 DICAS PARA GMAIL:" -ForegroundColor Yellow
Write-Host "   1. Ative autenticação de 2 fatores" -ForegroundColor White
Write-Host "   2. Gere uma 'Senha de app' específica" -ForegroundColor White
Write-Host "   3. Use a senha de app em vez da senha normal" -ForegroundColor White
Write-Host "   4. Link: https://myaccount.google.com/apppasswords" -ForegroundColor Gray