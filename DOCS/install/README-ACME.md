# install-acme - Guia Rápido

## 🚀 Instalação Rápida

### Opção 1: Com nginx-proxy Docker (compatível com Ticketz)

```bash
git clone https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro.git
cd Projeto-menu-multitenant-seguro
sudo bash install/install-acme menu.exemplo.com.br admin@exemplo.com.br
```

### Opção 2: Com Nginx externo (fora do Docker)

```bash
git clone https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro.git
cd Projeto-menu-multitenant-seguro
sudo bash install/install-acme menu.exemplo.com.br admin@exemplo.com.br --external-nginx
```

## 📋 Pré-requisitos

- Ubuntu 20.04+ ou Debian 11+
- Acesso root (sudo)
- **Domínio apontando para o servidor** (registro DNS tipo A)
- Portas 80 e 443 disponíveis

## ✨ Características

✅ Detecta e integra com instalações existentes do **ticketz-docker-acme**  
✅ Instala tudo do zero se necessário (Docker, Nginx, Certbot)  
✅ Suporta Nginx externo (fora do Docker)  
✅ SSL automático via Let's Encrypt  
✅ Validação de DNS  

## 📚 Documentação Completa

Veja [INSTALL-ACME.md](./INSTALL-ACME.md) para documentação detalhada.

## 🔧 Sintaxe

```bash
sudo bash install/install-acme <domain> <email> [--external-nginx]
```

**Parâmetros:**
- `domain`: Domínio para acesso (ex: menu.exemplo.com.br)
- `email`: Email para certificados Let's Encrypt
- `--external-nginx`: (Opcional) Usa Nginx no host ao invés de Docker

## 🎯 Cenários de Uso

### Cenário 1: Servidor Limpo
Instala tudo do zero (Docker, nginx-proxy, acme-companion, aplicação).

### Cenário 2: Servidor com Ticketz
Detecta o ticketz-docker-acme e integra automaticamente na mesma rede.

### Cenário 3: Nginx Externo
Usa Nginx instalado no host com Certbot para SSL.

## 🔍 Verificação

Após instalação:

```bash
# Ver containers
docker ps

# Acessar aplicação
curl -I https://menu.exemplo.com.br

# Ver logs
cd /opt/multitenant
docker compose logs -f
```

## 🆘 Problemas?

Consulte a seção de [Troubleshooting](./INSTALL-ACME.md#troubleshooting) na documentação completa.

## 📂 Estrutura Criada

**Modo Docker Proxy:**
```
/opt/multitenant/          # Aplicação
/opt/nginx-proxy/          # Proxy (se criado)
```

**Modo Nginx Externo:**
```
/opt/multitenant/                    # Aplicação
/etc/nginx/sites-available/          # Config Nginx
/etc/letsencrypt/live/<domain>/      # Certificados
```

## 🔄 Atualização

```bash
cd /opt/multitenant
git pull
docker compose down
docker compose up -d --build
```

## 🗑️ Desinstalação

```bash
cd /opt/multitenant
docker compose down -v
sudo rm -rf /opt/multitenant
```

Se usou Nginx externo:
```bash
sudo rm /etc/nginx/sites-enabled/multitenant.conf
sudo certbot delete --cert-name menu.exemplo.com.br
```

---

**Desenvolvido para compatibilidade com ticketz-docker-acme**
