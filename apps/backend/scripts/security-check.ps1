# Script de Verificação de Segurança Automatizada
# Executa múltiplas verificações de segurança no projeto

Write-Host "🔒 Iniciando Verificação de Segurança..." -ForegroundColor Cyan
Write-Host ""

$ErrorCount = 0
$WarningCount = 0

# 1. NPM Audit
Write-Host "📦 1/5 - Executando npm audit..." -ForegroundColor Yellow
try {
    $auditResult = npm audit --json 2>&1 | ConvertFrom-Json
    
    $critical = $auditResult.metadata.vulnerabilities.critical
    $high = $auditResult.metadata.vulnerabilities.high
    $moderate = $auditResult.metadata.vulnerabilities.moderate
    $low = $auditResult.metadata.vulnerabilities.low
    
    Write-Host "   Vulnerabilidades encontradas:" -ForegroundColor White
    Write-Host "   - Críticas: $critical" -ForegroundColor $(if ($critical -gt 0) { "Red" } else { "Green" })
    Write-Host "   - Altas: $high" -ForegroundColor $(if ($high -gt 0) { "Red" } else { "Green" })
    Write-Host "   - Moderadas: $moderate" -ForegroundColor $(if ($moderate -gt 0) { "Yellow" } else { "Green" })
    Write-Host "   - Baixas: $low" -ForegroundColor $(if ($low -gt 0) { "Yellow" } else { "Green" })
    
    if ($critical -gt 0 -or $high -gt 0) {
        $ErrorCount++
        Write-Host "   ❌ FALHA: Vulnerabilidades críticas ou altas encontradas!" -ForegroundColor Red
    } elseif ($moderate -gt 0) {
        $WarningCount++
        Write-Host "   ⚠️  AVISO: Vulnerabilidades moderadas encontradas" -ForegroundColor Yellow
    } else {
        Write-Host "   ✅ SUCESSO: Nenhuma vulnerabilidade significativa" -ForegroundColor Green
    }
} catch {
    Write-Host "   ⚠️  Erro ao executar npm audit" -ForegroundColor Yellow
}
Write-Host ""

# 2. ESLint Security Check
Write-Host "🔍 2/5 - Executando ESLint com regras de segurança..." -ForegroundColor Yellow
try {
    $lintOutput = npm run lint 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ SUCESSO: Nenhum problema de segurança detectado" -ForegroundColor Green
    } else {
        $ErrorCount++
        Write-Host "   ❌ FALHA: Problemas detectados pelo ESLint" -ForegroundColor Red
        Write-Host "   Execute 'npm run lint:fix' para corrigir automaticamente" -ForegroundColor Yellow
    }
} catch {
    $WarningCount++
    Write-Host "   ⚠️  ESLint não configurado ou erro na execução" -ForegroundColor Yellow
}
Write-Host ""

# 3. Verificar Variáveis de Ambiente Sensíveis
Write-Host "🔑 3/5 - Verificando configurações sensíveis..." -ForegroundColor Yellow
$sensitiveVars = @("JWT_SECRET", "DATABASE_URL", "SMTP_PASS")
$missingVars = @()

foreach ($var in $sensitiveVars) {
    $value = [System.Environment]::GetEnvironmentVariable($var)
    if ([string]::IsNullOrEmpty($value)) {
        # Verificar no arquivo .env
        if (Test-Path ".env") {
            $envContent = Get-Content ".env" -Raw
            if ($envContent -notmatch "$var=") {
                $missingVars += $var
            }
        } else {
            $missingVars += $var
        }
    }
}

if ($missingVars.Count -gt 0) {
    $WarningCount++
    Write-Host "   ⚠️  Variáveis sensíveis não configuradas: $($missingVars -join ', ')" -ForegroundColor Yellow
} else {
    Write-Host "   ✅ Todas as variáveis sensíveis estão configuradas" -ForegroundColor Green
}
Write-Host ""

# 4. Verificar Arquivos Sensíveis não Commitados
Write-Host "📁 4/5 - Verificando arquivos sensíveis..." -ForegroundColor Yellow
$sensitiveFiles = @(".env", ".env.local", ".env.production", "*.key", "*.pem")
$exposedFiles = @()

foreach ($pattern in $sensitiveFiles) {
    $files = git ls-files $pattern 2>$null
    if ($files) {
        $exposedFiles += $files
    }
}

if ($exposedFiles.Count -gt 0) {
    $ErrorCount++
    Write-Host "   ❌ FALHA: Arquivos sensíveis commitados:" -ForegroundColor Red
    foreach ($file in $exposedFiles) {
        Write-Host "      - $file" -ForegroundColor Red
    }
} else {
    Write-Host "   ✅ Nenhum arquivo sensível commitado" -ForegroundColor Green
}
Write-Host ""

# 5. Verificar Configurações de Segurança no Código
Write-Host "🛡️  5/5 - Verificando configurações de segurança..." -ForegroundColor Yellow
$securityChecks = @{
    "CORS configurado" = (Select-String -Path "src/main.ts" -Pattern "enableCors" -Quiet)
    "Helmet ativado" = (Select-String -Path "src/main.ts" -Pattern "helmet\(" -Quiet)
    "Rate limiting ativado" = (Select-String -Path "src/app.module.ts" -Pattern "ThrottlerModule" -Quiet)
    "Validação global ativada" = (Select-String -Path "src/main.ts" -Pattern "ValidationPipe" -Quiet)
}

$failedChecks = @()
foreach ($check in $securityChecks.GetEnumerator()) {
    if (-not $check.Value) {
        $failedChecks += $check.Key
    }
}

if ($failedChecks.Count -gt 0) {
    $ErrorCount++
    Write-Host "   ❌ FALHA: Configurações ausentes:" -ForegroundColor Red
    foreach ($check in $failedChecks) {
        Write-Host "      - $check" -ForegroundColor Red
    }
} else {
    Write-Host "   ✅ Todas as configurações essenciais estão ativas" -ForegroundColor Green
}
Write-Host ""

# Resumo Final
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "📊 RESUMO DA VERIFICAÇÃO DE SEGURANÇA" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Erros Críticos: $ErrorCount" -ForegroundColor $(if ($ErrorCount -gt 0) { "Red" } else { "Green" })
Write-Host "Avisos: $WarningCount" -ForegroundColor $(if ($WarningCount -gt 0) { "Yellow" } else { "Green" })
Write-Host ""

if ($ErrorCount -eq 0 -and $WarningCount -eq 0) {
    Write-Host "✅ APROVADO: Sistema passou em todas as verificações!" -ForegroundColor Green
    exit 0
} elseif ($ErrorCount -eq 0) {
    Write-Host "⚠️  APROVADO COM AVISOS: Revise os avisos acima" -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "❌ REPROVADO: Corrija os erros críticos antes de fazer deploy!" -ForegroundColor Red
    exit 1
}
