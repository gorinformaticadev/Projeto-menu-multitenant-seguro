# Script para testar validação de senha

Write-Host "🧪 Testando validação de senha..." -ForegroundColor Cyan
Write-Host ""

# Fazer login
Write-Host "1️⃣ Fazendo login..." -ForegroundColor Yellow
$loginBody = @{
    email = "superadmin@system.com"
    password = "Super@123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:4000/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    $token = $loginResponse.accessToken
    Write-Host "✅ Login realizado" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "❌ Erro no login: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $token"
}

# Teste 1: Senha fraca (sem maiúscula)
Write-Host "2️⃣ Teste 1: Senha fraca (sem maiúscula) - 'senha123!'" -ForegroundColor Yellow
$userBody1 = @{
    email = "teste1@example.com"
    password = "senha123!"
    name = "Teste 1"
    role = "USER"
} | ConvertTo-Json

try {
    $response1 = Invoke-RestMethod -Uri "http://localhost:4000/users" -Method POST -Body $userBody1 -ContentType "application/json" -Headers $headers
    Write-Host "❌ FALHOU: Senha fraca foi aceita!" -ForegroundColor Red
} catch {
    Write-Host "✅ PASSOU: Senha fraca foi rejeitada" -ForegroundColor Green
    if ($_.ErrorDetails.Message) {
        $errorObj = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "   Mensagem: $($errorObj.message)" -ForegroundColor Gray
    }
}
Write-Host ""

# Teste 2: Senha fraca (sem número)
Write-Host "3️⃣ Teste 2: Senha fraca (sem número) - 'SenhaForte!'" -ForegroundColor Yellow
$userBody2 = @{
    email = "teste2@example.com"
    password = "SenhaForte!"
    name = "Teste 2"
    role = "USER"
} | ConvertTo-Json

try {
    $response2 = Invoke-RestMethod -Uri "http://localhost:4000/users" -Method POST -Body $userBody2 -ContentType "application/json" -Headers $headers
    Write-Host "❌ FALHOU: Senha fraca foi aceita!" -ForegroundColor Red
} catch {
    Write-Host "✅ PASSOU: Senha fraca foi rejeitada" -ForegroundColor Green
    if ($_.ErrorDetails.Message) {
        $errorObj = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "   Mensagem: $($errorObj.message)" -ForegroundColor Gray
    }
}
Write-Host ""

# Teste 3: Senha forte
Write-Host "4️⃣ Teste 3: Senha forte - 'SenhaForte123!'" -ForegroundColor Yellow
$userBody3 = @{
    email = "teste3@example.com"
    password = "SenhaForte123!"
    name = "Teste 3"
    role = "USER"
} | ConvertTo-Json

try {
    $response3 = Invoke-RestMethod -Uri "http://localhost:4000/users" -Method POST -Body $userBody3 -ContentType "application/json" -Headers $headers
    Write-Host "✅ PASSOU: Senha forte foi aceita" -ForegroundColor Green
    Write-Host "   Usuário criado: $($response3.email)" -ForegroundColor Gray
    
    # Limpar - deletar usuário de teste
    try {
        Invoke-RestMethod -Uri "http://localhost:4000/users/$($response3.id)" -Method DELETE -Headers $headers | Out-Null
        Write-Host "   Usuário de teste removido" -ForegroundColor Gray
    } catch {
        Write-Host "   Aviso: Não foi possível remover usuário de teste" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ FALHOU: Senha forte foi rejeitada!" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        $errorObj = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "   Mensagem: $($errorObj.message)" -ForegroundColor Gray
    }
}
Write-Host ""

Write-Host "✨ Testes concluídos!" -ForegroundColor Cyan
