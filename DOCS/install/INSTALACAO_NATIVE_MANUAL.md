# Instalação Manual Nativa - Projeto Menu Multitenant Seguro

Este tutorial irá guiar você passo a passo na instalação do sistema diretamente no sistema operacional (instalação nativa), sem utilizar Docker.

## Valores Padrão Utilizados

Para facilitar a instalação, este tutorial utiliza os seguintes valores padronizados:

- Domínio de teste: `teste.whapichat.com.br`
- Nome do banco de dados: `multitenant_db`
- Usuário do banco de dados: `meuususariomult`
- Senha do banco de dados: `MinhaSenhaDB`
- Email para Let's Encrypt: `seu.email@teste.whapichat.com.br`

Estes valores serão utilizados em todos os comandos e configurações ao longo deste tutorial.

## Requisitos do Servidor

Antes de começar, verifique se sua VPS ou servidor atende aos requisitos mínimos:

- Sistema operacional: Ubuntu 20.04 LTS ou superior
- Memória RAM: 4GB ou mais
- Armazenamento: 20GB ou mais
- Acesso root ou sudo
- Domínio apontado para o IP do servidor

## Passo 1: Atualizar o Sistema Operacional

Primeiro, vamos atualizar o sistema e instalar pacotes essenciais:

```bash
# Atualizar lista de pacotes
sudo apt update

# Atualizar pacotes instalados
sudo apt upgrade -y

# Instalar pacotes úteis
sudo apt install -y curl wget git unzip vim nano htop net-tools software-properties-common ca-certificates gnupg lsb-release
```

## Passo 2: Criar um Usuário com Poderes de Sudo (Recomendado)

Para segurança, crie um usuário com poderes de sudo ao invés de trabalhar com root:

```bash
# Criar novo usuário (substitua 'usuario' pelo nome desejado)
sudo adduser usuario

# Adicionar o usuário ao grupo sudo
sudo usermod -aG sudo usuario

# Alternar para o novo usuário
su - usuario

# Verificar se o usuário tem poderes de sudo
sudo whoami
```

## Passo 3: Instalar Node.js 20.x LTS

O sistema requer Node.js versão 20.x. Vamos instalar a versão LTS:

```bash
# Baixar e executar o script de instalação do NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Instalar Node.js
sudo apt-get install -y nodejs

# Verificar versão instalada
node --version
pnpm --version
```

## Passo 4: Instalar pnpm

Vamos instalar o gerenciador de pacotes pnpm:

```bash
# Instalar pnpm globalmente usando npm
sudo npm install -g pnpm

# Verificar versão instalada
pnpm --version
```

## Passo 5: Instalar PostgreSQL 15

Agora vamos instalar o banco de dados PostgreSQL:

```bash
# Adicionar chave GPG do PostgreSQL
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# Adicionar repositório do PostgreSQL
echo "deb http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main" | sudo tee /etc/apt/sources.list.d/pgdg.list

# Atualizar lista de pacotes
sudo apt update

# Instalar PostgreSQL 15
sudo apt install -y postgresql-15 postgresql-contrib-15

# Iniciar e habilitar PostgreSQL para iniciar com o sistema
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verificar status do PostgreSQL
sudo systemctl status postgresql
```

## Passo 6: Configurar PostgreSQL

Vamos criar um usuário e banco de dados para a aplicação:

```bash
# Alternar para o usuário postgres
sudo -u postgres psql

# Dentro do console do PostgreSQL, execute os comandos abaixo:
# Criar usuário para o sistema
CREATE USER meuususariomult WITH PASSWORD 'MinhaSenhaDB';

# Criar banco de dados
CREATE DATABASE multitenant_db OWNER meuususariomult;

# Conceder privilégios
GRANT ALL PRIVILEGES ON DATABASE multitenant_db TO meuususariomult;

# Sair do console do PostgreSQL
\q
```

## Passo 7: Instalar Redis

Agora vamos instalar o Redis para cache e sessões:

```bash
# Instalar Redis
sudo apt install -y redis-server

# Iniciar e habilitar Redis para iniciar com o sistema
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Verificar status do Redis
sudo systemctl status redis-server

# Testar conexão com Redis
redis-cli ping
```

## Passo 8: Instalar Nginx

Vamos instalar o servidor web Nginx:

```bash
# Instalar Nginx
sudo apt install -y nginx

# Iniciar e habilitar Nginx para iniciar com o sistema
sudo systemctl start nginx
sudo systemctl enable nginx

# Verificar status do Nginx
sudo systemctl status nginx

# Verificar versão do Nginx
nginx -v
```

## Passo 9: Configurar Firewall

Vamos configurar o firewall para permitir as portas necessárias:

```bash
# Instalar ufw se ainda não estiver instalado
sudo apt install -y ufw

# Permitir SSH (importante para não perder acesso)
sudo ufw allow ssh

# Permitir portas 80 e 443 para o tráfego web
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Ativar o firewall
sudo ufw --force enable

# Verificar status do firewall
sudo ufw status
```

## Passo 10: Clonar o Repositório do Projeto

Agora vamos clonar o código-fonte do projeto:

```bash
# Ir para o diretório home
cd ~

# Clonar o repositório
git clone https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro.git

# Entrar no diretório do projeto
cd ~/Projeto-menu-multitenant-seguro
```

## Passo 11: Instalar OpenSSL (para gerar segredos)

Vamos instalar OpenSSL para gerar segredos de segurança:

```bash
# OpenSSL já deve estar instalado, mas vamos garantir
sudo apt install -y openssl

# Testar OpenSSL
openssl version
```

## Passo 12: Instalar PM2 para Gerenciamento de Processos

Vamos instalar o PM2 para gerenciar os processos da aplicação:

```bash
# Instalar PM2 globalmente
sudo npm install -g pm2

# Configurar PM2 para iniciar com o sistema
sudo -u usuario pm2 startup systemd -u usuario --hp /home/usuario

# Salvar a configuração
sudo -u usuario pm2 save
```

## Passo 13: Configurar Permissões do Projeto

Vamos configurar as permissões corretas para o usuário:

```bash
# Alterar proprietário do diretório do projeto
sudo chown -R usuario:usuario ~/Projeto-menu-multitenant-seguro

# Ajustar permissões
sudo chmod -R 755 ~/Projeto-menu-multitenant-seguro
```

## Passo 14: Instalar Dependências do Projeto

Agora vamos instalar as dependências do projeto:

```bash
# Entrar no diretório do projeto
cd ~/Projeto-menu-multitenant-seguro

# Instalar dependências com pnpm
sudo -u usuario pnpm install
```

## Passo 15: Configurar Arquivos de Ambiente

Vamos configurar os arquivos de ambiente para o backend e frontend:

```bash
# Configurar backend
cd ~/Projeto-menu-multitenant-seguro/apps/backend

# Copiar o exemplo de ambiente
cp .env.example .env

# Editar o arquivo de ambiente do backend
nano .env

# Cole o conteúdo completo abaixo no arquivo .env, substituindo os valores conforme necessário:

# ============================================
# ⚠️  CONFIGURAÇÕES DE SEGURANÇA - IMPORTANTE
# ============================================
# ESTE É UM ARQUIVO DE EXEMPLO!
# NUNCA FAÇA COMMIT DE CREDENCIAIS REAIS NO CÓDIGO!
# SEMPRE UTILIZE VARIÁVEIS DE AMBIENTE OU SECRET MANAGERS

# ============================================
# CONFIGURAÇÕES DO BANCO DE DADOS
# ============================================
# ⚠️  NUNCA UTILIZE ESTA SENHA EM PRODUÇÃO!
DATABASE_URL="postgresql://meuususariomult:MinhaSenhaDB@localhost:5432/multitenant_db?schema=public"

# ============================================
# CONFIGURAÇÕES DE AUTENTICAÇÃO JWT
# ============================================
# ⚠️  IMPORTANTE: Esta chave deve ter pelo menos 32 caracteres e ser única para produção
# ⚠️  GERE UMA CHAVE SEGURA COM: openssl rand -hex 32
JWT_SECRET="" aHP1CQF12M8vwzInnPZvEm/OhnYtOShPuSEOxL58pEI=
JWT_EXPIRES_IN="7d"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# ============================================
# CONFIGURAÇÕES DO SERVIDOR
# ============================================
FRONTEND_URL="https://teste.whapichat.com.br"
PORT=4000
# NODE_ENV: development, production, staging
# Afeta configurações de segurança, rate limiting, HTTPS, etc
NODE_ENV="production"
HOST="0.0.0.0"

# ============================================
# CONFIGURAÇÕES DE PRODUÇÃO
# ============================================
# HTTPS - Configure apenas em produção com certificado válido
HTTPS_ENABLED="true"
SSL_KEY_PATH=""
SSL_CERT_PATH=""

# Rate Limiting Global
GLOBAL_RATE_LIMIT_TTL=60000
GLOBAL_RATE_LIMIT_LIMIT=100

# ============================================
# MONITORAMENTO E LOGS
# ============================================
# Sentry (Monitoramento de Erros)
# Obtenha seu DSN em: https://sentry.io/
SENTRY_DSN=""
SENTRY_ENVIRONMENT="production"

# Log Level (error, warn, info, debug)
LOG_LEVEL="info"

# ============================================
# UPLOADS E ARQUIVOS ESTÁTICOS
# ============================================
UPLOAD_DESTINATION="./uploads"
MAX_FILE_SIZE="10485760"  # 10MB em bytes
ALLOWED_FILE_TYPES="image/jpeg,image/png,image/webp"

# URL pública para acesso aos arquivos de upload
# Em desenvolvimento: http://localhost:4000/uploads
# Em produção: https://seu-dominio.com.br/uploads ou URL do CDN
UPLOADS_PUBLIC_URL="https://teste.whapichat.com.br/uploads"

# ============================================
# UPLOADS DE LOGOS DE EMPRESAS
# ============================================
# Tamanho máximo específico para logos (em bytes)
MAX_LOGO_FILE_SIZE="5242880"  # 5MB

# Tipos MIME permitidos para logos
ALLOWED_LOGO_MIME_TYPES="image/jpeg,image/png,image/webp,image/gif"

# Diretório de logos (relativo ao backend)
LOGOS_UPLOAD_DIR="./uploads/logos"

# Cache TTL para logos em segundos
LOGO_CACHE_TTL="86400"  # 24 horas

# ============================================
# UPLOADS SENSÍVEIS (SECURE FILES)
# ============================================
# Diretório raiz de uploads (relativo ao backend)
UPLOADS_ROOT="uploads"

# Diretório de arquivos sensíveis (relativo ao UPLOADS_ROOT)
SECURE_UPLOADS_DIR="uploads/secure"

# Tamanho máximo de arquivo sensível em bytes 
# Desenvolvimento: 10MB | Produção: 20MB
MAX_SECURE_FILE_SIZE="10485760"

# Tipos MIME permitidos para uploads sensíveis (separados por vírgula)
# Imagens: image/jpeg, image/png, image/webp, image/gif
# Documentos: application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document
# Planilhas: application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
ALLOWED_SECURE_MIME_TYPES="image/jpeg,image/png,image/webp,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

# ============================================
# CONFIGURAÇÕES DE SEGURANÇA AVANÇADAS
# ============================================
# CSP Avançado (Content Security Policy)
# Ative apenas se quiser políticas CSP mais restritivas
# Pode quebrar funcionalidades se mal configurado - teste antes!
CSP_ADVANCED="false"

# Headers de Segurança Adicionais
SECURITY_HEADERS_ENABLED="true"

# CSRF Protection (Cross-Site Request Forgery)
# Ative para proteção adicional contra ataques CSRF
# Requer configuração no frontend para enviar token CSRF
CSRF_PROTECTION_ENABLED="false"

# CORS - Configurações avançadas
CORS_MAX_AGE=86400  # 24 horas

# ============================================
# CONFIGURAÇÕES DE EMAIL (para notificações)
# ============================================
# ⚠️  ESTAS CREDENCIAIS DEVEM SER CONFIGURADAS VIA INTERFACE ADMINISTRATIVA
# ⚠️  NÃO DEVEM FICAR AQUI EM PRODUÇÃO!
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="seu-email@gmail.com"
SMTP_PASS="sua-senha-app"
EMAIL_FROM="noreply@example.com"
EMAIL_FROM_NAME="Sistema Multitenant"

# ============================================
# CONFIGURAÇÕES DE CACHE (Redis - opcional)
# ============================================
# REDIS_URL=""
# CACHE_TTL=3600  # 1 hora

# ============================================
# UPLOAD DE MÓDULOS
# ============================================
# Tamanho máximo para módulos ZIP (em bytes)
MAX_MODULE_FILE_SIZE="52428800"  # 50MB

# Diretório temporário para processamento de módulos
MODULES_TEMP_DIR="./uploads/temp"

# Diretório de instalação de módulos
MODULES_INSTALL_DIR="./modules"

# ============================================
# PROTEÇÃO ADICIONAL DE UPLOADS
# ============================================
# Habilitar validação de magic numbers (assinatura de arquivos)
ENABLE_FILE_SIGNATURE_VALIDATION="true"

# Habilitar soft delete automático em secure files
SECURE_FILES_SOFT_DELETE="true"

# Tempo de retenção de arquivos deletados (em dias)
SECURE_FILES_RETENTION_DAYS="90"

ENCRYPTION_KEY= 0d52d2aec51700cfce0a0c93708bf896d138f6d774f947574a88fb19ec2b2861c
```

Configure as seguintes variáveis no arquivo `.env` do backend:
- `DATABASE_URL`: postgresql://meuususariomult:MinhaSenhaDB@localhost:5432/multitenant_db
- `JWT_SECRET`: Uma string aleatória segura (gerada com `openssl rand -hex 32`)
- `ENCRYPTION_KEY`: Outra string aleatória segura (gerada com `openssl rand -hex 32`)
- `FRONTEND_URL`: https://teste.whapichat.com.br
- `NODE_ENV`: production
- `PORT`: 4000
- `REDIS_HOST`: 127.0.0.1
- `REDIS_PORT`: 6379

```bash
# Configurar frontend
cd ~/Projeto-menu-multitenant-seguro/apps/frontend

# Copiar o exemplo de ambiente
cp .env.local.example .env.local

# Editar o arquivo de ambiente do frontend
nano .env.local

# Cole o conteúdo completo abaixo no arquivo .env.local:

NEXT_PUBLIC_API_URL=https://teste.whapichat.com.br/api
```

Configure a variável no arquivo `.env.local` do frontend:
- `NEXT_PUBLIC_API_URL`: https://teste.whapichat.com.br/api

## Passo 16: Gerar Prisma Client

Vamos gerar o cliente Prisma para interagir com o banco de dados:

```bash
# Ir para o diretório do backend
cd ~/Projeto-menu-multitenant-seguro/apps/backend

# Gerar o cliente Prisma
sudo -u usuario pnpm exec prisma generate
```

## Passo 17: Construir a Aplicação

Agora vamos construir a aplicação para produção:

```bash
# Construir o backend
cd ~/Projeto-menu-multitenant-seguro/apps/backend
sudo -u usuario NODE_ENV=production pnpm run build

# Construir o frontend
cd ~/Projeto-menu-multitenant-seguro/apps/frontend
sudo -u usuario NODE_ENV=production pnpm run build
```

## Passo 18: Executar Migrations

Vamos aplicar as migrations do banco de dados:

```bash
# Ir para o diretório do backend
cd ~/Projeto-menu-multitenant-seguro/apps/backend

# Executar migrations
sudo -u usuario pnpm exec prisma migrate deploy
```

## Passo 19: Executar Seeds (Dados Iniciais)

Vamos popular o banco com dados iniciais:

```bash
# Ir para o diretório do backend
cd ~/Projeto-menu-multitenant-seguro/apps/backend

# Executar seed
sudo -u usuario pnpm exec prisma db seed
```

## Passo 20: Configurar Nginx para a Aplicação

Agora vamos configurar o Nginx como proxy reverso para nossa aplicação:

```bash
# Remover configuração padrão do Nginx
sudo rm /etc/nginx/sites-enabled/default

# Criar novo arquivo de configuração
sudo nano /etc/nginx/sites-available/multitenant
```

Cole o seguinte conteúdo no arquivo (substitua `seu-dominio.com.br` pelo seu domínio real):

```nginx
server {
    listen 80;
    server_name teste.whapichat.com.br www.teste.whapichat.com.br;

    # Redirecionar HTTP para HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name teste.whapichat.com.br www.teste.whapichat.com.br;

    # Caminhos para certificados SSL (serão adicionados após obter o certificado)
    ssl_certificate /etc/ssl/multitenant/cert.pem;
    ssl_certificate_key /etc/ssl/multitenant/key.pem;

    # Configurações SSL recomendadas
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Regras de segurança
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

    # Proxy para o backend (Node.js na porta 4000)
    location /api {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_redirect off;
    }

    # Proxy para uploads
    location /uploads {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_redirect off;
    }

    # Proxy para o frontend (Next.js na porta 5000)
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_redirect off;
    }

    # Desafio ACME para Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
}
```

Agora habilite o site:

```bash
# Criar link simbólico para habilitar o site
sudo ln -s /etc/nginx/sites-available/multitenant /etc/nginx/sites-enabled/

# Testar configuração do Nginx
sudo nginx -t

# Recarregar configuração do Nginx
sudo systemctl reload nginx
```

## Passo 21: Criar Certificado Autoassinado Temporário

Antes de obter o certificado SSL da Let's Encrypt, vamos criar um certificado autoassinado temporário:

```bash
# Criar diretório para certificados
sudo mkdir -p /etc/ssl/multitenant

# Gerar certificado autoassinado
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/multitenant/key.pem \
    -out /etc/ssl/multitenant/cert.pem \
    -subj "/CN=teste.whapichat.com.br"

# Recarregar Nginx para usar o certificado
sudo systemctl reload nginx
```

## Passo 22: Instalar e Configurar Certbot para Let's Encrypt

Vamos instalar o Certbot para obter certificados SSL gratuitos:

```bash
# Instalar Certbot e plugin para Nginx
sudo apt install -y certbot python3-certbot-nginx

# Criar diretório para desafios ACME
sudo mkdir -p /var/www/certbot
```

## Passo 23: Obter Certificado SSL da Let's Encrypt

Agora vamos obter o certificado SSL:

```bash
# Obter certificado SSL
sudo certbot --nginx -d teste.whapichat.com.br -d www.teste.whapichat.com.br \
    --email seu.email@teste.whapichat.com.br --agree-tos --non-interactive
```

Se o comando acima não funcionar devido a restrições de rate limit ou outros fatores, você pode usar o método de desafio manual:

```bash
# Método alternativo com desafio webroot
sudo certbot certonly --webroot -w /var/www/certbot \
    -d teste.whapichat.com.br -d www.teste.whapichat.com.br \
    --email seu.email@teste.whapichat.com.br --agree-tos --non-interactive
```

## Passo 24: Configurar Renovação Automática do SSL

Configure uma tarefa cron para renovar automaticamente o certificado SSL:

```bash
# Editar crontab
sudo crontab -e

# Adicionar a linha abaixo para tentar renovar o certificado duas vezes por dia
0 12 * * * /usr/bin/certbot renew --quiet --post-hook "systemctl reload nginx"
```

## Passo 25: Iniciar Aplicação com PM2

Agora vamos iniciar a aplicação usando PM2:

```bash
# Ir para o diretório raiz do projeto
cd ~/Projeto-menu-multitenant-seguro

# Criar arquivo de configuração do PM2
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'multitenant-backend',
    script: './apps/backend/dist/main.js',
    instances: 1,
    env: {
      NODE_ENV: 'production',
      PORT: 4000
    }
  }, {
    name: 'multitenant-frontend',
    script: 'npx',
    args: 'next start ./apps/frontend',
    instances: 1,
    cwd: '.',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    }
  }]
};
EOF

# Iniciar aplicação com PM2
sudo -u usuario pm2 start ecosystem.config.js

# Salvar configuração do PM2
sudo -u usuario pm2 save
```

## Passo 26: Verificar Status da Aplicação

Vamos verificar se tudo está funcionando corretamente:

```bash
# Verificar status dos processos PM2
sudo -u usuario pm2 status

# Verificar logs do backend
sudo -u usuario pm2 logs multitenant-backend

# Verificar logs do frontend
sudo -u usuario pm2 logs multitenant-frontend

# Verificar se os serviços estão ouvindo nas portas corretas
sudo netstat -tuln | grep :4000
sudo netstat -tuln | grep :5000
```

## Passo 27: Configuração de Segurança Adicional (Opcional)

Para aumentar a segurança do servidor, você pode instalar e configurar o fail2ban:

```bash
# Instalar fail2ban
sudo apt install -y fail2ban

# Criar arquivo de configuração local
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

# Iniciar e habilitar fail2ban
sudo systemctl start fail2ban
sudo systemctl enable fail2ban
```

## Passo 28: Configuração Final

Agora vamos verificar se tudo está funcionando corretamente:

```bash
# Verificar status do Nginx
sudo systemctl status nginx

# Verificar status do PostgreSQL
sudo systemctl status postgresql

# Verificar status do Redis
sudo systemctl status redis-server

# Verificar status dos processos PM2
sudo -u usuario pm2 status

# Acessar o sistema no navegador
# Acesse: https://teste.whapichat.com.br

# Credenciais padrão do administrador (verifique o arquivo .env):
# Email: configurado no arquivo .env
# Senha: 123456 (altere após o primeiro acesso!)
```

## Passo 29: Comandos Úteis para Administração

Alguns comandos úteis para gerenciar o sistema:

```bash
# Verificar status dos processos PM2
sudo -u usuario pm2 status

# Visualizar logs em tempo real
sudo -u usuario pm2 logs

# Reiniciar aplicação
sudo -u usuario pm2 restart all

# Parar aplicação
sudo -u usuario pm2 stop all

# Reiniciar apenas backend
sudo -u usuario pm2 restart multitenant-backend

# Reiniciar apenas frontend
sudo -u usuario pm2 restart multitenant-frontend

# Verificar uso de recursos
sudo -u usuario pm2 monit

# Verificar logs específicos
sudo -u usuario pm2 logs multitenant-backend --lines 50
sudo -u usuario pm2 logs multitenant-frontend --lines 50

# Verificar status do sistema
sudo systemctl status nginx
sudo systemctl status postgresql
sudo systemctl status redis-server

# Acessar banco de dados PostgreSQL
sudo -u postgres psql -d seu_banco_nome
```

## Solução de Problemas

Se encontrar problemas durante a instalação:

1. **Verifique se todas as portas estão liberadas** no firewall e no provedor de nuvem.

## Dicas Finais

- Lembre-se de substituir os valores padronizados (como o domínio de teste) por seus valores reais antes de colocar em produção
- Guarde suas credenciais em local seguro
- Faça backups regulares do banco de dados
- Mantenha os sistemas e dependências atualizados

2. **Verifique se o domínio está apontando para o IP do servidor**:
   ```bash
   dig seu-domínio.com.br
   ```

3. **Verifique logs dos processos**:
   ```bash
   sudo -u usuario pm2 logs
   ```

4. **Verifique logs do Nginx**:
   ```bash
   sudo tail -f /var/log/nginx/error.log
   sudo tail -f /var/log/nginx/access.log
   ```

5. **Se o SSL não funcionar**, verifique se o domínio está apontando corretamente e se as portas 80/443 estão acessíveis externamente.

6. **Se o backend não subir**, verifique o arquivo .env e confirme que o banco de dados está acessível.

Parabéns! Você completou a instalação do sistema usando instalação nativa. O sistema estará acessível em `https://teste.whapichat.com.br`.