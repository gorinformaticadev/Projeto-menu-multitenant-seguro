# Script para testar os endpoints de tipos de serviço e equipamento
# Execute: .\test-tipos-servico-equipamento.ps1

$baseUrl = "http://localhost:3001"
$token = "seu_token_aqui"  # Substitua pelo token real

# Headers padrão
$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $token"
}

Write-Host "🧪 Testando endpoints de Tipos de Serviço e Equipamento" -ForegroundColor Cyan
Write-Host "=" * 60

# Função para fazer requisições
function Invoke-ApiRequest {
    param(
        [string]$Method,
        [string]$Endpoint,
        [object]$Body = $null
    )
    
    $url = "$baseUrl$Endpoint"
    Write-Host "📡 $Method $url" -ForegroundColor Yellow
    
    try {
        $params = @{
            Uri = $url
            Method = $Method
            Headers = $headers
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
        }
        
        $response = Invoke-RestMethod @params
        Write-Host "✅ Sucesso:" -ForegroundColor Green
        $response | ConvertTo-Json -Depth 10 | Write-Host
        return $response
    }
    catch {
        Write-Host "❌ Erro: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "Detalhes: $responseBody" -ForegroundColor Red
        }
    }
    Write-Host ""
}

# 1. Testar listagem de tipos de serviço
Write-Host "1️⃣ Listando tipos de serviço..." -ForegroundColor Blue
$tiposServico = Invoke-ApiRequest -Method "GET" -Endpoint "/api/ordem_servico/tipos-servico"

# 2. Testar criação de novo tipo de serviço
Write-Host "2️⃣ Criando novo tipo de serviço..." -ForegroundColor Blue
$novoTipoServico = @{
    nome = "Instalação de Software"
    descricao = "Instalação e configuração de softwares diversos"
}
$tipoServicoCriado = Invoke-ApiRequest -Method "POST" -Endpoint "/api/ordem_servico/tipos-servico" -Body $novoTipoServico

# 3. Testar listagem de tipos de equipamento
Write-Host "3️⃣ Listando tipos de equipamento..." -ForegroundColor Blue
$tiposEquipamento = Invoke-ApiRequest -Method "GET" -Endpoint "/api/ordem_servico/tipos-equipamento"

# 4. Testar criação de novo tipo de equipamento
Write-Host "4️⃣ Criando novo tipo de equipamento..." -ForegroundColor Blue
$novoTipoEquipamento = @{
    nome = "Servidor"
    descricao = "Servidor de rede ou aplicação"
}
$tipoEquipamentoCriado = Invoke-ApiRequest -Method "POST" -Endpoint "/api/ordem_servico/tipos-equipamento" -Body $novoTipoEquipamento

# 5. Testar edição de tipo de serviço (se foi criado)
if ($tipoServicoCriado -and $tipoServicoCriado.id) {
    Write-Host "5️⃣ Editando tipo de serviço criado..." -ForegroundColor Blue
    $edicaoTipoServico = @{
        nome = "Instalação de Software Atualizado"
        descricao = "Instalação e configuração de softwares diversos - versão atualizada"
    }
    Invoke-ApiRequest -Method "PUT" -Endpoint "/api/ordem_servico/tipos-servico/$($tipoServicoCriado.id)" -Body $edicaoTipoServico
}

# 6. Testar edição de tipo de equipamento (se foi criado)
if ($tipoEquipamentoCriado -and $tipoEquipamentoCriado.id) {
    Write-Host "6️⃣ Editando tipo de equipamento criado..." -ForegroundColor Blue
    $edicaoTipoEquipamento = @{
        nome = "Servidor Atualizado"
        descricao = "Servidor de rede ou aplicação - versão atualizada"
    }
    Invoke-ApiRequest -Method "PUT" -Endpoint "/api/ordem_servico/tipos-equipamento/$($tipoEquipamentoCriado.id)" -Body $edicaoTipoEquipamento
}

# 7. Testar tentativa de exclusão de tipo padrão (deve falhar)
if ($tiposServico -and $tiposServico.Count -gt 0) {
    $tipoPadrao = $tiposServico | Where-Object { $_.is_default -eq $true } | Select-Object -First 1
    if ($tipoPadrao) {
        Write-Host "7️⃣ Testando exclusão de tipo padrão (deve falhar)..." -ForegroundColor Blue
        Invoke-ApiRequest -Method "DELETE" -Endpoint "/api/ordem_servico/tipos-servico/$($tipoPadrao.id)"
    }
}

# 8. Testar exclusão de tipo personalizado (se foi criado)
if ($tipoServicoCriado -and $tipoServicoCriado.id) {
    Write-Host "8️⃣ Excluindo tipo de serviço personalizado..." -ForegroundColor Blue
    Invoke-ApiRequest -Method "DELETE" -Endpoint "/api/ordem_servico/tipos-servico/$($tipoServicoCriado.id)"
}

if ($tipoEquipamentoCriado -and $tipoEquipamentoCriado.id) {
    Write-Host "9️⃣ Excluindo tipo de equipamento personalizado..." -ForegroundColor Blue
    Invoke-ApiRequest -Method "DELETE" -Endpoint "/api/ordem_servico/tipos-equipamento/$($tipoEquipamentoCriado.id)"
}

Write-Host "🎉 Testes concluídos!" -ForegroundColor Green
Write-Host "=" * 60

Write-Host "📋 Resumo dos testes realizados:" -ForegroundColor Cyan
Write-Host "✓ Listagem de tipos de serviço"
Write-Host "✓ Criação de tipo de serviço"
Write-Host "✓ Listagem de tipos de equipamento"
Write-Host "✓ Criação de tipo de equipamento"
Write-Host "✓ Edição de tipos"
Write-Host "✓ Tentativa de exclusão de tipo padrão"
Write-Host "✓ Exclusão de tipos personalizados"