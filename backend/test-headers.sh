#!/bin/bash

# 🛡️ Script de Teste - Headers de Segurança
# FASE 1: Helmet

echo "=========================================="
echo "🛡️  TESTE DE HEADERS DE SEGURANÇA"
echo "=========================================="
echo ""

# Verificar se o backend está rodando
echo "📡 Verificando se o backend está rodando..."
if ! curl -s http://localhost:4000 > /dev/null 2>&1; then
    echo "❌ Backend não está rodando!"
    echo "   Execute: cd backend && npm run start:dev"
    exit 1
fi
echo "✅ Backend está rodando"
echo ""

# Testar headers
echo "=========================================="
echo "📋 HEADERS DE SEGURANÇA ENCONTRADOS:"
echo "=========================================="
echo ""

RESPONSE=$(curl -s -I http://localhost:4000/auth/login)

# Content-Security-Policy
if echo "$RESPONSE" | grep -i "Content-Security-Policy" > /dev/null; then
    echo "✅ Content-Security-Policy (CSP)"
    echo "$RESPONSE" | grep -i "Content-Security-Policy"
else
    echo "❌ Content-Security-Policy NÃO encontrado"
fi
echo ""

# Strict-Transport-Security
if echo "$RESPONSE" | grep -i "Strict-Transport-Security" > /dev/null; then
    echo "✅ Strict-Transport-Security (HSTS)"
    echo "$RESPONSE" | grep -i "Strict-Transport-Security"
else
    echo "❌ Strict-Transport-Security NÃO encontrado"
fi
echo ""

# X-Content-Type-Options
if echo "$RESPONSE" | grep -i "X-Content-Type-Options" > /dev/null; then
    echo "✅ X-Content-Type-Options"
    echo "$RESPONSE" | grep -i "X-Content-Type-Options"
else
    echo "❌ X-Content-Type-Options NÃO encontrado"
fi
echo ""

# X-Frame-Options
if echo "$RESPONSE" | grep -i "X-Frame-Options" > /dev/null; then
    echo "✅ X-Frame-Options"
    echo "$RESPONSE" | grep -i "X-Frame-Options"
else
    echo "❌ X-Frame-Options NÃO encontrado"
fi
echo ""

# X-DNS-Prefetch-Control
if echo "$RESPONSE" | grep -i "X-DNS-Prefetch-Control" > /dev/null; then
    echo "✅ X-DNS-Prefetch-Control"
    echo "$RESPONSE" | grep -i "X-DNS-Prefetch-Control"
else
    echo "❌ X-DNS-Prefetch-Control NÃO encontrado"
fi
echo ""

# Referrer-Policy
if echo "$RESPONSE" | grep -i "Referrer-Policy" > /dev/null; then
    echo "✅ Referrer-Policy"
    echo "$RESPONSE" | grep -i "Referrer-Policy"
else
    echo "❌ Referrer-Policy NÃO encontrado"
fi
echo ""

# X-Powered-By (deve estar AUSENTE)
if echo "$RESPONSE" | grep -i "X-Powered-By" > /dev/null; then
    echo "❌ X-Powered-By encontrado (deveria estar oculto!)"
    echo "$RESPONSE" | grep -i "X-Powered-By"
else
    echo "✅ X-Powered-By oculto (tecnologia não exposta)"
fi
echo ""

echo "=========================================="
echo "📊 RESUMO"
echo "=========================================="
echo ""

# Contar headers de segurança
SECURITY_HEADERS=0

echo "$RESPONSE" | grep -i "Content-Security-Policy" > /dev/null && ((SECURITY_HEADERS++))
echo "$RESPONSE" | grep -i "Strict-Transport-Security" > /dev/null && ((SECURITY_HEADERS++))
echo "$RESPONSE" | grep -i "X-Content-Type-Options" > /dev/null && ((SECURITY_HEADERS++))
echo "$RESPONSE" | grep -i "X-Frame-Options" > /dev/null && ((SECURITY_HEADERS++))
echo "$RESPONSE" | grep -i "X-DNS-Prefetch-Control" > /dev/null && ((SECURITY_HEADERS++))
echo "$RESPONSE" | grep -i "Referrer-Policy" > /dev/null && ((SECURITY_HEADERS++))

echo "Headers de segurança encontrados: $SECURITY_HEADERS/6"
echo ""

if [ $SECURITY_HEADERS -eq 6 ]; then
    echo "🎉 SUCESSO! Todos os headers de segurança estão configurados!"
    echo "✅ FASE 1 CONCLUÍDA"
elif [ $SECURITY_HEADERS -ge 4 ]; then
    echo "⚠️  PARCIAL: Alguns headers estão faltando"
    echo "   Verifique a configuração do Helmet"
else
    echo "❌ FALHA: Poucos headers de segurança encontrados"
    echo "   Verifique se o Helmet está configurado corretamente"
fi

echo ""
echo "=========================================="
echo "🧪 PRÓXIMOS TESTES MANUAIS:"
echo "=========================================="
echo ""
echo "1. Abra o navegador em: http://localhost:5000"
echo "2. Abra DevTools (F12) → Network"
echo "3. Faça login"
echo "4. Clique na requisição de login"
echo "5. Veja os Response Headers"
echo ""
echo "Não deve haver erros de CSP no console!"
echo ""
