# Script de teste para validar o endpoint /me/modules

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TESTE DO ENDPOINT /me/modules" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuracoes
$baseUrl = "http://localhost:4000"
$loginUrl = "$baseUrl/auth/login"
$modulesUrl = "$baseUrl/me/modules"

try {
    # 1. Fazer login para obter token
    Write-Host "1. Fazendo login..." -ForegroundColor Yellow
    
    $loginBody = @{
        email = "admin@system.com"
        password = "admin123"
    } | ConvertTo-Json
    
    $loginResponse = Invoke-RestMethod -Uri $loginUrl -Method Post -Body $loginBody -ContentType "application/json"
    
    if ($loginResponse.accessToken) {
        Write-Host "   OK Login realizado com sucesso" -ForegroundColor Green
        $token = $loginResponse.accessToken
    } else {
        Write-Host "   ERRO: Token nao recebido" -ForegroundColor Red
        exit 1
    }
    
    # 2. Testar endpoint /me/modules
    Write-Host ""
    Write-Host "2. Testando endpoint GET /me/modules..." -ForegroundColor Yellow
    
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }
    
    try {
        $modulesResponse = Invoke-RestMethod -Uri $modulesUrl -Method Get -Headers $headers
        
        Write-Host "   OK Endpoint /me/modules respondeu com sucesso!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Resposta recebida:" -ForegroundColor Cyan
        $modulesResponse | ConvertTo-Json -Depth 5 | Write-Host
        
        if ($modulesResponse.modules) {
            $count = $modulesResponse.modules.Count
            Write-Host ""
            Write-Host "OK $count modulo(s) disponivel(is)" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "AVISO: Nenhum modulo retornado (array vazio)" -ForegroundColor Yellow
        }
        
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 404) {
            Write-Host "   ERRO 404: Endpoint nao encontrado!" -ForegroundColor Red
            Write-Host "   Isso significa que o controller nao esta registrado corretamente." -ForegroundColor Red
        } elseif ($statusCode -eq 401) {
            Write-Host "   ERRO 401: Nao autorizado!" -ForegroundColor Red
            Write-Host "   Token pode estar invalido ou expirado." -ForegroundColor Red
        } else {
            Write-Host "   ERRO $statusCode" -ForegroundColor Red
        }
        Write-Host "   Detalhes: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "TESTE CONCLUIDO COM SUCESSO!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "ERRO GERAL: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
