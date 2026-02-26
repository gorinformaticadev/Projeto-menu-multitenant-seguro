# Instalação Manual Docker - Projeto Menu Multitenant Seguro

Este tutorial irá guiar você passo a passo na instalação do sistema utilizando Docker e Docker Compose.

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

## Passo 3: Instalar Docker

Agora vamos instalar o Docker Engine:

```bash
# Remover versões antigas do Docker, se existirem
sudo apt remove -y docker docker-engine docker.io containerd runc

# Atualizar pacotes
sudo apt update

# Instalar dependências para usar repositório HTTPS
sudo apt install -y ca-certificates curl gnupg lsb-release

# Adicionar chave GPG oficial do Docker
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Configurar repositório do Docker
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Atualizar novamente
sudo apt update

# Instalar Docker Engine, CLI e containerd
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Adicionar seu usuário ao grupo docker para executar comandos sem sudo
sudo usermod -aG docker $USER

# Ativar o Docker para iniciar com o sistema
sudo systemctl enable docker
sudo systemctl start docker
```

## Passo 4: Verificar Instalação do Docker

Teste se o Docker está funcionando corretamente:

```bash
# Verificar versão do Docker
docker --version

# Verificar versão do Docker Compose
docker compose version

# Testar execução de container
docker run hello-world
```

## Passo 5: Clonar o Repositório do Projeto

Agora vamos clonar o código-fonte do projeto:

```bash
# Ir para o diretório home
cd ~

# Clonar o repositório
git clone https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro.git

# Entrar no diretório do projeto
cd ~/Projeto-menu-multitenant-seguro
```

## Passo 6: Configurar Firewall

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

## Passo 7: Configurar Variáveis de Ambiente

Vamos configurar o ambiente para a produção Docker. Primeiro, vamos criar o arquivo de ambiente:

```bash
# Ir para o diretório de instalação
cd ~/Projeto-menu-multitenant-seguro/install

# Copiar o exemplo de arquivo de ambiente
cp .env.installer.example .env.production

# Editar o arquivo para configurar seu domínio e informações
nano .env.production
```

Você precisará configurar as seguintes variáveis no arquivo `.env.production`:
- `DOMAIN`: Seu domínio (ex: app.suaempresa.com.br)
- `LETSENCRYPT_EMAIL`: Seu email para Let's Encrypt
- `IMAGE_OWNER`: Nome de usuário no GitHub Container Registry
- `FRONTEND_URL`: URL do frontend (normalmente https://seu-domínio.com.br)
- `NEXT_PUBLIC_API_URL`: URL da API (normalmente https://seu-domínio.com.br/api)

## Passo 8: Configurar Nginx para Docker

Precisamos configurar o Nginx para trabalhar com o Docker:

```bash
# Criar diretórios necessários
mkdir -p ~/Projeto-menu-multitenant-seguro/nginx/conf.d
mkdir -p ~/Projeto-menu-multitenant-seguro/nginx/certs
mkdir -p ~/Projeto-menu-multitenant-seguro/nginx/webroot

# Copiar o modelo de configuração do Nginx
cp ~/Projeto-menu-multitenant-seguro/install/nginx-docker.conf.template ~/Projeto-menu-multitenant-seguro/nginx/conf.d/default.conf

# Editar o arquivo para incluir seu domínio
sed -i 's/__DOMAIN__/teste.whapichat.com.br/g' ~/Projeto-menu-multitenant-seguro/nginx/conf.d/default.conf
```
(NOTE: Substitua "seu-domínio-aqui.com.br" pelo seu domínio real)

## Passo 9: Iniciar os Serviços com Docker Compose

Agora vamos iniciar todos os serviços usando Docker Compose:

```bash
# Voltar para o diretório raiz do projeto
cd ~/Projeto-menu-multitenant-seguro

# Subir todos os serviços em modo detached (background)
sudo docker compose --env-file install/.env.production -f docker-compose.prod.yml up -d
```

## Passo 10: Verificar o Status dos Serviços

Verifique se todos os serviços estão rodando corretamente:

```bash
# Verificar status dos containers
sudo docker compose --env-file install/.env.production -f docker-compose.prod.yml ps

# Verificar logs do backend
sudo docker logs multitenant-backend

# Verificar logs do frontend
sudo docker logs multitenant-frontend

# Verificar logs do PostgreSQL
sudo docker logs multitenant-postgres

# Verificar logs do Redis
sudo docker logs multitenant-redis
```

## Passo 11: Configurar SSL com Let's Encrypt

Se seu domínio estiver apontando corretamente para o servidor, você pode obter um certificado SSL gratuito:

```bash
# Executar o script de instalação para obter o certificado
sudo bash install/install.sh cert
```

Ou, se preferir configurar manualmente:

```bash
# Instalar certbot
sudo apt install -y certbot

# Obter certificado
sudo certbot certonly --webroot -w ~/Projeto-menu-multitenant-seguro/nginx/webroot -d teste.whapichat.com.br

# Atualizar os arquivos de certificado no diretório correto
sudo cp /etc/letsencrypt/live/teste.whapichat.com.br/fullchain.pem ~/Projeto-menu-multitenant-seguro/nginx/certs/cert.pem
sudo cp /etc/letsencrypt/live/teste.whapichat.com.br/privkey.pem ~/Projeto-menu-multitenant-seguro/nginx/certs/key.pem

# Reiniciar o Nginx
sudo docker compose --env-file install/.env.production -f docker-compose.prod.yml restart nginx
```

## Passo 12: Configurar Renovação Automática do SSL

Configure uma tarefa cron para renovar automaticamente o certificado SSL:

```bash
# Editar crontab
sudo crontab -e

# Adicionar a linha abaixo para tentar renovar o certificado duas vezes por dia
0 12 * * * /usr/bin/certbot renew --quiet --post-hook "cd /home/usuario/Projeto-menu-multitenant-seguro && sudo docker compose --env-file install/.env.production -f docker-compose.prod.yml restart nginx"
```

## Passo 13: Configuração Final

Após tudo configurado, verifique novamente se todos os serviços estão ativos:

```bash
# Verificar status dos containers
sudo docker compose --env-file install/.env.production -f docker-compose.prod.yml ps

# Acessar o sistema no navegador
# Acesse: https://teste.whapichat.com.br

# Credenciais padrão do administrador (verifique o arquivo .env.production):
# Email: geralmente o mesmo email usado para Let's Encrypt
# Senha: 123456 (altere após o primeiro acesso!)
```

## Passo 14: Comandos Úteis para Administração

Alguns comandos úteis para gerenciar o sistema:

```bash
# Verificar status dos containers
sudo docker compose --env-file install/.env.production -f docker-compose.prod.yml ps

# Visualizar logs em tempo real
sudo docker compose --env-file install/.env.production -f docker-compose.prod.yml logs -f

# Parar todos os serviços
sudo docker compose --env-file install/.env.production -f docker-compose.prod.yml down

# Reiniciar todos os serviços
sudo docker compose --env-file install/.env.production -f docker-compose.prod.yml restart

# Atualizar o sistema (baixar novas imagens e reiniciar)
sudo docker compose --env-file install/.env.production -f docker-compose.prod.yml pull
sudo docker compose --env-file install/.env.production -f docker-compose.prod.yml up -d

# Acessar um container específico (por exemplo, o backend)
sudo docker exec -it multitenant-backend bash

# Fazer backup do banco de dados
sudo docker exec multitenant-postgres pg_dump -U postgres multitenant > backup_$(date +%Y%m%d_%H%M%S).sql
```

## Solução de Problemas

Se encontrar problemas durante a instalação:

1. **Certifique-se de que as portas 80 e 443 estão liberadas** no firewall e no provedor de nuvem (AWS, Azure, Google Cloud, etc.)

## Dicas Finais

- Lembre-se de substituir os valores padronizados (como o domínio de teste) por seus valores reais antes de colocar em produção
- Guarde suas credenciais em local seguro
- Faça backups regulares do banco de dados
- Mantenha os sistemas e dependências atualizados

2. **Verifique se o domínio está apontando para o IP do servidor**:
   ```bash
   dig seu-domínio.com.br
   ```

3. **Verifique logs dos containers**:
   ```bash
   sudo docker logs multitenant-backend
   sudo docker logs multitenant-nginx
   ```

4. **Se o SSL não funcionar**, verifique se o domínio está apontando corretamente e se as portas 80/443 estão acessíveis externamente.

Parabéns! Você completou a instalação do sistema usando Docker. O sistema estará acessível em `https://teste.whapichat.com.br`.