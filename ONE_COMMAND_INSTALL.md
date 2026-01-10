# 🚀 Sistema de Instalação One-Command

## 📋 Visão Geral

Este diretório contém os scripts necessários para implementar um sistema de instalação one-command similar ao modelo `curl -sSL https://get.dominio.com.br | sudo bash -s dominio.com.br`.

## 📁 Estrutura de Arquivos

```
one-command-install/
├── install-one-command.sh      # Script principal de instalação
├── hosting-guide.md           # Guia de hospedagem
├── deployment-example.conf    # Exemplo de configuração nginx
└── README.md                  # Este arquivo
```

## 🎯 Como Funciona

O sistema funciona da seguinte forma:

1. **Usuário executa comando:**
   ```bash
   curl -sSL https://get.seudominio.com.br | sudo bash -s app.exemplo.com.br
   ```

2. **Servidor retorna o script install-one-command.sh**

3. **Script executa automaticamente:**
   - Verifica pré-requisitos
   - Instala Docker se necessário
   - Baixa o código fonte
   - Configura ambiente
   - Inicia containers
   - Mostra credenciais finais

## 🛠️ Implantação

### 1. Hospedagem do Script

Você precisa hospedar o arquivo `install-one-command.sh` em um servidor web acessível via HTTPS.

**Opções de hospedagem:**
- Servidor próprio com nginx/apache
- GitHub Pages (para versão pública)
- CDN (Cloudflare, AWS S3, etc.)
- Serviço especializado de entrega de conteúdo

### 2. Configuração do Domínio

Configure um subdomínio específico para a instalação:
- `get.seudominio.com.br`
- `install.seudominio.com.br` 
- `setup.seudominio.com.br`

### 3. Configuração Web Server

**Exemplo de configuração nginx:**

```nginx
server {
    listen 443 ssl http2;
    server_name get.seudominio.com.br;
    
    ssl_certificate /caminho/para/cert.pem;
    ssl_certificate_key /caminho/para/key.pem;
    
    location / {
        # Retorna o script de instalação
        alias /caminho/para/install-one-command.sh;
        add_header Content-Type text/plain;
    }
}

server {
    listen 80;
    server_name get.seudominio.com.br;
    
    # Redireciona para HTTPS
    return 301 https://$server_name$request_uri;
}
```

### 4. Configuração DNS

Adicione um registro A ou CNAME apontando para seu servidor:
```
get.seudominio.com.br  IN  A  203.0.113.1
```

## 📋 Personalização

### Customizando o Script

Modifique as seguintes variáveis no `install-one-command.sh`:

```bash
# Informações da empresa/sistema
echoblue "  NOME DO SEU SISTEMA                   "
echoblue "  Instalação automatizada via Docker    "

# URLs e repositórios
git clone https://github.com/seu-usuario/seu-repositorio.git projeto-nome

# Mensagens personalizadas
echored "  Você está instalando o Sistema XYZ    "
```

### Adicionando Parâmetros

Você pode adicionar mais parâmetros ao script:

```bash
# Suporte a branch específica
if [ "$1" = "-b" ] ; then
   BRANCH=$2
   shift
   shift
fi

# Suporte a diferentes ambientes
if [ "$1" = "--dev" ] ; then
   ENVIRONMENT="development"
   shift
fi
```

## 🔧 Testando Localmente

### Teste no Linux/Mac:
```bash
# Tornar executável
chmod +x install-one-command.sh

# Testar com parâmetros
sudo ./install-one-command.sh teste.exemplo.com.br
```

### Teste simulando curl:
```bash
# Simular o comando curl
cat install-one-command.sh | sudo bash -s teste.exemplo.com.br
```

## 🛡️ Segurança

### Boas práticas:

1. **HTTPS Obrigatório** - Nunca sirva o script via HTTP
2. **Validação de Domínio** - Verifique se o domínio é válido
3. **Rate Limiting** - Implemente limites de requisições
4. **Logging** - Monitore acessos ao script
5. **Atualizações** - Mantenha o script atualizado

### Exemplo de rate limiting no nginx:
```nginx
limit_req_zone $binary_remote_addr zone=install:10m rate=5r/m;

server {
    # ... configuração anterior ...
    
    location / {
        limit_req zone=install burst=10 nodelay;
        alias /caminho/para/install-one-command.sh;
        add_header Content-Type text/plain;
    }
}
```

## 📊 Monitoramento

### Logs importantes:
- Acessos ao endpoint de instalação
- Taxa de sucesso das instalações
- Erros mais comuns
- Tempo médio de instalação

### Métricas sugeridas:
```bash
# Contar instalações bem-sucedidas
grep "INSTALAÇÃO CONCLUÍDA" /var/log/nginx/access.log | wc -l

# Identificar erros comuns
grep "Falha" /var/log/nginx/error.log
```

## 🆘 Troubleshooting

### Problemas Comuns:

**Script não é encontrado:**
- Verifique permissões do arquivo
- Confirme caminho no web server
- Teste acesso direto ao arquivo

**Instalação falha:**
- Verifique logs do Docker
- Confirme espaço em disco disponível
- Valide conectividade de rede

**Domínio não resolve:**
- Verifique registros DNS
- Confirme propagação DNS
- Teste com nslookup/dig

## 📱 Exemplos de Uso

### Instalação básica:
```bash
curl -sSL https://get.seudominio.com.br | sudo bash -s meusistema.com.br
```

### Com parâmetros adicionais:
```bash
curl -sSL https://get.seudominio.com.br | sudo bash -s -b develop meusistema.com.br
```

### Silenciosa (sem interação):
```bash
curl -sSL https://get.seudominio.com.br | sudo bash -s --silent meusistema.com.br
```

## 🔄 Atualizações

### Processo de atualização:
1. Teste o novo script em ambiente de staging
2. Atualize o arquivo no servidor de produção
3. Monitore os primeiros acessos
4. Verifique taxa de sucesso

### Versionamento:
```bash
# Adicionar versionamento
VERSION="1.2.3"
echo "# Script de Instalação v$VERSION" > install-one-command.sh
```

---

**Importante:** Este é um sistema poderoso que executa comandos como root. Certifique-se sempre da segurança e confiabilidade do script antes de disponibilizá-lo publicamente.# 🚀 Sistema de Instalação One-Command

## 📋 Visão Geral

Este diretório contém os scripts necessários para implementar um sistema de instalação one-command similar ao modelo `curl -sSL https://get.dominio.com.br | sudo bash -s dominio.com.br`.

## 📁 Estrutura de Arquivos

```
one-command-install/
├── install-one-command.sh      # Script principal de instalação
├── hosting-guide.md           # Guia de hospedagem
├── deployment-example.conf    # Exemplo de configuração nginx
└── README.md                  # Este arquivo
```

## 🎯 Como Funciona

O sistema funciona da seguinte forma:

1. **Usuário executa comando:**
   ```bash
   curl -sSL https://get.seudominio.com.br | sudo bash -s app.exemplo.com.br
   ```

2. **Servidor retorna o script install-one-command.sh**

3. **Script executa automaticamente:**
   - Verifica pré-requisitos
   - Instala Docker se necessário
   - Baixa o código fonte
   - Configura ambiente
   - Inicia containers
   - Mostra credenciais finais

## 🛠️ Implantação

### 1. Hospedagem do Script

Você precisa hospedar o arquivo `install-one-command.sh` em um servidor web acessível via HTTPS.

**Opções de hospedagem:**
- Servidor próprio com nginx/apache
- GitHub Pages (para versão pública)
- CDN (Cloudflare, AWS S3, etc.)
- Serviço especializado de entrega de conteúdo

### 2. Configuração do Domínio

Configure um subdomínio específico para a instalação:
- `get.seudominio.com.br`
- `install.seudominio.com.br` 
- `setup.seudominio.com.br`

### 3. Configuração Web Server

**Exemplo de configuração nginx:**

```nginx
server {
    listen 443 ssl http2;
    server_name get.seudominio.com.br;
    
    ssl_certificate /caminho/para/cert.pem;
    ssl_certificate_key /caminho/para/key.pem;
    
    location / {
        # Retorna o script de instalação
        alias /caminho/para/install-one-command.sh;
        add_header Content-Type text/plain;
    }
}

server {
    listen 80;
    server_name get.seudominio.com.br;
    
    # Redireciona para HTTPS
    return 301 https://$server_name$request_uri;
}
```

### 4. Configuração DNS

Adicione um registro A ou CNAME apontando para seu servidor:
```
get.seudominio.com.br  IN  A  203.0.113.1
```

## 📋 Personalização

### Customizando o Script

Modifique as seguintes variáveis no `install-one-command.sh`:

```bash
# Informações da empresa/sistema
echoblue "  NOME DO SEU SISTEMA                   "
echoblue "  Instalação automatizada via Docker    "

# URLs e repositórios
git clone https://github.com/seu-usuario/seu-repositorio.git projeto-nome

# Mensagens personalizadas
echored "  Você está instalando o Sistema XYZ    "
```

### Adicionando Parâmetros

Você pode adicionar mais parâmetros ao script:

```bash
# Suporte a branch específica
if [ "$1" = "-b" ] ; then
   BRANCH=$2
   shift
   shift
fi

# Suporte a diferentes ambientes
if [ "$1" = "--dev" ] ; then
   ENVIRONMENT="development"
   shift
fi
```

## 🔧 Testando Localmente

### Teste no Linux/Mac:
```bash
# Tornar executável
chmod +x install-one-command.sh

# Testar com parâmetros
sudo ./install-one-command.sh teste.exemplo.com.br
```

### Teste simulando curl:
```bash
# Simular o comando curl
cat install-one-command.sh | sudo bash -s teste.exemplo.com.br
```

## 🛡️ Segurança

### Boas práticas:

1. **HTTPS Obrigatório** - Nunca sirva o script via HTTP
2. **Validação de Domínio** - Verifique se o domínio é válido
3. **Rate Limiting** - Implemente limites de requisições
4. **Logging** - Monitore acessos ao script
5. **Atualizações** - Mantenha o script atualizado

### Exemplo de rate limiting no nginx:
```nginx
limit_req_zone $binary_remote_addr zone=install:10m rate=5r/m;

server {
    # ... configuração anterior ...
    
    location / {
        limit_req zone=install burst=10 nodelay;
        alias /caminho/para/install-one-command.sh;
        add_header Content-Type text/plain;
    }
}
```

## 📊 Monitoramento

### Logs importantes:
- Acessos ao endpoint de instalação
- Taxa de sucesso das instalações
- Erros mais comuns
- Tempo médio de instalação

### Métricas sugeridas:
```bash
# Contar instalações bem-sucedidas
grep "INSTALAÇÃO CONCLUÍDA" /var/log/nginx/access.log | wc -l

# Identificar erros comuns
grep "Falha" /var/log/nginx/error.log
```

## 🆘 Troubleshooting

### Problemas Comuns:

**Script não é encontrado:**
- Verifique permissões do arquivo
- Confirme caminho no web server
- Teste acesso direto ao arquivo

**Instalação falha:**
- Verifique logs do Docker
- Confirme espaço em disco disponível
- Valide conectividade de rede

**Domínio não resolve:**
- Verifique registros DNS
- Confirme propagação DNS
- Teste com nslookup/dig

## 📱 Exemplos de Uso

### Instalação básica:
```bash
curl -sSL https://get.seudominio.com.br | sudo bash -s meusistema.com.br
```

### Com parâmetros adicionais:
```bash
curl -sSL https://get.seudominio.com.br | sudo bash -s -b develop meusistema.com.br
```

### Silenciosa (sem interação):
```bash
curl -sSL https://get.seudominio.com.br | sudo bash -s --silent meusistema.com.br
```

## 🔄 Atualizações

### Processo de atualização:
1. Teste o novo script em ambiente de staging
2. Atualize o arquivo no servidor de produção
3. Monitore os primeiros acessos
4. Verifique taxa de sucesso

### Versionamento:
```bash
# Adicionar versionamento
VERSION="1.2.3"
echo "# Script de Instalação v$VERSION" > install-one-command.sh
```

---

**Importante:** Este é um sistema poderoso que executa comandos como root. Certifique-se sempre da segurança e confiabilidade do script antes de disponibilizá-lo publicamente.