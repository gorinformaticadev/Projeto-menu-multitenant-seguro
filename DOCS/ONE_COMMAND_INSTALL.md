# Sistema de Instalacao One-Command

## Visao Geral

Implementacao de um sistema de instalacao one-command similar ao modelo `curl -sSL https://get.dominio.com.br | sudo bash -s dominio.com.br`.

## Como Funciona

1. **Usuario executa comando:**
   ```bash
   curl -sSL https://get.seudominio.com.br | sudo bash -s app.exemplo.com.br
   ```

2. **Servidor retorna o script install-one-command.sh**

3. **Script executa automaticamente:**
   - Verifica pre-requisitos
   - Instala Docker se necessario
   - Baixa o codigo fonte
   - Configura ambiente
   - Inicia containers
   - Mostra credenciais finais

## Implantacao

### 1. Hospedagem do Script

Voce precisa hospedar o arquivo `install-one-command.sh` em um servidor web acessivel via HTTPS.

**Opcoes de hospedagem:**
- Servidor proprio com nginx/apache
- GitHub Pages (para versao publica)
- CDN (Cloudflare, AWS S3, etc.)

### 2. Configuracao do Dominio

Configure um subdominio especifico para a instalacao:
- `get.seudominio.com.br`
- `install.seudominio.com.br`
- `setup.seudominio.com.br`

### 3. Configuracao Web Server (nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name get.seudominio.com.br;

    ssl_certificate /caminho/para/cert.pem;
    ssl_certificate_key /caminho/para/key.pem;

    location / {
        alias /caminho/para/install-one-command.sh;
        add_header Content-Type text/plain;
    }
}

server {
    listen 80;
    server_name get.seudominio.com.br;
    return 301 https://$server_name$request_uri;
}
```

### 4. Configuracao DNS

Adicione um registro A ou CNAME apontando para seu servidor:
```
get.seudominio.com.br  IN  A  203.0.113.1
```

## Personalizacao

### Customizando o Script

Modifique as seguintes variaveis no `install-one-command.sh`:

```bash
# Informacoes da empresa/sistema
echoblue "  NOME DO SEU SISTEMA                   "
echoblue "  Instalacao automatizada via Docker    "

# URLs e repositorios
git clone https://github.com/seu-usuario/seu-repositorio.git projeto-nome
```

### Adicionando Parametros

```bash
# Suporte a branch especifica
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

## Testando Localmente

### Teste no Linux/Mac:
```bash
chmod +x install-one-command.sh
sudo ./install-one-command.sh teste.exemplo.com.br
```

### Teste simulando curl:
```bash
cat install-one-command.sh | sudo bash -s teste.exemplo.com.br
```

## Seguranca

### Boas praticas:

1. **HTTPS Obrigatorio** - Nunca sirva o script via HTTP
2. **Validacao de Dominio** - Verifique se o dominio e valido
3. **Rate Limiting** - Implemente limites de requisicoes
4. **Logging** - Monitore acessos ao script
5. **Atualizacoes** - Mantenha o script atualizado

### Exemplo de rate limiting no nginx:
```nginx
limit_req_zone $binary_remote_addr zone=install:10m rate=5r/m;

server {
    location / {
        limit_req zone=install burst=10 nodelay;
        alias /caminho/para/install-one-command.sh;
        add_header Content-Type text/plain;
    }
}
```

## Monitoramento

### Logs importantes:
- Acessos ao endpoint de instalacao
- Taxa de sucesso das instalacoes
- Erros mais comuns
- Tempo medio de instalacao

## Troubleshooting

**Script nao e encontrado:**
- Verifique permissoes do arquivo
- Confirme caminho no web server
- Teste acesso direto ao arquivo

**Instalacao falha:**
- Verifique logs do Docker
- Confirme espaco em disco disponivel
- Valide conectividade de rede

**Dominio nao resolve:**
- Verifique registros DNS
- Confirme propagacao DNS
- Teste com nslookup/dig

## Exemplos de Uso

### Instalacao basica:
```bash
curl -sSL https://get.seudominio.com.br | sudo bash -s meusistema.com.br
```

### Com parametros adicionais:
```bash
curl -sSL https://get.seudominio.com.br | sudo bash -s -b develop meusistema.com.br
```

### Silenciosa (sem interacao):
```bash
curl -sSL https://get.seudominio.com.br | sudo bash -s --silent meusistema.com.br
```
