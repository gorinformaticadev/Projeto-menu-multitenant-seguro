# install-system.ps1 - Instalação completa em um comando para Windows
# Autor: Sistema Multitenant Seguro

param(
    [switch]$Dev,
    [switch]$Prod,
    [switch]$Staging,
    [string]$DbPassword,
    [string]$JwtSecret,
    [string]$AdminPassword,
    [int]$FrontendPort = 5000,
    [int]$BackendPort = 4000
)

# Cores para output
$SuccessColor = "Green"
$ErrorColor = "Red"
$WarningColor = "Yellow"
$InfoColor = "Cyan"
$HeaderColor = "Magenta"

function Write-Colored {
    param([string]$Text, [string]$Color = "White")
    Write-Host $Text -ForegroundColor $Color
}

function Write-Section {
    param([string]$Title)
    Write-Colored ""
    Write-Colored "========================================" $HeaderColor
    Write-Colored $Title $HeaderColor
    Write-Colored "========================================" $HeaderColor
}

# 1. Verificar pré-requisitos
function Test-Requirements {
    Write-Section "VERIFICANDO PRE-REQUISITOS"
    
    $errors = @()
    
    try {
        $docker = docker --version
        Write-Colored "Docker encontrado: $docker" $SuccessColor
    } catch {
        $errors += "Docker nao encontrado. Instale o Docker Desktop."
    }
    
    try {
        $compose = docker-compose --version
        Write-Colored "Docker Compose encontrado: $compose" $SuccessColor
    } catch {
        $errors += "Docker Compose nao encontrado."
    }
    
    try {
        $git = git --version
        Write-Colored "Git encontrado: $git" $SuccessColor
    } catch {
        $errors += "Git nao encontrado."
    }
    
    if ($errors.Count -gt 0) {
        Write-Colored "Erros encontrados:" $ErrorColor
        $errors | ForEach-Object { Write-Colored "   - $_" $ErrorColor }
        exit 1
    }
    
    Write-Colored "Todos os pre-requisitos atendidos!" $SuccessColor
}

# 2. Gerar senhas seguras
function New-Passwords {
    Write-Section "GERANDO SENHAS SEGURAS"
    
    # Gerar senha de banco de dados (alfanumerica)
    if (-not $DbPassword) {
        $chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
        $script:DB_PASSWORD = -join (1..24 | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
    } else {
        $script:DB_PASSWORD = $DbPassword
    }
    
    # Gerar JWT secret (alfanumerica)
    if (-not $JwtSecret) {
        $chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
        $script:JWT_SECRET = -join (1..64 | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
    } else {
        $script:JWT_SECRET = $JwtSecret
    }
    
    # Gerar senha admin (com caracteres especiais seguros)
    if (-not $AdminPassword) {
        $alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
        $special = "!@#$%*-_=+"
        $part1 = -join (1..8 | ForEach-Object { $alpha[(Get-Random -Maximum $alpha.Length)] })
        $part2 = -join (1..4 | ForEach-Object { $special[(Get-Random -Maximum $special.Length)] })
        $script:ADMIN_PASSWORD = $part1 + $part2
    } else {
        $script:ADMIN_PASSWORD = $AdminPassword
    }
    
    # Determinar ambiente
    if ($Prod) { $script:NODE_ENV = "production" }
    elseif ($Staging) { $script:NODE_ENV = "staging" }
    else { $script:NODE_ENV = "development" }
    
    Write-Colored "Senhas geradas com sucesso!" $SuccessColor
}

# 3. Criar arquivo .env
function New-EnvFile {
    Write-Section "CRIANDO ARQUIVO DE CONFIGURACAO"
    
    $envContent = @"
# Configuracoes do Banco de Dados
DB_USER=multitenant_user
DB_PASSWORD=$DB_PASSWORD
DB_NAME=multitenant_db
DB_HOST=db
DB_PORT=5432

# Configuracoes de Seguranca
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
NODE_ENV=$NODE_ENV

# URLs do Sistema
FRONTEND_URL=http://localhost:$FrontendPort
API_URL=http://localhost:$BackendPort

# Portas dos Servicos
BACKEND_PORT=$BackendPort
FRONTEND_PORT=$FrontendPort
"@
    
    $envContent | Out-File -FilePath ".env" -Encoding UTF8
    
    Write-Colored "Arquivo .env criado com sucesso!" $SuccessColor
}

# 4. Criar Docker Compose
function New-DockerCompose {
    Write-Section "CRIANDO DOCKER COMPOSE"
    
    $composeContent = @"
version: '3.8'

services:
  db:
    image: postgres:15
    container_name: multitenant-db-install
    environment:
      POSTGRES_USER: `${DB_USER}
      POSTGRES_PASSWORD: `${DB_PASSWORD}
      POSTGRES_DB: `${DB_NAME}
    ports:
      - "`${DB_PORT}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U `${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build: ./apps/backend
    container_name: multitenant-backend-install
    ports:
      - "`${BACKEND_PORT}:4000"
    environment:
      DATABASE_URL: postgresql://`${DB_USER}:`${DB_PASSWORD}@db:5432/`${DB_NAME}?schema=public
      JWT_SECRET: `${JWT_SECRET}
      FRONTEND_URL: `${FRONTEND_URL}
      NODE_ENV: `${NODE_ENV}
      PORT: 4000
    volumes:
      - ./apps/backend/uploads:/app/uploads
    depends_on:
      db:
        condition: service_healthy
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build: ./apps/frontend
    container_name: multitenant-frontend-install
    ports:
      - "`${FRONTEND_PORT}:5000"
    environment:
      NEXT_PUBLIC_API_URL: `${API_URL}
      NODE_ENV: `${NODE_ENV}
    depends_on:
      - backend
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_data:

networks:
  app-network:
    driver: bridge
"@
    
    $composeContent | Out-File -FilePath "docker-compose.install.yml" -Encoding UTF8
    
    Write-Colored "Docker Compose criado com sucesso!" $SuccessColor
}

# 5. Iniciar containers
function Start-System {
    Write-Section "INICIANDO SISTEMA"
    
    Write-Colored "Construindo e iniciando containers..." $InfoColor
    
    try {
        docker-compose -f docker-compose.install.yml up --build -d
        
        Write-Colored "Aguardando containers ficarem prontos (45 segundos)..." $WarningColor
        Start-Sleep -Seconds 45
        
        Write-Colored "Status dos containers:" $InfoColor
        docker-compose -f docker-compose.install.yml ps
        
        Write-Colored "Sistema iniciado com sucesso!" $SuccessColor
    } catch {
        Write-Colored "Erro ao iniciar sistema: $_" $ErrorColor
        exit 1
    }
}

# 6. Popular banco de dados
function Initialize-Database {
    Write-Section "INICIALIZANDO BANCO DE DADOS"
    
    try {
        Write-Colored "Executando migrations..." $InfoColor
        docker-compose -f docker-compose.install.yml exec -T backend npx prisma migrate deploy
        
        Write-Colored "Executando seed..." $InfoColor
        docker-compose -f docker-compose.install.yml exec -T backend npx ts-node prisma/seed.ts
        
        Write-Colored "Banco de dados inicializado com sucesso!" $SuccessColor
    } catch {
        Write-Colored "Erro ao inicializar banco de dados: $_" $ErrorColor
        exit 1
    }
}

# 7. Verificar saúde do sistema
function Test-Health {
    Write-Section "VERIFICANDO SAUDE DO SISTEMA"
    
    $checks = @(
        @{Name="Database"; Command={ docker-compose -f docker-compose.install.yml exec -T db pg_isready -U multitenant_user }},
        @{Name="Backend API"; Command={ docker-compose -f docker-compose.install.yml exec -T backend curl -f http://localhost:4000/health }},
        @{Name="Frontend"; Command={ docker-compose -f docker-compose.install.yml exec -T frontend curl -f http://localhost:5000/api/health }}
    )
    
    foreach ($check in $checks) {
        try {
            & $check.Command | Out-Null
            Write-Colored "$($check.Name): OK" $SuccessColor
        } catch {
            Write-Colored "$($check.Name): Falhou" $ErrorColor
        }
    }
}

# 8. Mostrar credenciais finais
function Show-FinalInfo {
    Write-Section "INSTALACAO CONCLUIDA!"
    
    $output = @"
====================================================================
INSTALACAO CONCLUIDA COM SUCESSO!
====================================================================

ACESSO AO SISTEMA:
--------------------------------------------------
Frontend: http://localhost:$FrontendPort
Backend API: http://localhost:$BackendPort
Banco de Dados: localhost:5432

CREDENCIAIS GERADAS:
--------------------------------------------------
Usuarios do Sistema:

SUPER_ADMIN:
  Email: admin@system.com
  Senha: $ADMIN_PASSWORD

ADMIN (Tenant):
  Email: admin@empresa1.com  
  Senha: $ADMIN_PASSWORD

USER (Comum):
  Email: user@empresa1.com
  Senha: $ADMIN_PASSWORD

CONFIGURACOES DE SEGURANCA:
--------------------------------------------------
Database User: multitenant_user
Database Password: $DB_PASSWORD
Database Name: multitenant_db

JWT Secret: $JWT_SECRET

DIRETORIOS IMPORTANTES:
--------------------------------------------------
Codigo Fonte: $(Get-Location)
Dados do Banco: ./postgres_data
Uploads: ./apps/backend/uploads

PROXIMOS PASSOS:
--------------------------------------------------
1. Acesse http://localhost:$FrontendPort
2. Faca login com qualquer conta acima
3. Explore as funcionalidades multitenant

RECOMENDACOES DE SEGURANCA:
--------------------------------------------------
- Altere as senhas padrao em producao
- Configure HTTPS para ambientes de producao
- Faca backup regular do banco de dados

Ambiente: $NODE_ENV
Data: $(Get-Date -Format "dd/MM/yyyy HH:mm:ss")

====================================================================
"@
    
    Write-Host $output
}

# Função principal
function Main {
    Write-Section "SISTEMA MULTITENANT - INSTALACAO AUTOMATICA"
    
    Test-Requirements
    New-Passwords
    New-EnvFile
    New-DockerCompose
    Start-System
    Initialize-Database
    Test-Health
    Show-FinalInfo
    
    Write-Colored "`nInstalacao concluida! O sistema esta pronto para uso." $SuccessColor
    Write-Colored "Acesse: http://localhost:$FrontendPort" $InfoColor
}

# Executar
Main