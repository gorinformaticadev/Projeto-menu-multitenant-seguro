# Comandos para Diagnóstico no VPS

Execute estes comandos no seu VPS para verificar o estado dos containers e logs:

## 1. Verificar Status dos Containers

```bash
cd /caminho/do/seu/Projeto-menu-multitenant-seguro
docker ps -a
```

**O que verificar**: Todos os containers devem estar com status "Up" e "healthy". Se algum estiver "unhealthy" ou "Restarting", há um problema.

---

## 2. Verificar Logs do Backend (últimas 100 linhas)

```bash
docker logs multitenant-backend --tail 100
```

**O que procurar**:
- Mensagens de erro relacionadas ao banco de dados
- Erros do Prisma Client
- Mensagens de "listening on port 4000"
- Erros de variáveis de ambiente faltando

---

## 3. Verificar Logs do Nginx (últimas 50 linhas)

```bash
docker logs multitenant-nginx --tail 50
```

**O que procurar**:
- Erros de "upstream" (conexão com backend/frontend)
- Erros 502 registrados
- Problemas de resolução DNS

---

## 4. Verificar Logs de Erro do Nginx (dentro do container)

```bash
docker exec multitenant-nginx cat /var/log/nginx/multitenant.error.log | tail -50
```

**O que procurar**:
- Mensagens específicas sobre falhas de proxy
- Erros de conexão recusada

---

## 5. Testar Conectividade Interna entre Containers

### Testar se o backend está respondendo (de dentro do container nginx):

```bash
docker exec multitenant-nginx wget -O- http://backend:4000/api/health
```

**Resultado esperado**: Deve retornar um JSON com status de saúde do backend.

### Testar se o frontend está respondendo:

```bash
docker exec multitenant-nginx wget -O- http://frontend:5000/
```

**Resultado esperado**: Deve retornar HTML da página inicial.

---

## 6. Verificar Configuração Atual do Nginx

```bash
docker exec multitenant-nginx cat /etc/nginx/conf.d/default.conf
```

**O que verificar**: 
- Se o domínio está correto
- Se as linhas de `proxy_pass` estão apontando para os upstreams corretos

---

## 7. Verificar Variáveis de Ambiente do Backend

```bash
docker exec multitenant-backend printenv | grep -E "DATABASE_URL|JWT_SECRET|FRONTEND_URL|NODE_ENV"
```

**O que verificar**:
- `DATABASE_URL` deve estar preenchida corretamente
- `JWT_SECRET` não deve estar vazio
- `FRONTEND_URL` deve ser a URL pública do seu domínio
- `NODE_ENV` deve ser "production"

---

## 8. Verificar se o Backend está Escutando na Porta 4000

```bash
docker exec multitenant-backend netstat -tuln | grep 4000
```

**Resultado esperado**: Deve mostrar algo como `tcp 0.0.0.0:4000 LISTEN`

---

## Envie-me os Resultados

Por favor, execute estes comandos e me envie os resultados dos seguintes (os mais importantes):

1. **Comando 1** (status dos containers)
2. **Comando 2** (logs do backend)
3. **Comando 5** (teste de conectividade do backend)
4. **Comando 6** (configuração atual do nginx)

Com essas informações, poderei confirmar o diagnóstico e fornecer a correção exata!
