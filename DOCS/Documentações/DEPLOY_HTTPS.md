# 🔒 Guia de Deploy com HTTPS

## 📋 Pré-requisitos

- Domínio próprio (ex: `seuapp.com`)
- Servidor com IP público
- Certificado SSL (Let's Encrypt recomendado)

## 🚀 Opções de Deploy

### Opção 1: Nginx como Proxy Reverso (Recomendado)

#### 1. Instalar Nginx

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx

# CentOS/RHEL
sudo yum install nginx
```

#### 2. Instalar Certbot (Let's Encrypt)

```bash
# Ubuntu/Debian
sudo apt install certbot python3-certbot-nginx

# CentOS/RHEL
sudo yum install certbot python3-certbot-nginx
```

#### 3. Obter Certificado SSL

```bash
sudo certbot --nginx -d seuapp.com -d www.seuapp.com
```

#### 4. Configurar Nginx

Criar arquivo `/etc/nginx/sites-available/seuapp`:

```nginx
# Redirecionar HTTP para HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name seuapp.com www.seuapp.com;
    
    return 301 https://$server_name$request_uri;
}

# Backend (API)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.seuapp.com;

    # Certificados SSL
    ssl_certificate /etc/letsencrypt/live/api.seuapp.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.seuapp.com/privkey.pem;
    
    # Configurações SSL recomendadas
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Headers de segurança
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Proxy para backend
    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Frontend
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name seuapp.com www.seuapp.com;

    # Certificados SSL
    ssl_certificate /etc/letsencrypt/live/seuapp.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seuapp.com/privkey.pem;
    
    # Configurações SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Headers de segurança
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    
    # Proxy para frontend
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 5. Ativar Configuração

```bash
# Criar link simbólico
sudo ln -s /etc/nginx/sites-available/seuapp /etc/nginx/sites-enabled/

# Testar configuração
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
```

#### 6. Renovação Automática do Certificado

```bash
# Testar renovação
sudo certbot renew --dry-run

# Adicionar ao cron (já configurado automaticamente pelo certbot)
sudo crontab -e
# Adicionar: 0 0 * * * certbot renew --quiet
```

---

### Opção 2: Caddy (Mais Simples)

#### 1. Instalar Caddy

```bash
# Ubuntu/Debian
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

#### 2. Configurar Caddyfile

Criar arquivo `/etc/caddy/Caddyfile`:

```caddy
# Backend
api.seuapp.com {
    reverse_proxy localhost:4000
    
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Frame-Options "DENY"
        X-Content-Type-Options "nosniff"
    }
}

# Frontend
seuapp.com www.seuapp.com {
    reverse_proxy localhost:5000
    
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    }
}
```

#### 3. Reiniciar Caddy

```bash
sudo systemctl restart caddy
```

**Pronto!** Caddy obtém e renova certificados SSL automaticamente.

---

### Opção 3: Docker com Traefik

#### 1. docker-compose.yml

```yaml
version: '3.8'

services:
  traefik:
    image: traefik:v2.10
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.myresolver.acme.tlschallenge=true"
      - "--certificatesresolvers.myresolver.acme.email=seu@email.com"
      - "--certificatesresolvers.myresolver.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock:ro"
      - "./letsencrypt:/letsencrypt"

  backend:
    build: ./backend
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.backend.rule=Host(`api.seuapp.com`)"
      - "traefik.http.routers.backend.entrypoints=websecure"
      - "traefik.http.routers.backend.tls.certresolver=myresolver"
      - "traefik.http.services.backend.loadbalancer.server.port=4000"

  frontend:
    build: ./frontend
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`seuapp.com`)"
      - "traefik.http.routers.frontend.entrypoints=websecure"
      - "traefik.http.routers.frontend.tls.certresolver=myresolver"
      - "traefik.http.services.frontend.loadbalancer.server.port=5000"
```

---

## ⚙️ Configuração da Aplicação

### Backend (.env)

```env
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://seuapp.com
DATABASE_URL=postgresql://user:pass@localhost:5432/db?sslmode=require
JWT_SECRET=sua-chave-super-secreta-64-caracteres-ou-mais
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

### Frontend (.env.production)

```env
NEXT_PUBLIC_API_URL=https://api.seuapp.com
```

---

## 🧪 Testar HTTPS

### 1. Verificar Certificado

```bash
# Verificar certificado SSL
openssl s_client -connect seuapp.com:443 -servername seuapp.com

# Verificar data de expiração
echo | openssl s_client -connect seuapp.com:443 2>/dev/null | openssl x509 -noout -dates
```

### 2. Testar Redirecionamento HTTP → HTTPS

```bash
# Deve redirecionar para HTTPS
curl -I http://seuapp.com

# Resultado esperado:
# HTTP/1.1 301 Moved Permanently
# Location: https://seuapp.com/
```

### 3. Testar Headers de Segurança

```bash
curl -I https://api.seuapp.com

# Deve incluir:
# Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
```

### 4. Usar Ferramentas Online

- **SSL Labs:** https://www.ssllabs.com/ssltest/
  - Deve obter nota A ou A+
  
- **Security Headers:** https://securityheaders.com/
  - Deve obter nota A ou A+

---

## 🔒 Checklist de Segurança HTTPS

### Certificado SSL
- [ ] Certificado válido e não expirado
- [ ] Certificado cobre todos os domínios (www, api, etc)
- [ ] Renovação automática configurada

### Configuração do Servidor
- [ ] HTTP redireciona para HTTPS (301)
- [ ] HSTS habilitado (max-age=31536000)
- [ ] TLS 1.2 e 1.3 habilitados
- [ ] TLS 1.0 e 1.1 desabilitados
- [ ] Ciphers seguros configurados

### Headers de Segurança
- [ ] Strict-Transport-Security
- [ ] X-Frame-Options
- [ ] X-Content-Type-Options
- [ ] X-XSS-Protection
- [ ] Content-Security-Policy

### Aplicação
- [ ] NODE_ENV=production
- [ ] FRONTEND_URL com https://
- [ ] Banco de dados com SSL
- [ ] Cookies com secure flag

---

## 🆘 Problemas Comuns

### Erro: "Too many redirects"
**Causa:** Loop de redirecionamento  
**Solução:** Verificar se proxy está passando X-Forwarded-Proto corretamente

### Erro: "Certificate not valid"
**Causa:** Certificado expirado ou inválido  
**Solução:** Renovar certificado com `certbot renew`

### Erro: "Mixed content"
**Causa:** Recursos HTTP em página HTTPS  
**Solução:** Garantir que todas as URLs usam HTTPS

---

## 📚 Recursos Adicionais

- [Let's Encrypt](https://letsencrypt.org/)
- [SSL Labs](https://www.ssllabs.com/)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
- [OWASP Transport Layer Protection](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html)

---

**Status:** ✅ Guia de Deploy HTTPS Completo  
**Próxima:** Implementar e testar em produção
