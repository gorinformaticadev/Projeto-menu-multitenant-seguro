$API_URL = "http://localhost:4000"

Write-Host "=== TESTE DE CORRECAO DO LOGIN ===" -ForegroundColor Cyan
Write-Host ""

function Test-Login {
    param(
        [string]$Email,
        [string]$Password,
        [string]$Role
    )
    
    Write-Host "Testando login: $Role ($Email)" -ForegroundColor Yellow
    
    try {
        $body = @{
            email = $Email
            password = $Password
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri "$API_URL/auth/login" -Method Post -Body $body -ContentType "application/json"
        
        if ($response.accessToken -and $response.refreshToken -and $response.user) {
            Write-Host "OK Login bem-sucedido!" -ForegroundColor Green
            Write-Host "  - Access Token: $($response.accessToken.Substring(0,20))..." -ForegroundColor Gray
            Write-Host "  - Refresh Token: $($response.refreshToken.Substring(0,20))..." -ForegroundColor Gray
            Write-Host "  - Usuario: $($response.user.name) ($($response.user.role))" -ForegroundColor Gray
            Write-Host ""
            return $true
        } else {
            Write-Host "ERRO Resposta invalida do servidor" -ForegroundColor Red
            Write-Host ""
            return $false
        }
    }
    catch {
        $errorMessage = $_.Exception.Message
        Write-Host "ERRO no login: $errorMessage" -ForegroundColor Red
        Write-Host ""
        return $false
    }
}

function Test-AuthMe {
    param(
        [string]$Token
    )
    
    Write-Host "Testando endpoint /auth/me com token..." -ForegroundColor Yellow
    
    try {
        $headers = @{
            "Authorization" = "Bearer $Token"
        }
        
        $response = Invoke-RestMethod -Uri "$API_URL/auth/me" -Method Get -Headers $headers
        
        if ($response.id -and $response.email) {
            Write-Host "OK Endpoint /auth/me funcionando!" -ForegroundColor Green
            Write-Host "  - ID: $($response.id)" -ForegroundColor Gray
            Write-Host "  - Email: $($response.email)" -ForegroundColor Gray
            Write-Host "  - Nome: $($response.name)" -ForegroundColor Gray
            Write-Host "  - Role: $($response.role)" -ForegroundColor Gray
            Write-Host ""
            return $true
        } else {
            Write-Host "ERRO Resposta invalida do endpoint /auth/me" -ForegroundColor Red
            Write-Host ""
            return $false
        }
    }
    catch {
        Write-Host "ERRO ao chamar /auth/me: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
        return $false
    }
}

Write-Host "1. Testando SUPER_ADMIN" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Gray
$superAdminSuccess = Test-Login -Email "admin@system.com" -Password "admin123" -Role "SUPER_ADMIN"

Write-Host "2. Testando ADMIN" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Gray
$adminSuccess = Test-Login -Email "admin@empresa1.com" -Password "admin123" -Role "ADMIN"

Write-Host "3. Testando USER" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Gray
$userSuccess = Test-Login -Email "user@empresa1.com" -Password "user123" -Role "USER"

if ($superAdminSuccess) {
    Write-Host "4. Testando endpoint /auth/me" -ForegroundColor Cyan
    Write-Host "----------------------------------------" -ForegroundColor Gray
    
    $body = @{
        email = "admin@system.com"
        password = "admin123"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$API_URL/auth/login" -Method Post -Body $body -ContentType "application/json"
    $meSuccess = Test-AuthMe -Token $response.accessToken
}

Write-Host ""
Write-Host "=== RESUMO DOS TESTES ===" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host "SUPER_ADMIN: $(if($superAdminSuccess){'OK PASSOU'}else{'ERRO FALHOU'})" -ForegroundColor $(if($superAdminSuccess){'Green'}else{'Red'})
Write-Host "ADMIN:       $(if($adminSuccess){'OK PASSOU'}else{'ERRO FALHOU'})" -ForegroundColor $(if($adminSuccess){'Green'}else{'Red'})
Write-Host "USER:        $(if($userSuccess){'OK PASSOU'}else{'ERRO FALHOU'})" -ForegroundColor $(if($userSuccess){'Green'}else{'Red'})
if ($meSuccess -ne $null) {
    Write-Host "/auth/me:    $(if($meSuccess){'OK PASSOU'}else{'ERRO FALHOU'})" -ForegroundColor $(if($meSuccess){'Green'}else{'Red'})
}
Write-Host ""

$allPassed = $superAdminSuccess -and $adminSuccess -and $userSuccess -and ($meSuccess -eq $null -or $meSuccess)

if ($allPassed) {
    Write-Host "OK TODOS OS TESTES PASSARAM!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Proximos passos:" -ForegroundColor Yellow
    Write-Host "1. Acesse http://localhost:5000/login no navegador" -ForegroundColor White
    Write-Host "2. Faca login com uma das credenciais testadas" -ForegroundColor White
    Write-Host "3. Verifique se e redirecionado para /dashboard" -ForegroundColor White
    Write-Host "4. Confirme que o dashboard carrega corretamente" -ForegroundColor White
} else {
    Write-Host "ERRO ALGUNS TESTES FALHARAM" -ForegroundColor Red
    Write-Host "Verifique os logs acima para mais detalhes" -ForegroundColor Yellow
}

Write-Host ""
