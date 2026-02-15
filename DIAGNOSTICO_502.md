# Diagnóstico do Erro 502 (Bad Gateway)

## Análise Inicial

Com base nos erros reportados no console do navegador, identificamos que:

1. **Erro Principal**: `GET https://multi.whapichat.com.br/api/tenants/public/master-logo 502 (Bad Gateway)`
2. **Erro Secundário**: `GET https://multi.whapichat.com.br/api/platform-config 502 (Bad Gateway)`

## Arquitetura Identificada

### Backend (NestJS)
- **Porta**: 4000
- **Global Prefix**: `/api` (definido em `main.ts` linha 55)
- **Inicialização**: Escuta em `0.0.0.0:4000`
- **Healthcheck**: `http://localhost:4000/api/health`
- **Entrypoint**: Aguarda DB, gera Prisma client, inicia app

### Frontend (Next.js)
- **Porta**: 5000
- **Variável de ambiente**: `NEXT_PUBLIC_API_URL` (deve apontar para o backend via nginx)

### Nginx (Proxy Reverso)
- **Portas**: 80 (HTTP) e 443 (HTTPS)
- **Roteamento**:
  - `location /` → `http://frontend:5000`
  - `location /api` → `http://backend:4000`

## Problemas Identificados

### Problema 1: Proxy Pass Incorreto no Nginx

Na configuração do nginx (`nginx-docker.conf.template`), a linha 37 faz:

```nginx
location /api {
    proxy_pass $backend_upstream;
```

Onde `$backend_upstream = "http://backend:4000"`

**O problema**: Quando o nginx recebe uma requisição para `/api/tenants/public/master-logo`, ele faz proxy para `http://backend:4000/api/tenants/public/master-logo`.

**Mas o backend já tem o global prefix `/api`**, então a rota final seria `/api/api/tenants/public/master-logo`, o que não existe!

### Problema 2: Possível Falha no Healthcheck do Backend

O healthcheck do backend está configurado para verificar `http://localhost:4000/api/health`, mas se o backend não estiver respondendo corretamente, o container pode estar em estado "unhealthy".

## Soluções Propostas

### Solução 1: Corrigir o Proxy Pass do Nginx

Modificar a configuração do nginx para remover o prefixo `/api` ao fazer o proxy:

```nginx
location /api/ {
    rewrite ^/api/(.*)$ /$1 break;
    proxy_pass http://backend:4000/api/;
```

OU simplesmente:

```nginx
location /api/ {
    proxy_pass http://backend:4000/api/;
```

### Solução 2: Verificar Logs dos Containers

Precisamos verificar:
1. Se o backend está realmente rodando
2. Se há erros de conexão com o banco de dados
3. Se o Prisma client foi gerado corretamente
4. Se as variáveis de ambiente estão corretas

## Próximos Passos

1. Verificar se os containers estão rodando
2. Analisar logs do backend
3. Analisar logs do nginx
4. Corrigir a configuração do nginx
5. Testar as correções
