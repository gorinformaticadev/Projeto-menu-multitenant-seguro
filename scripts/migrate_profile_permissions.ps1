# PowerShell script to run profile permissions migration
param(
    [string]$DatabaseUrl = "postgresql://postgres:123456@localhost:5432/menu_tenant_db"
)

Write-Host "Executando migracao de permissoes de perfil..." -ForegroundColor Yellow
Write-Host "Arquivo: module-os/backend/migrations/020_create_profile_permissions.sql" -ForegroundColor Cyan

try {
    # Ler o conteudo do arquivo SQL
    $migrationFile = "module-os/backend/migrations/020_create_profile_permissions.sql"
    $sqlContent = Get-Content $migrationFile -Raw
    
    # Tentar encontrar psql em locais comuns
    $psqlPaths = @(
        "C:\Program Files\PostgreSQL\16\bin\psql.exe",
        "C:\Program Files\PostgreSQL\15\bin\psql.exe",
        "C:\Program Files\PostgreSQL\14\bin\psql.exe",
        "C:\Program Files\PostgreSQL\13\bin\psql.exe",
        "C:\Program Files (x86)\PostgreSQL\16\bin\psql.exe",
        "C:\Program Files (x86)\PostgreSQL\15\bin\psql.exe",
        "C:\Program Files (x86)\PostgreSQL\14\bin\psql.exe",
        "C:\Program Files (x86)\PostgreSQL\13\bin\psql.exe"
    )
    
    $psqlPath = $null
    foreach ($path in $psqlPaths) {
        if (Test-Path $path) {
            $psqlPath = $path
            break
        }
    }
    
    if ($psqlPath) {
        Write-Host "Encontrado psql em: $psqlPath" -ForegroundColor Green
        
        # Executar a migracao
        $sqlContent | & $psqlPath $DatabaseUrl
        
        Write-Host "Migracao executada com sucesso!" -ForegroundColor Green
    } else {
        Write-Host "psql nao encontrado. Instalacoes comuns do PostgreSQL verificadas." -ForegroundColor Red
        Write-Host "Voce pode executar manualmente:" -ForegroundColor Yellow
        Write-Host "   psql `"$DatabaseUrl`" -f `"$migrationFile`"" -ForegroundColor White
        
        # Mostrar o conteudo SQL para execucao manual
        Write-Host "`nConteudo SQL para execucao manual:" -ForegroundColor Cyan
        Write-Host $sqlContent -ForegroundColor White
    }
} catch {
    Write-Host "Erro na migracao: $($_.Exception.Message)" -ForegroundColor Red
}