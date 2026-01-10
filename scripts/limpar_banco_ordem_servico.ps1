# Script PowerShell para limpar o banco de dados do módulo ordem_servico
# Versão: 1.0.0
# Data: 2026-01-10

Write-Host "=== LIMPEZA DO BANCO DE DADOS - MÓDULO ORDEM DE SERVIÇO ===" -ForegroundColor Cyan
Write-Host ""

# Verificar se o arquivo SQL existe
$sqlFile = "limpar_banco_ordem_servico.sql"
if (-not (Test-Path $sqlFile)) {
    Write-Host "❌ Arquivo $sqlFile não encontrado!" -ForegroundColor Red
    exit 1
}

# Configurações do banco (ajuste conforme necessário)
$dbHost = "localhost"
$dbPort = "5432"
$dbName = "seu_banco_de_dados"  # AJUSTE AQUI
$dbUser = "seu_usuario"         # AJUSTE AQUI

Write-Host "⚠️  ATENÇÃO: Este script irá REMOVER TODOS os dados do módulo ordem_servico!" -ForegroundColor Yellow
Write-Host "Isso inclui:" -ForegroundColor Yellow
Write-Host "  - Todas as tabelas do módulo" -ForegroundColor Yellow
Write-Host "  - Todos os dados (clientes, ordens, produtos, etc.)" -ForegroundColor Yellow
Write-Host "  - Registros de migrations" -ForegroundColor Yellow
Write-Host ""

$confirmacao = Read-Host "Deseja continuar? Digite 'CONFIRMO' para prosseguir"

if ($confirmacao -ne "CONFIRMO") {
    Write-Host "❌ Operação cancelada pelo usuário." -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "🚀 Iniciando limpeza do banco de dados..." -ForegroundColor Green

try {
    # Executar o script SQL
    # OPÇÃO 1: Usando psql (se disponível)
    if (Get-Command psql -ErrorAction SilentlyContinue) {
        Write-Host "📊 Executando limpeza via psql..." -ForegroundColor Blue
        $env:PGPASSWORD = Read-Host "Digite a senha do banco de dados" -AsSecureString
        $password = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($env:PGPASSWORD))
        $env:PGPASSWORD = $password
        
        psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $sqlFile
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Limpeza executada com sucesso!" -ForegroundColor Green
        } else {
            Write-Host "❌ Erro ao executar limpeza via psql" -ForegroundColor Red
        }
    } else {
        Write-Host "⚠️  psql não encontrado. Execute manualmente o arquivo SQL:" -ForegroundColor Yellow
        Write-Host "   $sqlFile" -ForegroundColor White
        Write-Host ""
        Write-Host "Ou use seu cliente de banco de dados preferido (pgAdmin, DBeaver, etc.)" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "❌ Erro durante a execução: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== PRÓXIMOS PASSOS ===" -ForegroundColor Cyan
Write-Host "1. ✅ Banco limpo (se executado com sucesso)" -ForegroundColor Green
Write-Host "2. 🔄 Execute o migrate do sistema principal (se necessário)" -ForegroundColor Yellow
Write-Host "3. 🎯 Execute o botão de migrations/seeds do módulo ordem_servico" -ForegroundColor Yellow
Write-Host "4. ✨ A migration 001_master.sql será executada em um banco limpo" -ForegroundColor Green
Write-Host ""
Write-Host "=== FIM ===" -ForegroundColor Cyan