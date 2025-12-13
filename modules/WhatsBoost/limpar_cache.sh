#!/bin/bash
# Script para limpar TODOS os caches e forçar reload

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  WhatsBoost - Limpeza Completa de Cache                 ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

BASE_DIR="/home/ufhcardoso-rise/htdocs/rise.nandocardoso.com.br"

# 1. Limpar cache do CodeIgniter/Rise CRM
echo "1️⃣  Limpando cache do servidor..."
if [ -d "$BASE_DIR/writable/cache" ]; then
    rm -rf $BASE_DIR/writable/cache/*
    echo "   ✅ Cache do servidor limpo"
else
    echo "   ⚠️  Diretório de cache não encontrado"
fi

# 2. Tocar no arquivo bundle para mudar timestamp
echo ""
echo "2️⃣  Atualizando timestamp do bundle JS..."
BUNDLE_FILE="$BASE_DIR/plugins/WhatsBoost/assets/js/whatsboost.bundle.js"
if [ -f "$BUNDLE_FILE" ]; then
    touch "$BUNDLE_FILE"
    NEW_TIME=$(stat -c %Y "$BUNDLE_FILE" 2>/dev/null || stat -f %m "$BUNDLE_FILE" 2>/dev/null)
    echo "   ✅ Novo timestamp: $NEW_TIME"
else
    echo "   ❌ Bundle JS não encontrado"
fi

# 2.1. Tocar nas views com fix de Feather Icons
echo ""
echo "2.1️⃣  Atualizando views com fix Feather Icons..."
VIEWS_WITH_FIX=(
    "$BASE_DIR/plugins/WhatsBoost/Views/connect_account.php"
    "$BASE_DIR/plugins/WhatsBoost/Views/whatsboost_settings.php"
    "$BASE_DIR/plugins/WhatsBoost/Views/interaction.php"
    "$BASE_DIR/plugins/WhatsBoost/Views/bots/message_bot.php"
    "$BASE_DIR/plugins/WhatsBoost/Views/bots/template_bot.php"
    "$BASE_DIR/plugins/WhatsBoost/Views/campaigns/campaign.php"
    "$BASE_DIR/plugins/WhatsBoost/Views/campaigns/view.php"
    "$BASE_DIR/plugins/WhatsBoost/Views/flow/manage_flow.php"
)

for VIEW_FILE in "${VIEWS_WITH_FIX[@]}"; do
    if [ -f "$VIEW_FILE" ]; then
        touch "$VIEW_FILE"
        echo "   ✅ $(basename "$VIEW_FILE")"
    fi
done

# 3. Verificar se validação foi removida
echo ""
echo "3️⃣  Verificando remoção de validação..."
if grep -q "License validation bypassed" "$BUNDLE_FILE"; then
    echo "   ✅ Validação removida (mensagem bypass encontrada)"
else
    echo "   ❌ ATENÇÃO: Validação pode não ter sido removida!"
fi

# 4. Verificar se não há fetch .lic ativo
if grep -q "fetch.*\.lic" "$BUNDLE_FILE" | grep -v "//"; then
    echo "   ⚠️  ATENÇÃO: Ainda há código fetch .lic ativo"
else
    echo "   ✅ Nenhum fetch .lic ativo"
fi

# 5. Limpar logs antigos (opcional)
echo ""
echo "4️⃣  Limpando logs antigos..."
if [ -d "$BASE_DIR/writable/logs" ]; then
    find "$BASE_DIR/writable/logs" -name "log-*.log" -mtime +7 -delete 2>/dev/null
    echo "   ✅ Logs antigos removidos (>7 dias)"
fi

# 6. Instruções para o usuário
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  PRÓXIMOS PASSOS - IMPORTANTE!                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "No seu NAVEGADOR, você DEVE fazer:"
echo ""
echo "  1. Pressionar Ctrl+Shift+Del (Chrome/Firefox)"
echo "  2. Marcar 'Imagens e arquivos em cache'"
echo "  3. Selecionar 'Último 1 hora' ou 'Tudo'"
echo "  4. Clicar em 'Limpar dados'"
echo ""
echo "OU simplesmente:"
echo ""
echo "  1. Abrir modo anônimo (Ctrl+Shift+N)"
echo "  2. Acessar: http://rise.nandocardoso.com.br/index.php/whatsboost/connect_account"
echo "  3. Pressionar F12 → Console"
echo "  4. Verificar mensagem: 'WhatsBoost: License validation bypassed'"
echo ""
echo "══════════════════════════════════════════════════════════"
echo "✅ Limpeza do servidor concluída!"
echo "⚠️  AGORA limpe o cache do NAVEGADOR conforme acima"
echo "══════════════════════════════════════════════════════════"
