# Script PowerShell para Migração de Criptografia CBC → GCM
# Uso: .\scripts\migrate-encryption-cbc-to-gcm.ps1

param(
    [Parameter(Mandatory=$false)]
    [switch]$SkipBackup = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$Force = $false
)

Write-Host "🔐 Script de Migração de Criptografia CBC → GCM" -ForegroundColor Green
Write-Host "=" * 50

# Verificar se estamos no diretório correto
if (-not (Test-Path "package.json")) {
    Write-Error "❌ Execute este script a partir da raiz do projeto!"
    exit 1
}

# Verificar dependências
Write-Host "🔍 Verificando dependências..." -ForegroundColor Yellow

$nodeVersion = node --version
$npmVersion = npm --version

Write-Host "Node.js: $nodeVersion"
Write-Host "NPM: $npmVersion"

# Verificar se o Prisma está instalado
if (-not (Get-Command "npx" -ErrorAction SilentlyContinue)) {
    Write-Error "❌ NPX não encontrado. Instale Node.js primeiro."
    exit 1
}

# Verificar variáveis de ambiente
Write-Host "`n🔍 Verificando configurações..." -ForegroundColor Yellow

$envFile = "apps\backend\.env"
if (Test-Path $envFile) {
    Write-Host "✅ Arquivo .env encontrado"
} else {
    Write-Warning "⚠️  Arquivo .env não encontrado. Certifique-se de configurar as variáveis de ambiente."
}

# Backup do banco (se não for pulado)
if (-not $SkipBackup) {
    Write-Host "`n💾 Criando backup do banco de dados..." -ForegroundColor Yellow
    
    $timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
    $backupFile = "backup_pre_migracao_$timestamp.sql"
    
    try {
        # Tenta criar backup usando pg_dump
        $pgDumpCmd = "pg_dump -h localhost -U postgres -d multitenant_db > $backupFile"
        Write-Host "Executando: $pgDumpCmd"
        
        # Você pode querer personalizar as credenciais aqui
        # $env:PGPASSWORD = "sua_senha_postgres"
        
        Invoke-Expression $pgDumpCmd
        
        if (Test-Path $backupFile) {
            Write-Host "✅ Backup criado: $backupFile" -ForegroundColor Green
        } else {
            Write-Warning "⚠️  Falha ao criar backup. Continuando sem backup..."
        }
    } catch {
        Write-Warning "⚠️  Não foi possível criar backup automático: $($_.Exception.Message)"
        Write-Host "Recomenda-se criar backup manualmente antes de continuar." -ForegroundColor Red
        
        if (-not $Force) {
            $continue = Read-Host "Deseja continuar mesmo assim? (sim/não)"
            if ($continue -ne "sim") {
                Write-Host "❌ Migração cancelada."
                exit 1
            }
        }
    }
} else {
    Write-Host "`n⏭️  Backup pulado conforme solicitado." -ForegroundColor Yellow
}

# Confirmação final
Write-Host "`n⚠️  ATENÇÃO!" -ForegroundColor Red
Write-Host "Esta operação irá:"
Write-Host "  • Converter dados criptografados do formato legado (CBC) para GCM"
Write-Host "  • Modificar dados no banco de dados"
Write-Host "  • Ser irreversível após conclusão"
Write-Host ""

if (-not $Force) {
    $confirm = Read-Host "Tem certeza que deseja continuar? (sim/não)"
    if ($confirm -ne "sim") {
        Write-Host "❌ Migração cancelada pelo usuário."
        exit 1
    }
}

# Executar a migração
Write-Host "`n🚀 Iniciando migração..." -ForegroundColor Green

try {
    # Navegar para o diretório backend
    Push-Location "apps\backend"
    
    # Executar o script de migração
    node "..\..\scripts\migrate-encryption-cbc-to-gcm.js"
    
    Pop-Location
    
    Write-Host "`n🎉 Migração concluída!" -ForegroundColor Green
    
} catch {
    Write-Error "❌ Erro durante a migração: $($_.Exception.Message)"
    exit 1
}

Write-Host "`n📝 Próximos passos:" -ForegroundColor Yellow
Write-Host "1. Verifique os logs acima para erros"
Write-Host "2. Teste a aplicação para garantir funcionamento"
Write-Host "3. Considere remover o suporte ao modo legado após validação completa"
Write-Host "4. Atualize a documentação de segurança"

Write-Host "`n🔐 Migração de segurança concluída com sucesso!" -ForegroundColor Green