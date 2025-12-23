# 🛡️ Script de Teste - Headers de Segurança
# FASE 1: Helmet

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "🛡️  TESTE DE HEADERS DE SEGURANÇA" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se o backend está rodando
Write-Host "📡 Verificando se o backend está rodando..." -ForegroundColor Yellow
try {
    $null = Invoke-WebRequest -Uri "http://localhost:4000" -Method Head -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✅ Backend está rodando" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend não está rodando!" -ForegroundColor Red
    Write-Host "   Execute: cd backend && npm run start:dev" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Testar headers
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "📋 HEADERS DE SEGURANÇA ENCONTRADOS:" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri "http://localhost:4000/auth/login" -Method Get -ErrorAction SilentlyContinue
} catch {
    $response = $_.Exception.Response
}

$headers = $response.Headers
$securityHeadersCount = 0

# Content-Security-Policy
if ($headers.ContainsKey("Content-Security-Policy")) {
    Write-Host "✅ Content-Security-Policy (CSP)" -ForegroundColor Green
    Write-Host "   $($headers['Content-Security-Policy'])" -ForegroundColor Gray
    $securityHeadersCount++
} else {
    Write-Host "❌ Content-Security-Policy NÃO encontrado" -ForegroundColor Red
}
Write-Host ""

# Strict-Transport-Security
if ($headers.ContainsKey("Strict-Transport-Security")) {
    Write-Host "✅ Strict-Transport-Security (HSTS)" -ForegroundColor Green
    Write-Host "   $($headers['Strict-Transport-Security'])" -ForegroundColor Gray
    $securityHeadersCount++
} else {
    Write-Host "❌ Strict-Transport-Security NÃO encontrado" -ForegroundColor Red
}
Write-Host ""

# X-Content-Type-Options
if ($headers.ContainsKey("X-Content-Type-Options")) {
    Write-Host "✅ X-Content-Type-Options" -ForegroundColor Green
    Write-Host "   $($headers['X-Content-Type-Options'])" -ForegroundColor Gray
    $securityHeadersCount++
} else {
    Write-Host "❌ X-Content-Type-Options NÃO encontrado" -ForegroundColor Red
}
Write-Host ""

# X-Frame-Options
if ($headers.ContainsKey("X-Frame-Options")) {
    Write-Host "✅ X-Frame-Options" -ForegroundColor Green
    Write-Host "   $($headers['X-Frame-Options'])" -ForegroundColor Gray
    $securityHeadersCount++
} else {
    Write-Host "❌ X-Frame-Options NÃO encontrado" -ForegroundColor Red
}
Write-Host ""

# X-DNS-Prefetch-Control
if ($headers.ContainsKey("X-DNS-Prefetch-Control")) {
    Write-Host "✅ X-DNS-Prefetch-Control" -ForegroundColor Green
    Write-Host "   $($headers['X-DNS-Prefetch-Control'])" -ForegroundColor Gray
    $securityHeadersCount++
} else {
    Write-Host "❌ X-DNS-Prefetch-Control NÃO encontrado" -ForegroundColor Red
}
Write-Host ""

# Referrer-Policy
if ($headers.ContainsKey("Referrer-Policy")) {
    Write-Host "✅ Referrer-Policy" -ForegroundColor Green
    Write-Host "   $($headers['Referrer-Policy'])" -ForegroundColor Gray
    $securityHeadersCount++
} else {
    Write-Host "❌ Referrer-Policy NÃO encontrado" -ForegroundColor Red
}
Write-Host ""

# X-Powered-By (deve estar AUSENTE)
if ($headers.ContainsKey("X-Powered-By")) {
    Write-Host "❌ X-Powered-By encontrado (deveria estar oculto!)" -ForegroundColor Red
    Write-Host "   $($headers['X-Powered-By'])" -ForegroundColor Gray
} else {
    Write-Host "✅ X-Powered-By oculto (tecnologia não exposta)" -ForegroundColor Green
}
Write-Host ""

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "📊 RESUMO" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Headers de segurança encontrados: $securityHeadersCount/6" -ForegroundColor Yellow
Write-Host ""

if ($securityHeadersCount -eq 6) {
    Write-Host "🎉 SUCESSO! Todos os headers de segurança estão configurados!" -ForegroundColor Green
    Write-Host "✅ FASE 1 CONCLUÍDA" -ForegroundColor Green
} elseif ($securityHeadersCount -ge 4) {
    Write-Host "⚠️  PARCIAL: Alguns headers estão faltando" -ForegroundColor Yellow
    Write-Host "   Verifique a configuração do Helmet" -ForegroundColor Yellow
} else {
    Write-Host "❌ FALHA: Poucos headers de segurança encontrados" -ForegroundColor Red
    Write-Host "   Verifique se o Helmet está configurado corretamente" -ForegroundColor Red
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "🧪 PRÓXIMOS TESTES MANUAIS:" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Abra o navegador em: http://localhost:5000" -ForegroundColor White
Write-Host "2. Abra DevTools (F12) → Network" -ForegroundColor White
Write-Host "3. Faça login" -ForegroundColor White
Write-Host "4. Clique na requisição de login" -ForegroundColor White
Write-Host "5. Veja os Response Headers" -ForegroundColor White
Write-Host ""
Write-Host "Não deve haver erros de CSP no console!" -ForegroundColor Yellow
Write-Host ""
