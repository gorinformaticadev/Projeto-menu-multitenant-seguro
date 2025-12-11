# Script de Diagnóstico de Email
# Identifica problemas comuns com envio de emails em desenvolvimento

Write-Host "=== DIAGNÓSTICO DE EMAIL ===" -ForegroundColor Green
Write-Host ""

# Definir variáveis
$baseUrl = "http://localhost:3001"
$email = "admin@teste.com"
$password = "Admin123!"

Write-Host "🔍 VERIFICANDO CONFIGURAÇÕES..." -ForegroundColor Yellow
Write-Host ""

# 1. Verificar se o backend está rodando
Write-Host "1. Testando conexão com o backend..." -ForegroundColor Cyan
try {
    $healthCheck = Invoke-RestMethod -Uri "$baseUrl/health" -Method GET -TimeoutSec 5
    Write-Host "✅ Backend está rodando" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend não está acessível em $baseUrl" -ForegroundColor Red
    Write-Host "   Certifique-se de que o backend está rodando na porta 3001" -ForegroundColor Yellow
    exit 1
}

# 2. Fazer login
Write-Host ""
Write-Host "2. Fazendo login como SUPER_ADMIN..." -ForegroundColor Cyan
try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body (@{
        email = $email
        password = $password
    } | ConvertTo-Json) -ContentType "application/json"

    if ($loginResponse.accessToken) {
        Write-Host "✅ Login realizado com sucesso" -ForegroundColor Green
        $token = $loginResponse.accessToken
        $headers = @{
            "Authorization" = "Bearer $token"
            "Content-Type" = "application/json"
        }
    } else {
        Write-Host "❌ Erro no login - token não recebido" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Erro no login: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 3. Verificar configuração de email ativa
Write-Host ""
Write-Host "3. Verificando configuração de email ativa..." -ForegroundColor Cyan
try {
    $activeConfig = Invoke-RestMethod -Uri "$baseUrl/email-config/active" -Method GET -Headers $headers
    if ($activeConfig) {
        Write-Host "✅ Configuração de email encontrada:" -ForegroundColor Green
        Write-Host "   Provedor: $($activeConfig.providerName)" -ForegroundColor White
        Write-Host "   Host: $($activeConfig.smtpHost)" -ForegroundColor White
        Write-Host "   Porta: $($activeConfig.smtpPort)" -ForegroundColor White
        Write-Host "   Criptografia: $($activeConfig.encryption)" -ForegroundColor White
    } else {
        Write-Host "⚠️  Nenhuma configuração de email ativa encontrada" -ForegroundColor Yellow
        Write-Host "   Configure um provedor de email primeiro" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Erro ao verificar configuração: $($_.Exception.Message)" -ForegroundColor Red
}

# 4. Verificar credenciais SMTP
Write-Host ""
Write-Host "4. Verificando credenciais SMTP..." -ForegroundColor Cyan
try {
    $credentials = Invoke-RestMethod -Uri "$baseUrl/email-config/smtp-credentials" -Method GET -Headers $headers
    if ($credentials.smtpUsername) {
        Write-Host "✅ Usuário SMTP configurado: $($credentials.smtpUsername)" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Usuário SMTP não configurado" -ForegroundColor Yellow
    }
    
    if ($credentials.smtpPassword) {
        Write-Host "✅ Senha SMTP configurada" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Senha SMTP não configurada" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Erro ao verificar credenciais: $($_.Exception.Message)" -ForegroundColor Red
}

# 5. Verificar variáveis de ambiente
Write-Host ""
Write-Host "5. Verificando arquivo .env do backend..." -ForegroundColor Cyan
$envPath = "backend/.env"
if (Test-Path $envPath) {
    $envContent = Get-Content $envPath
    
    # Verificar configurações SMTP
    $smtpHost = $envContent | Where-Object { $_ -match "^SMTP_HOST=" }
    $smtpPort = $envContent | Where-Object { $_ -match "^SMTP_PORT=" }
    $smtpUser = $envContent | Where-Object { $_ -match "^SMTP_USER=" }
    $smtpPass = $envContent | Where-Object { $_ -match "^SMTP_PASS=" }
    
    if ($smtpHost -and $smtpHost -notmatch '=""$') {
        Write-Host "✅ SMTP_HOST configurado no .env" -ForegroundColor Green
    } else {
        Write-Host "⚠️  SMTP_HOST não configurado no .env" -ForegroundColor Yellow
    }
    
    if ($smtpPort -and $smtpPort -notmatch '=""$') {
        Write-Host "✅ SMTP_PORT configurado no .env" -ForegroundColor Green
    } else {
        Write-Host "⚠️  SMTP_PORT não configurado no .env" -ForegroundColor Yellow
    }
    
    if ($smtpUser -and $smtpUser -notmatch '=""$') {
        Write-Host "✅ SMTP_USER configurado no .env" -ForegroundColor Green
    } else {
        Write-Host "⚠️  SMTP_USER não configurado no .env" -ForegroundColor Yellow
    }
    
    if ($smtpPass -and $smtpPass -notmatch '=""$') {
        Write-Host "✅ SMTP_PASS configurado no .env" -ForegroundColor Green
    } else {
        Write-Host "⚠️  SMTP_PASS não configurado no .env" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ Arquivo .env não encontrado em backend/" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== PROBLEMAS COMUNS EM DESENVOLVIMENTO ===" -ForegroundColor Yellow
Write-Host ""

Write-Host "📧 GMAIL:" -ForegroundColor Cyan
Write-Host "   • Use 'Senhas de app' em vez da senha normal" -ForegroundColor White
Write-Host "   • Ative autenticação de 2 fatores primeiro" -ForegroundColor White
Write-Host "   • Acesse: https://myaccount.google.com/apppasswords" -ForegroundColor Gray
Write-Host ""

Write-Host "📧 OUTLOOK/HOTMAIL:" -ForegroundColor Cyan
Write-Host "   • Use autenticação moderna (OAuth2) ou senha de app" -ForegroundColor White
Write-Host "   • Verifique se SMTP está habilitado na conta" -ForegroundColor White
Write-Host ""

Write-Host "🔧 CONFIGURAÇÃO RECOMENDADA:" -ForegroundColor Cyan
Write-Host "   1. Configure um provedor na interface (Gmail/Outlook/Titan)" -ForegroundColor White
Write-Host "   2. Use credenciais específicas para aplicação" -ForegroundColor White
Write-Host "   3. Teste a conexão antes de usar em produção" -ForegroundColor White
Write-Host ""

Write-Host "🐛 DEBUG:" -ForegroundColor Cyan
Write-Host "   • Verifique os logs do backend para erros detalhados" -ForegroundColor White
Write-Host "   • Use o teste de email na interface para diagnóstico" -ForegroundColor White
Write-Host "   • Confirme que as portas SMTP não estão bloqueadas" -ForegroundColor White
Write-Host ""

# 6. Sugestão de configuração
Write-Host "=== CONFIGURAÇÃO SUGERIDA ===" -ForegroundColor Green
Write-Host ""
Write-Host "Para Gmail (mais comum em desenvolvimento):" -ForegroundColor Cyan
Write-Host "1. Acesse https://myaccount.google.com/security" -ForegroundColor White
Write-Host "2. Ative 'Verificação em duas etapas'" -ForegroundColor White
Write-Host "3. Acesse https://myaccount.google.com/apppasswords" -ForegroundColor White
Write-Host "4. Gere uma 'Senha de app' para 'Email'" -ForegroundColor White
Write-Host "5. Use essa senha no campo 'Senha SMTP'" -ForegroundColor White
Write-Host ""

Write-Host "Configuração na interface:" -ForegroundColor Cyan
Write-Host "• Provedor: Gmail (STARTTLS - Port 587)" -ForegroundColor White
Write-Host "• Usuário SMTP: seu-email@gmail.com" -ForegroundColor White
Write-Host "• Senha SMTP: senha-de-app-gerada" -ForegroundColor White
Write-Host ""

Write-Host "=== TESTE RÁPIDO ===" -ForegroundColor Green
Write-Host "Após configurar, teste enviando um email através da interface:" -ForegroundColor White
Write-Host "http://localhost:3000/configuracoes/seguranca" -ForegroundColor Gray