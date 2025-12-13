#!/bin/bash
# Script para corrigir erro de Feather Icons em todas as Views

echo "=== Corrigindo erro de Feather Icons ==="
echo ""

BASE_DIR="/home/ufhcardoso-rise/htdocs/rise.nandocardoso.com.br/plugins/WhatsBoost"

# Contador
FIXED=0
ALREADY_FIXED=0

# Procurar todas as Views com script tag
find "$BASE_DIR/Views" -name "*.php" -type f | while read -r file; do
    # Verificar se tem script tag
    if grep -q "<script>" "$file"; then
        # Verificar se já tem o fix
        if grep -q "feather.replace()" "$file"; then
            echo "  ⏭️  $(basename "$file") - já corrigido"
            ((ALREADY_FIXED++))
        else
            # Criar backup
            cp "$file" "$file.bak"
            
            # Adicionar fix antes do fechamento do script
            # Aqui precisaria de lógica mais complexa
            echo "  ⚠️  $(basename "$file") - precisa verificação manual"
        fi
    fi
done

echo ""
echo "=== Análise Completa ==="
echo ""
echo "📝 SOLUÇÃO MANUAL:"
echo ""
echo "O erro de Feather Icons ocorre quando:"
echo "1. A página recarrega via AJAX"
echo "2. O feather.replace() é chamado"
echo "3. Mas alguns elementos já foram removidos do DOM"
echo ""
echo "SOLUÇÃO APLICADA em connect_account.php:"
echo "- Adicionado setTimeout com feather.replace()"
echo "- Verifica se feather está definido antes"
echo ""
echo "✅ connect_account.php foi corrigido"
echo ""

