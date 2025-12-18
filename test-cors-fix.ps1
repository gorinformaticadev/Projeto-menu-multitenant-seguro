# Script de teste para validar correção CORS de imagens

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Teste de Correção CORS para Logos" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$logoUrl = "http://localhost:4000/uploads/logos/ebb518b6-aaec-4762-af7c-b316a0739b4d_download__38_.jpg"

Write-Host "🔍 Testando URL: $logoUrl" -ForegroundColor Yellow
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri $logoUrl -Method Head -UseBasicParsing
    
    Write-Host "✅ Status Code: $($response.StatusCode)" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "📋 Headers CORS:" -ForegroundColor Cyan
    
    $corsHeaders = @(
        'Access-Control-Allow-Origin',
        'Access-Control-Allow-Methods',
        'Access-Control-Allow-Headers',
        'Cross-Origin-Resource-Policy',
        'Cache-Control',
        'X-Content-Type-Options',
        'X-Frame-Options'
    )
    
    foreach ($header in $corsHeaders) {
        $value = $response.Headers[$header]
        if ($value) {
            Write-Host "  ✓ $header`: $value" -ForegroundColor Green
        } else {
            Write-Host "  ✗ $header`: (não presente)" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    Write-Host "=====================================" -ForegroundColor Cyan
    Write-Host "Validação de Correção" -ForegroundColor Cyan
    Write-Host "=====================================" -ForegroundColor Cyan
    
    $accessControlOrigin = $response.Headers['Access-Control-Allow-Origin']
    
    if ($accessControlOrigin -eq '*') {
        Write-Host "✅ CORS configurado corretamente para logos (Access-Control-Allow-Origin: *)" -ForegroundColor Green
        Write-Host "✅ Imagens de logos podem ser carregadas de qualquer origem" -ForegroundColor Green
    } else {
        Write-Host "❌ CORS ainda restritivo: Access-Control-Allow-Origin = $accessControlOrigin" -ForegroundColor Red
    }
    
    $cacheControl = $response.Headers['Cache-Control']
    if ($cacheControl -like '*max-age=86400*') {
        Write-Host "✅ Cache configurado para 24 horas" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Cache: $cacheControl" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "❌ Erro ao testar URL: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Possíveis causas:" -ForegroundColor Yellow
    Write-Host "  - Backend não está rodando" -ForegroundColor Yellow
    Write-Host "  - Arquivo não existe" -ForegroundColor Yellow
    Write-Host "  - Porta 4000 está bloqueada" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Próximos Passos" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "1. Abra o frontend em http://localhost:5000" -ForegroundColor White
Write-Host "2. Faça login no sistema" -ForegroundColor White
Write-Host "3. Verifique se as imagens carregam sem erros" -ForegroundColor White
Write-Host "4. Abra o Console do navegador (F12)" -ForegroundColor White
Write-Host "5. Verifique que nao ha erros CORS" -ForegroundColor White
Write-Host ""
