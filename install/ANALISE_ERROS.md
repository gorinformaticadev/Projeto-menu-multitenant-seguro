# Análise de Erros - Script setup.sh Original

## Erros Identificados

### 1. **Erro de Diretório (Linha 112)**
**Problema**: `./setup.sh: line 112: cd: multitenant-docker: No such file or directory`

**Causa**: O script tenta fazer `cd multitenant-docker` mas o repositório foi clonado com o nome correto `Projeto-menu-multitenant-seguro`.

**Solução**: Remover o comando `cd multitenant-docker` e usar `cd "$BASE_DIR"` para navegar para a raiz do repositório clonado.

---

### 2. **Erro de Arquivo .env.example (Linha 24)**
**Problema**: `cp: cannot stat '.env.example': No such file or directory`

**Causa**: O script tenta copiar `.env.example` mas não está no diretório correto após o erro de `cd`.

**Solução**: Adicionar verificação de existência do arquivo e usar caminho absoluto baseado em `$BASE_DIR`.

---

### 3. **Erro de Arquivo .env (Linha 25)**
**Problema**: `sed: can't read .env: No such file or directory`

**Causa**: Como o `.env.example` não foi copiado, o `.env` não existe.

**Solução**: Garantir que o `.env.example` seja copiado corretamente antes de usar `sed`.

---

### 4. **Erro de Nginx (Linhas 160, 206-207)**
**Problema**: 
- `./setup.sh: line 160: /etc/nginx/sites-available/multitenant.conf: No such file or directory`
- `ln: failed to create symbolic link '/etc/nginx/sites-enabled/multitenant.conf': No such file or directory`
- `./setup.sh: line 207: nginx: command not found`

**Causa**: O script tenta criar arquivo em `/etc/nginx/` sem verificar se o Nginx está instalado. Além disso, o redirecionamento `>` não funciona em scripts Bash para criar arquivos em diretórios protegidos.

**Solução**: 
- Adicionar verificação `command -v nginx` antes de tentar configurar
- Usar `cat > arquivo << EOF` para criar o arquivo corretamente
- Adicionar tratamento de erro com `|| true` para não falhar se Nginx não estiver disponível

---

### 5. **Variáveis de Ambiente Não Definidas (Linhas 29-58)**
**Problema**: Múltiplos warnings do Docker Compose:
```
WARN[0000] The "JWT_SECRET" variable is not set. Defaulting to a blank string.
WARN[0000] The "ENCRYPTION_KEY" variable is not set. Defaulting to a blank string.
WARN[0000] The "FRONTEND_URL" variable is not set. Defaulting to a blank string.
...
```

**Causa**: As variáveis são geradas no script mas não estão sendo exportadas ou o `.env` não está sendo lido pelo Docker Compose.

**Solução**: Garantir que o `.env` seja criado corretamente e que contenha todas as variáveis necessárias antes de executar `docker compose`.

---

### 6. **Erro de Build do Docker (Linhas 86-102)**
**Problema**: 
```
ERROR [backend runner 5/9] COPY --from=builder /app/apps/backend/dist ./dist:
ERROR [backend runner 6/9] COPY --from=builder /app/apps/backend/package.json ./package.json:
...
failed to solve: failed to compute cache key: failed to calculate checksum of ref ... "/app/apps/backend/prisma": not found
```

**Causa**: O Dockerfile do backend usa `COPY --from=builder /app/apps/backend/...` mas o contexto do build é apenas `./apps/backend`. O contexto deveria ser a raiz do repositório para que o builder tenha acesso a todos os arquivos do monorepo.

**Solução**: Ajustar o `docker-compose.yml` para usar a raiz do repositório como contexto e especificar o Dockerfile correto:
```yaml
backend:
  build:
    context: .
    dockerfile: apps/backend/Dockerfile
```

---

### 7. **Falta de Geração Automática de Secrets**
**Problema**: Embora o script gere `JWT_SECRET`, `ENCRYPTION_KEY`, etc., não há garantia de que sejam valores válidos ou suficientemente aleatórios.

**Solução**: Usar `openssl rand -hex 32` para gerar valores criptograficamente seguros:
```bash
JWT_SECRET="$(openssl rand -hex 32)"
ENCRYPTION_KEY="$(openssl rand -hex 16)"
```

---

## Resumo das Correções Aplicadas

| Erro | Solução |
|------|---------|
| Diretório incorreto | Usar `$BASE_DIR` e `cd "$BASE_DIR"` |
| .env.example não encontrado | Adicionar verificação e usar caminho absoluto |
| Nginx não instalado | Adicionar `command -v nginx` check |
| Contexto Docker incorreto | Ajustar `docker-compose.yml` para usar raiz como contexto |
| Variáveis não exportadas | Garantir `.env` criado antes de `docker compose` |
| Secrets não aleatórios | Usar `openssl rand -hex` para geração segura |

---

## Como Usar o Script Corrigido

```bash
sudo bash setup_fixed.sh seu-dominio.com.br seu-email@exemplo.com
```

O script irá:
1. Instalar Docker (se necessário)
2. Gerar secrets aleatórios e seguros
3. Criar `.env` com todas as variáveis
4. Ajustar `docker-compose.yml` para contexto correto
5. Subir containers com `docker compose`
6. Exibir credenciais geradas no final

---

## Arquivos Criados

- `setup_fixed.sh`: Script corrigido com todas as correções
- `README_FIXED.md`: Manual de instalação atualizado
- `ANALISE_ERROS.md`: Este documento (análise detalhada)
