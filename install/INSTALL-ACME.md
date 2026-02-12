# Instalação com install-acme

## Visão Geral

O script `install-acme` é um instalador compatível com o **ticketz-docker-acme** que permite instalar o Projeto Menu Multitenant de duas formas:

1. **Modo Docker Proxy** (padrão): Usa nginx-proxy + acme-companion dentro do Docker, compatível com instalações existentes do Ticketz
2. **Modo Nginx Externo**: Usa Nginx instalado no host (fora do Docker) com Certbot para certificados SSL

## Características

✅ **Compatibilidade com Ticketz**: Detecta e integra automaticamente com instalações existentes do ticketz-docker-acme  
✅ **Instalação do zero**: Se nada estiver instalado, instala Docker, Nginx, Certbot, etc.  
✅ **Nginx externo**: Suporte completo para Nginx fora do Docker  
✅ **SSL automático**: Certificados Let's Encrypt via acme-companion ou Certbot  
✅ **Validação DNS**: Verifica se o domínio está apontando corretamente  
✅ **Detecção inteligente**: Identifica stacks nginx-proxy existentes  

---

## Pré-requisitos

### Requisitos Mínimos

- Ubuntu 20.04+ (ou Debian 11+)
- Acesso root (sudo)
- Domínio apontando para o servidor
- Portas 80 e 443 disponíveis (se usar Nginx externo ou criar novo proxy)

### Domínio e DNS

Antes de executar o instalador, **configure o DNS do seu domínio** para apontar para o IP do servidor:

```bash
# Exemplo de registro DNS tipo A
menu.exemplo.com.br  →  123.456.789.012
```

Você pode verificar se o DNS está propagado:

```bash
dig +short menu.exemplo.com.br
# Deve retornar o IP do seu servidor
```

---

## Modo 1: Instalação com Docker Proxy (Padrão)

Este modo usa **nginx-proxy + acme-companion** dentro do Docker, sendo totalmente compatível com o ticketz-docker-acme.

### Cenário A: Servidor Limpo (sem Ticketz)

Se você tem um servidor sem nada instalado:

```bash
# Clone o repositório
git clone https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro.git
cd Projeto-menu-multitenant-seguro

# Execute o instalador
sudo bash install/install-acme menu.exemplo.com.br admin@exemplo.com.br
```

O instalador irá:
1. Instalar Docker (se necessário)
2. Criar stack nginx-proxy + acme-companion
3. Subir os containers do Multitenant
4. Obter certificados SSL automaticamente
5. Configurar tudo para funcionar em `https://menu.exemplo.com.br`

### Cenário B: Servidor com Ticketz Instalado

Se você já tem o **ticketz-docker-acme** rodando no servidor:

```bash
# Clone o repositório
git clone https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro.git
cd Projeto-menu-multitenant-seguro

# Execute o instalador (mesmo comando)
sudo bash install/install-acme menu.exemplo.com.br admin@exemplo.com.br
```

O instalador irá:
1. Detectar o stack nginx-proxy do Ticketz
2. Integrar o Multitenant na mesma rede
3. Usar o mesmo acme-companion para SSL
4. Ambos os sistemas funcionarão lado a lado

**Exemplo de resultado:**
```
✅ Ticketz:     https://ticketz.exemplo.com.br
✅ Multitenant: https://menu.exemplo.com.br
```

### Cenário C: Servidor com outro nginx-proxy

Se você já tem um nginx-proxy (não do Ticketz):

```bash
sudo bash install/install-acme menu.exemplo.com.br admin@exemplo.com.br
```

O instalador detectará automaticamente e integrará com o proxy existente.

---

## Modo 2: Instalação com Nginx Externo

Este modo usa **Nginx instalado no host** (fora do Docker) e **Certbot** para certificados SSL.

### Quando usar?

- Você já tem Nginx instalado no servidor
- Você gerencia múltiplos sites/aplicações com Nginx
- Você prefere controle total sobre a configuração do Nginx
- Você quer evitar containers nginx-proxy

### Instalação

```bash
# Clone o repositório
git clone https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro.git
cd Projeto-menu-multitenant-seguro

# Execute com flag --external-nginx
sudo bash install/install-acme menu.exemplo.com.br admin@exemplo.com.br --external-nginx
```

O instalador irá:
1. Instalar Docker (se necessário)
2. Instalar Nginx no host (se necessário)
3. Instalar Certbot (se necessário)
4. Subir containers da aplicação (sem nginx)
5. Configurar Nginx no host
6. Obter certificado SSL com Certbot
7. Configurar proxy reverso para os containers

### Portas Utilizadas

No modo Nginx externo, os containers expõem portas **apenas no localhost**:

```
Frontend: 127.0.0.1:5000 → container:3000
Backend:  127.0.0.1:4000 → container:3000
```

O Nginx no host faz proxy reverso:

```
https://menu.exemplo.com.br/     → 127.0.0.1:5000 (frontend)
https://menu.exemplo.com.br/api  → 127.0.0.1:4000 (backend)
```

---

## Parâmetros

```bash
sudo bash install/install-acme <domain> <email> [--external-nginx]
```

| Parâmetro | Obrigatório | Descrição |
|-----------|-------------|-----------|
| `domain` | ✅ Sim | Domínio para acesso (ex: menu.exemplo.com.br) |
| `email` | ✅ Sim | Email para certificados Let's Encrypt |
| `--external-nginx` | ❌ Não | Usa Nginx externo ao invés de nginx-proxy Docker |

---

## Estrutura de Arquivos

### Instalação Docker Proxy

```
/opt/multitenant/                    # Aplicação
├── docker-compose.yml
├── docker-compose.prod.external.yml
├── docker-compose.proxy.override.yml  # Gerado automaticamente
└── .env

/opt/nginx-proxy/                    # Proxy (se criado)
├── docker-compose.yml
├── .env
├── certs/
├── vhost.d/
└── html/
```

### Instalação Nginx Externo

```
/opt/multitenant/                    # Aplicação
├── docker-compose.yml
├── docker-compose.external-nginx.yml
├── docker-compose.override.yml      # Gerado automaticamente
└── .env

/etc/nginx/
├── sites-available/
│   └── multitenant.conf             # Configuração gerada
└── sites-enabled/
    └── multitenant.conf → ../sites-available/multitenant.conf

/etc/letsencrypt/
└── live/
    └── menu.exemplo.com.br/         # Certificados
        ├── fullchain.pem
        └── privkey.pem
```

---

## Verificação Pós-Instalação

### 1. Verificar Containers

```bash
docker ps
```

**Modo Docker Proxy:**
```
CONTAINER NAME              STATUS
nginx-proxy                 Up
acme-companion              Up
multitenant-frontend        Up
multitenant-backend         Up
multitenant-postgres        Up
multitenant-redis           Up
```

**Modo Nginx Externo:**
```
CONTAINER NAME              STATUS
multitenant-frontend        Up
multitenant-backend         Up
multitenant-postgres        Up
multitenant-redis           Up
```

### 2. Verificar Nginx (modo externo)

```bash
sudo nginx -t
sudo systemctl status nginx
```

### 3. Verificar SSL

```bash
curl -I https://menu.exemplo.com.br
```

Deve retornar `HTTP/2 200` ou similar.

### 4. Verificar Logs

**Aplicação:**
```bash
cd /opt/multitenant
docker compose logs -f frontend
docker compose logs -f backend
```

**Nginx Proxy (modo Docker):**
```bash
docker logs nginx-proxy
docker logs acme-companion
```

**Nginx (modo externo):**
```bash
sudo tail -f /var/log/nginx/multitenant.access.log
sudo tail -f /var/log/nginx/multitenant.error.log
```

---

## Compatibilidade com Ticketz

### Como funciona a integração?

O `install-acme` detecta automaticamente se há uma instalação do ticketz-docker-acme:

1. **Busca containers**: Procura por `ticketz-nginx-proxy` e `ticketz-acme-companion`
2. **Identifica a rede**: Descobre qual rede Docker o proxy está usando (geralmente `nginx-proxy`)
3. **Integra**: Conecta os containers do Multitenant na mesma rede
4. **Configura**: Adiciona variáveis de ambiente para o acme-companion gerenciar SSL

### Exemplo de Ambiente Integrado

```
┌─────────────────────────────────────────┐
│  nginx-proxy (ticketz-nginx-proxy)      │
│  - Porta 80/443                          │
│  - Rede: nginx-proxy                     │
└─────────────────────────────────────────┘
           │
           ├─────> ticketz.exemplo.com.br
           │       (Ticketz Frontend)
           │
           └─────> menu.exemplo.com.br
                   (Multitenant Frontend)

┌─────────────────────────────────────────┐
│  acme-companion (ticketz-acme-companion) │
│  - Gerencia SSL para ambos               │
└─────────────────────────────────────────┘
```

### Variáveis de Ambiente Adicionadas

O instalador adiciona automaticamente ao `docker-compose.proxy.override.yml`:

```yaml
services:
  frontend:
    environment:
      VIRTUAL_HOST: "menu.exemplo.com.br"
      LETSENCRYPT_HOST: "menu.exemplo.com.br"
      LETSENCRYPT_EMAIL: "admin@exemplo.com.br"
      VIRTUAL_PORT: "3000"
networks:
  proxy:
    external: true
    name: "nginx-proxy"
```

---

## Troubleshooting

### Problema: DNS não resolve

**Sintoma:**
```
[ERROR] O domínio menu.exemplo.com.br não possui registro A.
```

**Solução:**
1. Configure o DNS do domínio para apontar para o IP do servidor
2. Aguarde propagação (pode levar até 48h, geralmente alguns minutos)
3. Verifique: `dig +short menu.exemplo.com.br`

### Problema: Porta 80/443 ocupada

**Sintoma:**
```
[ERROR] Porta 80/443 ocupada por processo não-Docker
```

**Solução:**

Se for Apache ou Nginx no host:
```bash
sudo systemctl stop apache2
# ou
sudo systemctl stop nginx
```

Se for outro processo:
```bash
sudo ss -tulnp | grep ':80\|:443'
sudo kill <PID>
```

### Problema: Certificado SSL não gerado

**Modo Docker Proxy:**
```bash
# Verificar logs do acme-companion
docker logs acme-companion

# Forçar renovação
docker exec acme-companion /app/signal_le_service
```

**Modo Nginx Externo:**
```bash
# Verificar logs do certbot
sudo certbot certificates

# Tentar manualmente
sudo certbot certonly --nginx -d menu.exemplo.com.br
```

### Problema: Containers não iniciam

```bash
# Ver logs
cd /opt/multitenant
docker compose logs

# Verificar arquivo .env
cat .env

# Recriar containers
docker compose down
docker compose up -d --build
```

### Problema: Erro de conexão com banco de dados

```bash
# Verificar se o PostgreSQL está rodando
docker ps | grep postgres

# Ver logs do banco
docker logs multitenant-postgres

# Verificar variável DATABASE_URL no .env
grep DATABASE_URL /opt/multitenant/.env
```

---

## Atualização

### Atualizar Aplicação

```bash
cd /opt/multitenant
git pull
docker compose down
docker compose up -d --build
```

### Renovar Certificados

**Modo Docker Proxy:**
Os certificados são renovados automaticamente pelo acme-companion.

**Modo Nginx Externo:**
```bash
# Certbot renova automaticamente via cron
# Para forçar renovação:
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

---

## Desinstalação

### Remover Aplicação

```bash
cd /opt/multitenant
docker compose down -v  # -v remove volumes (CUIDADO: apaga dados!)
cd /
sudo rm -rf /opt/multitenant
```

### Remover Nginx Externo (se instalado)

```bash
sudo rm /etc/nginx/sites-enabled/multitenant.conf
sudo rm /etc/nginx/sites-available/multitenant.conf
sudo systemctl reload nginx

# Remover certificados
sudo certbot delete --cert-name menu.exemplo.com.br
```

### Remover nginx-proxy (se criado pelo instalador)

```bash
cd /opt/nginx-proxy
docker compose down -v
cd /
sudo rm -rf /opt/nginx-proxy
```

---

## Configuração Manual do Nginx Externo

Se você preferir configurar o Nginx manualmente ao invés de usar o instalador:

### 1. Subir containers

```bash
cd /caminho/para/Projeto-menu-multitenant-seguro

# Criar .env
cp .env.example .env
nano .env  # Editar conforme necessário

# Subir com docker-compose para nginx externo
docker compose -f docker-compose.yml -f docker-compose.external-nginx.yml up -d
```

### 2. Configurar Nginx

Use o template fornecido:

```bash
sudo cp install/nginx-external.conf.template /etc/nginx/sites-available/multitenant.conf

# Editar e substituir variáveis
sudo nano /etc/nginx/sites-available/multitenant.conf
# Substituir:
#   __DOMAIN__ → menu.exemplo.com.br
#   __FRONTEND_PORT__ → 5000
#   __BACKEND_PORT__ → 4000

# Ativar site
sudo ln -s /etc/nginx/sites-available/multitenant.conf /etc/nginx/sites-enabled/

# Testar configuração
sudo nginx -t

# Recarregar
sudo systemctl reload nginx
```

### 3. Obter certificado SSL

```bash
sudo certbot --nginx -d menu.exemplo.com.br
```

---

## Suporte

Para problemas ou dúvidas:

1. Verifique a seção [Troubleshooting](#troubleshooting)
2. Consulte os logs dos containers e do Nginx
3. Abra uma issue no repositório do projeto

---

## Licença

Este projeto está sob a licença especificada no arquivo LICENSE do repositório.
