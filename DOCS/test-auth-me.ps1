# Script para testar o endpoint /auth/me
$baseUrl = "http://localhost:4000"

# 1. Fazer Login para obter o token
$loginBody = @{
    email = "admin@example.com" # Substitua por um email válido no seu banco de dados de teste
    password = "password123" # Substitua pela senha correta
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    $token = $loginResponse.accessToken
    Write-Host "Login realizado com sucesso. Token obtido." -ForegroundColor Green
}
catch {
    Write-Host "Erro ao fazer login: $($_.Exception.Message)" -ForegroundColor Red
    exit
}

# 2. Testar endpoint /auth/me
try {
    $headers = @{
        Authorization = "Bearer $token"
    }
    $meResponse = Invoke-RestMethod -Uri "$baseUrl/auth/me" -Method Get -Headers $headers
    
    Write-Host "`nDados do Usuário (/auth/me):" -ForegroundColor Cyan
    $meResponse | Format-List

    if ($meResponse.email -eq "admin@example.com") {
        Write-Host "Teste do endpoint /auth/me PASSOU!" -ForegroundColor Green
    } else {
        Write-Host "Teste do endpoint /auth/me FALHOU: Email incorreto." -ForegroundColor Red
    }
}
catch {
    Write-Host "Erro ao acessar /auth/me: $($_.Exception.Message)" -ForegroundColor Red
}
