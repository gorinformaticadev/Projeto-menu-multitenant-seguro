Write-Host "Iniciando configuração do Docker..."

# Verificar se .env existe
if (-not (Test-Path ".env")) {
    Write-Host "Criando .env a partir de .env.example..."
    Copy-Item ".env.example" -Destination ".env"
}

# Parar containers antigos se existirem
Write-Host "Parando containers antigos..."
docker-compose down --remove-orphans

# Construir e iniciar
Write-Host "Construindo e iniciando containers (isso pode levar alguns minutos)..."
docker-compose up -d --build

Write-Host "Aguardando inicialização do banco de dados..."
Start-Sleep -Seconds 15

Write-Host "Verificando status das migrações..."
docker-compose logs migrator

Write-Host "---------------------------------------------------"
Write-Host "Instalação concluída!"
Write-Host "Acesse o Frontend em: http://localhost:5000"
Write-Host "Acesse o Backend em:  http://localhost:4000"
Write-Host "Para ver os logs, use: docker-compose logs -f"
Write-Host "---------------------------------------------------"
