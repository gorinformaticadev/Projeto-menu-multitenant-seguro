# Teste do endpoint de execução de migrations e seeds
# PowerShell script para testar o novo endpoint

$baseUrl = "http://localhost:3001"
$endpoint = "/configuracoes/sistema/modulos"

# Função para fazer requisições autenticadas
function Invoke-AuthenticatedRequest {
    param(
        [string]$Url,
        [string]$Method = "GET",
        [hashtable]$Headers = @{},
        [object]$Body = $null
    )
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            Headers = $Headers
            ContentType = "application/json"
        }
        
        if ($Body) {
            $params.Body = $Body | ConvertTo-Json
        }
        
        $response = Invoke-RestMethod @params
        return $response
    }
    catch {
        Write-Host "Erro na requisição: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "Resposta do servidor: $responseBody" -ForegroundColor Yellow
        }
        return $null
    }
}

Write-Host "=== TESTE DO ENDPOINT DE MIGRATIONS/SEEDS ===" -ForegroundColor Cyan
Write-Host ""

# 1. Listar módulos disponíveis
Write-Host "1. Listando módulos instalados..." -ForegroundColor Yellow
$modules = Invoke-AuthenticatedRequest -Url "$baseUrl$endpoint"

if ($modules) {
    Write-Host "Módulos encontrados:" -ForegroundColor Green
    foreach ($module in $modules) {
        Write-Host "  - $($module.slug) ($($module.name)) - Status: $($module.status)" -ForegroundColor White
    }
    
    # 2. Testar endpoint de migrations/seeds (se houver módulos)
    if ($modules.Count -gt 0) {
        $testModule = $modules[0]
        Write-Host ""
        Write-Host "2. Testando execução de migrations/seeds para: $($testModule.slug)" -ForegroundColor Yellow
        
        $migrationsUrl = "$baseUrl$endpoint/$($testModule.slug)/run-migrations-seeds"
        Write-Host "URL: $migrationsUrl" -ForegroundColor Gray
        
        # Fazer a requisição POST
        $result = Invoke-AuthenticatedRequest -Url $migrationsUrl -Method "POST"
        
        if ($result) {
            Write-Host "✅ Sucesso!" -ForegroundColor Green
            Write-Host "Resposta:" -ForegroundColor White
            $result | ConvertTo-Json -Depth 3 | Write-Host
        } else {
            Write-Host "❌ Falha na execução" -ForegroundColor Red
        }
    } else {
        Write-Host "Nenhum módulo encontrado para testar" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ Falha ao listar módulos" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== FIM DO TESTE ===" -ForegroundColor Cyan