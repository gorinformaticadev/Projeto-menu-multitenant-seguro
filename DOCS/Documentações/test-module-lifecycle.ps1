# Script de Teste - Ciclo de Vida de Módulos
# Testa os novos endpoints implementados

$baseUrl = "http://localhost:4000"
$adminEmail = "admin@system.com"
$adminPassword = "admin123"

Write-Host "🧪 Testando Ciclo de Vida de Módulos" -ForegroundColor Cyan
Write-Host ""

# Função para fazer login e obter token
function Get-AuthToken {
    Write-Host "🔐 Fazendo login como SUPER_ADMIN..." -ForegroundColor Yellow
    
    $loginBody = @{
        email = $adminEmail
        password = $adminPassword
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
        Write-Host "✅ Login realizado com sucesso" -ForegroundColor Green
        return $response.accessToken
    } catch {
        Write-Host "❌ Erro no login: $_" -ForegroundColor Red
        exit 1
    }
}

# Função para listar módulos
function Get-Modules {
    param($token)
    
    Write-Host "`n📋 Listando módulos instalados..." -ForegroundColor Yellow
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/configuracoes/sistema/modulos" -Method Get -Headers @{
            "Authorization" = "Bearer $token"
        }
        
        Write-Host "✅ Módulos encontrados: $($response.Count)" -ForegroundColor Green
        
        foreach ($module in $response) {
            Write-Host ""
            Write-Host "  Slug: $($module.slug)" -ForegroundColor Cyan
            Write-Host "  Nome: $($module.name)" -ForegroundColor Cyan
            Write-Host "  Versão: $($module.version)" -ForegroundColor Cyan
            Write-Host "  Status: $($module.status)" -ForegroundColor $(
                switch ($module.status) {
                    "active" { "Green" }
                    "db_ready" { "Blue" }
                    "installed" { "Yellow" }
                    "disabled" { "DarkGray" }
                    default { "White" }
                }
            )
            Write-Host "  Backend: $($module.hasBackend)" -ForegroundColor Cyan
            Write-Host "  Frontend: $($module.hasFrontend)" -ForegroundColor Cyan
            Write-Host "  Tenants: $($module.stats.tenants)" -ForegroundColor Cyan
            Write-Host "  Migrations: $($module.stats.migrations)" -ForegroundColor Cyan
            Write-Host "  Menus: $($module.stats.menus)" -ForegroundColor Cyan
        }
        
        return $response
    } catch {
        Write-Host "❌ Erro ao listar módulos: $_" -ForegroundColor Red
        return $null
    }
}

# Função para obter status detalhado
function Get-ModuleStatus {
    param($token, $slug)
    
    Write-Host "`n🔍 Obtendo status detalhado do módulo '$slug'..." -ForegroundColor Yellow
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/configuracoes/sistema/modulos/$slug/status" -Method Get -Headers @{
            "Authorization" = "Bearer $token"
        }
        
        Write-Host "✅ Status obtido com sucesso" -ForegroundColor Green
        Write-Host ""
        Write-Host "  Módulo:" -ForegroundColor Cyan
        Write-Host "    Slug: $($response.module.slug)" -ForegroundColor White
        Write-Host "    Nome: $($response.module.name)" -ForegroundColor White
        Write-Host "    Status: $($response.module.status)" -ForegroundColor White
        
        Write-Host "`n  Migrations executadas: $($response.migrations.Count)" -ForegroundColor Cyan
        Write-Host "  Menus cadastrados: $($response.menus.Count)" -ForegroundColor Cyan
        Write-Host "  Tenants habilitados: $($response.tenants.Count)" -ForegroundColor Cyan
        
        return $response
    } catch {
        Write-Host "❌ Erro ao obter status: $_" -ForegroundColor Red
        return $null
    }
}

# Função para preparar banco de dados
function Update-ModuleDatabase {
    param($token, $slug)
    
    Write-Host "`n🗄️ Preparando banco de dados do módulo '$slug'..." -ForegroundColor Yellow
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/configuracoes/sistema/modulos/$slug/update-db" -Method Post -Headers @{
            "Authorization" = "Bearer $token"
        }
        
        Write-Host "✅ Banco de dados atualizado" -ForegroundColor Green
        Write-Host "  Migrations executadas: $($response.executed.migrations)" -ForegroundColor Cyan
        Write-Host "  Seeds executadas: $($response.executed.seeds)" -ForegroundColor Cyan
        
        return $response
    } catch {
        Write-Host "❌ Erro ao preparar banco: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# Função para ativar módulo
function Enable-Module {
    param($token, $slug)
    
    Write-Host "`n🟢 Ativando módulo '$slug'..." -ForegroundColor Yellow
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/configuracoes/sistema/modulos/$slug/activate" -Method Post -Headers @{
            "Authorization" = "Bearer $token"
        }
        
        Write-Host "✅ Módulo ativado com sucesso" -ForegroundColor Green
        return $response
    } catch {
        Write-Host "❌ Erro ao ativar módulo: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# Função para desativar módulo
function Disable-Module {
    param($token, $slug)
    
    Write-Host "`n⚪ Desativando módulo '$slug'..." -ForegroundColor Yellow
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/configuracoes/sistema/modulos/$slug/deactivate" -Method Post -Headers @{
            "Authorization" = "Bearer $token"
        }
        
        Write-Host "✅ Módulo desativado com sucesso" -ForegroundColor Green
        return $response
    } catch {
        Write-Host "❌ Erro ao desativar módulo: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# Função para desinstalar módulo
function Uninstall-Module {
    param($token, $slug, $dataRemovalOption = "keep")
    
    Write-Host "`n🗑️ Desinstalando módulo '$slug'..." -ForegroundColor Yellow
    Write-Host "  Opção de remoção: $dataRemovalOption" -ForegroundColor Cyan
    
    $body = @{
        dataRemovalOption = $dataRemovalOption
        confirmationName = $slug
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/configuracoes/sistema/modulos/$slug/uninstall" -Method Delete -Headers @{
            "Authorization" = "Bearer $token"
        } -Body $body -ContentType "application/json"
        
        Write-Host "✅ Módulo desinstalado com sucesso" -ForegroundColor Green
        Write-Host "  Registros CORE removidos: $($response.removed.coreRecords)" -ForegroundColor Cyan
        Write-Host "  Tabelas removidas: $($response.removed.tables.Count)" -ForegroundColor Cyan
        Write-Host "  Arquivos removidos: $($response.removed.files)" -ForegroundColor Cyan
        
        return $response
    } catch {
        Write-Host "❌ Erro ao desinstalar módulo: $($_.Exception.Message)" -ForegroundColor Red
        
        # Tentar extrair mensagem de erro do JSON
        try {
            $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
            Write-Host "  Detalhes: $($errorDetails.message)" -ForegroundColor Red
        } catch {
            # Ignorar se não conseguir parsear
        }
        
        return $null
    }
}

# TESTES PRINCIPAIS

try {
    # 1. Login
    $token = Get-AuthToken
    
    # 2. Listar módulos
    $modules = Get-Modules -token $token
    
    if ($modules -and $modules.Count -gt 0) {
        # Pegar o primeiro módulo para testes
        $testModule = $modules[0]
        $slug = $testModule.slug
        
        Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
        Write-Host "🧪 Testando operações com módulo: $slug" -ForegroundColor Cyan
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
        
        # 3. Obter status detalhado
        $status = Get-ModuleStatus -token $token -slug $slug
        
        # 4. Testar operações com base no status atual
        switch ($status.module.status) {
            "installed" {
                Write-Host "`n📌 Módulo está INSTALADO. Pode preparar banco." -ForegroundColor Yellow
                
                # Perguntar se quer preparar banco
                $prepareDb = Read-Host "`nDeseja preparar o banco de dados? (s/n)"
                if ($prepareDb -eq "s") {
                    Update-ModuleDatabase -token $token -slug $slug
                }
            }
            
            "db_ready" {
                Write-Host "`n📌 Módulo está PRONTO. Pode ativar." -ForegroundColor Blue
                
                # Perguntar se quer ativar
                $activate = Read-Host "`nDeseja ativar o módulo? (s/n)"
                if ($activate -eq "s") {
                    Enable-Module -token $token -slug $slug
                }
            }
            
            "active" {
                Write-Host "`n📌 Módulo está ATIVO. Pode desativar." -ForegroundColor Green
                
                # Perguntar se quer desativar
                $deactivate = Read-Host "`nDeseja desativar o módulo? (s/n)"
                if ($deactivate -eq "s") {
                    Disable-Module -token $token -slug $slug
                }
            }
            
            "disabled" {
                Write-Host "`n📌 Módulo está DESATIVADO. Pode reativar ou desinstalar." -ForegroundColor DarkGray
                
                # Perguntar ação
                Write-Host "`nOpções:"
                Write-Host "  1 - Reativar módulo"
                Write-Host "  2 - Desinstalar (manter dados)"
                Write-Host "  3 - Desinstalar (remover tudo)"
                Write-Host "  0 - Cancelar"
                
                $option = Read-Host "`nEscolha uma opção"
                
                switch ($option) {
                    "1" { Enable-Module -token $token -slug $slug }
                    "2" { Uninstall-Module -token $token -slug $slug -dataRemovalOption "keep" }
                    "3" { 
                        Write-Host "`n⚠️ ATENÇÃO: Esta ação removerá TODAS as tabelas e dados do módulo!" -ForegroundColor Red
                        $confirm = Read-Host "Digite 'CONFIRMAR' para continuar"
                        if ($confirm -eq "CONFIRMAR") {
                            Uninstall-Module -token $token -slug $slug -dataRemovalOption "full"
                        } else {
                            Write-Host "❌ Operação cancelada" -ForegroundColor Yellow
                        }
                    }
                    default { Write-Host "❌ Operação cancelada" -ForegroundColor Yellow }
                }
            }
        }
        
        # 5. Listar módulos novamente para ver mudanças
        Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
        Write-Host "📋 Estado final dos módulos:" -ForegroundColor Cyan
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
        Get-Modules -token $token | Out-Null
    } else {
        Write-Host "`n⚠️ Nenhum módulo encontrado para testar" -ForegroundColor Yellow
    }
    
    Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "✅ Testes concluídos!" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    
} catch {
    Write-Host "`n❌ Erro durante os testes: $_" -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor Red
}
