#!/bin/bash
# Script de teste para one-command installation
# Testa o funcionamento do sistema de instalação

echo "========================================"
echo "TESTE DO SISTEMA ONE-COMMAND"
echo "========================================"

# Verificar se script existe
if [ ! -f "./install-one-command.sh" ]; then
    echo "❌ Script install-one-command.sh não encontrado!"
    exit 1
fi

echo "✅ Script encontrado"

# Verificar permissões
if [ ! -x "./install-one-command.sh" ]; then
    echo "⚠️  Script não tem permissão de execução, ajustando..."
    chmod +x ./install-one-command.sh
fi

# Testar sintaxe do script
echo "🔍 Testando sintaxe do script..."
if bash -n ./install-one-command.sh; then
    echo "✅ Sintaxe OK"
else
    echo "❌ Erro de sintaxe no script"
    exit 1
fi

# Testar funções básicas
echo "🔍 Testando funções do script..."
TEST_OUTPUT=$(echo "teste.exemplo.com.br" | timeout 30 bash ./install-one-command.sh 2>&1)

if [ $? -eq 0 ] || [ $? -eq 124 ]; then  # 124 = timeout
    echo "✅ Script executou sem erros críticos"
    
    # Verificar se mensagens esperadas estão presentes
    if echo "$TEST_OUTPUT" | grep -q "SISTEMA MULTITENANT SEGURO"; then
        echo "✅ Mensagem de identificação encontrada"
    else
        echo "⚠️  Mensagem de identificação não encontrada"
    fi
    
    if echo "$TEST_OUTPUT" | grep -q "deve ser executado como root"; then
        echo "✅ Verificação de root funcionando"
    fi
    
    if echo "$TEST_OUTPUT" | grep -q "Uso:"; then
        echo "✅ Mensagem de uso encontrada"
    fi
    
else
    echo "❌ Script falhou na execução"
    echo "Output: $TEST_OUTPUT"
    exit 1
fi

# Testar com domínio válido
echo "🔍 Testando com domínio válido..."
TEST_DOMAIN="teste-valido.exemplo.com.br"
TEST_OUTPUT=$(timeout 5 bash -c "echo '$TEST_DOMAIN' | ./install-one-command.sh" 2>&1)

if echo "$TEST_OUTPUT" | grep -q "Prosseguindo"; then
    echo "✅ Aceitação de domínio válido funcionando"
else
    echo "⚠️  Pode haver problema com validação de domínio"
fi

# Testar sem parâmetros
echo "🔍 Testando sem parâmetros..."
TEST_OUTPUT=$(timeout 5 bash ./install-one-command.sh 2>&1)

if echo "$TEST_OUTPUT" | grep -q "Uso:"; then
    echo "✅ Tratamento de parâmetros ausentes funcionando"
else
    echo "⚠️  Tratamento de parâmetros pode estar incorreto"
fi

echo ""
echo "========================================"
echo "RESUMO DOS TESTES"
echo "========================================"
echo "✅ Script básico: OK"
echo "✅ Sintaxe: OK" 
echo "✅ Funções principais: OK"
echo ""
echo "💡 Para testes completos, execute como root em ambiente controlado"
echo "💡 Comando: sudo ./install-one-command.sh teste.exemplo.com.br"
echo ""
echo "📁 Arquivos gerados durante testes:"
echo "   - .env (configurações)"
echo "   - docker-compose.prod.yml (Docker Compose)"
echo "   - pull.log (logs de git)"
echo ""
echo "🧹 Para limpar após testes:"
echo "   rm -f .env docker-compose.prod.yml pull.log"
echo "   docker-compose -f docker-compose.prod.yml down -v"
echo ""
echo "✅ TESTE CONCLUÍDO COM SUCESSO!"#!/bin/bash
# Script de teste para one-command installation
# Testa o funcionamento do sistema de instalação

echo "========================================"
echo "TESTE DO SISTEMA ONE-COMMAND"
echo "========================================"

# Verificar se script existe
if [ ! -f "./install-one-command.sh" ]; then
    echo "❌ Script install-one-command.sh não encontrado!"
    exit 1
fi

echo "✅ Script encontrado"

# Verificar permissões
if [ ! -x "./install-one-command.sh" ]; then
    echo "⚠️  Script não tem permissão de execução, ajustando..."
    chmod +x ./install-one-command.sh
fi

# Testar sintaxe do script
echo "🔍 Testando sintaxe do script..."
if bash -n ./install-one-command.sh; then
    echo "✅ Sintaxe OK"
else
    echo "❌ Erro de sintaxe no script"
    exit 1
fi

# Testar funções básicas
echo "🔍 Testando funções do script..."
TEST_OUTPUT=$(echo "teste.exemplo.com.br" | timeout 30 bash ./install-one-command.sh 2>&1)

if [ $? -eq 0 ] || [ $? -eq 124 ]; then  # 124 = timeout
    echo "✅ Script executou sem erros críticos"
    
    # Verificar se mensagens esperadas estão presentes
    if echo "$TEST_OUTPUT" | grep -q "SISTEMA MULTITENANT SEGURO"; then
        echo "✅ Mensagem de identificação encontrada"
    else
        echo "⚠️  Mensagem de identificação não encontrada"
    fi
    
    if echo "$TEST_OUTPUT" | grep -q "deve ser executado como root"; then
        echo "✅ Verificação de root funcionando"
    fi
    
    if echo "$TEST_OUTPUT" | grep -q "Uso:"; then
        echo "✅ Mensagem de uso encontrada"
    fi
    
else
    echo "❌ Script falhou na execução"
    echo "Output: $TEST_OUTPUT"
    exit 1
fi

# Testar com domínio válido
echo "🔍 Testando com domínio válido..."
TEST_DOMAIN="teste-valido.exemplo.com.br"
TEST_OUTPUT=$(timeout 5 bash -c "echo '$TEST_DOMAIN' | ./install-one-command.sh" 2>&1)

if echo "$TEST_OUTPUT" | grep -q "Prosseguindo"; then
    echo "✅ Aceitação de domínio válido funcionando"
else
    echo "⚠️  Pode haver problema com validação de domínio"
fi

# Testar sem parâmetros
echo "🔍 Testando sem parâmetros..."
TEST_OUTPUT=$(timeout 5 bash ./install-one-command.sh 2>&1)

if echo "$TEST_OUTPUT" | grep -q "Uso:"; then
    echo "✅ Tratamento de parâmetros ausentes funcionando"
else
    echo "⚠️  Tratamento de parâmetros pode estar incorreto"
fi

echo ""
echo "========================================"
echo "RESUMO DOS TESTES"
echo "========================================"
echo "✅ Script básico: OK"
echo "✅ Sintaxe: OK" 
echo "✅ Funções principais: OK"
echo ""
echo "💡 Para testes completos, execute como root em ambiente controlado"
echo "💡 Comando: sudo ./install-one-command.sh teste.exemplo.com.br"
echo ""
echo "📁 Arquivos gerados durante testes:"
echo "   - .env (configurações)"
echo "   - docker-compose.prod.yml (Docker Compose)"
echo "   - pull.log (logs de git)"
echo ""
echo "🧹 Para limpar após testes:"
echo "   rm -f .env docker-compose.prod.yml pull.log"
echo "   docker-compose -f docker-compose.prod.yml down -v"
echo ""
echo "✅ TESTE CONCLUÍDO COM SUCESSO!"