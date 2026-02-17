# Guia do Workspace (pnpm)

Este projeto utiliza **pnpm workspace** para gerenciamento eficiente de dependências e scripts. Abaixo você explicamos como trabalhar corretamente neste formato em monorepo.

## 🏗️ Estrutura do Projeto

O projeto segue a estrutura de monorepo onde a raiz gerencia as dependências compartilhadas e orquestra os scripts.

```text
/
├── package.json          # Scripts globais (dev:backend, dev:frontend, etc)
├── pnpm-workspace.yaml   # Configuração do workspace
├── pnpm-lock.yaml        # Lockfile único para todo o projeto
├── apps/
│   ├── backend/          # NestJS (porta 4000)
│   └── frontend/         # Next.js (porta 5000)
```

## 🚀 Como trabalhar no projeto

### Instalação de Dependências

**NUNCA** rode `npm install` ou `pnpm install` dentro das pastas `apps/backend` ou `apps/frontend`.
Toda a instalação deve ser feita **na raiz do projeto**.

```bash
# Na raiz do projeto
pnpm install
```
Isso instalará todas as dependências de todos os apps e criará os links simbólicos necessários.

### Adicionando novas dependências

Para adicionar uma biblioteca a um projeto específico, use o filtro `--filter`:

```bash
# Adicionar 'axios' apenas no backend
pnpm --filter backend add axios

# Adicionar 'date-fns' apenas no frontend
pnpm --filter frontend add date-fns

# Adicionar uma dependência de desenvolvimento (ex: types)
pnpm --filter backend add -D @types/node
```

## 🛠️ Comandos Comuns

Para facilitar, configuramos atalhos no `package.json` da raiz. Você pode rodar tudo da raiz sem precisar entrar nas pastas.

| Comando | Descrição | Equivalente a... |
|---------|-----------|------------------|
| `pnpm run install:all` | Instala tudo | `pnpm install` |
| `pnpm run dev:backend` | Inicia Backend (dev) | `cd apps/backend && pnpm run start:dev` |
| `pnpm run dev:frontend` | Inicia Frontend (dev) | `cd apps/frontend && pnpm run dev` |
| `pnpm run build:all` | Builda todos os apps | `pnpm -r run build` |
| `pnpm run test:all` | Roda testes em tudo | `pnpm -r run test` |
| `pnpm run clean` | Limpa node_modules/dist | `rm -rf ...` |

### Rodando comandos específicos

Se você precisar rodar um comando específico dentro de uma pasta (ex: prisma), você tem duas opções:

**Opção 1: Usando --filter (Recomendado)**
```bash
# Rodar migration no backend
pnpm --filter backend exec prisma migrate deploy
```

**Opção 2: Entrando na pasta**
```bash
cd apps/backend
pnpm prisma migrate deploy
```

## ✅ Boas Práticas

1.  **Sempre use pnpm**: Não misture `npm` ou `yarn`. Se ver um `package-lock.json` ou `yarn.lock`, apague-o.
2.  **Lockfile Único**: O arquivo `pnpm-lock.yaml` na raiz é a única fonte da verdade. Mantenha-o sempre commitado.
3.  **CI/CD**: No pipeline, basta rodar `pnpm install` na raiz. O cache do pnpm deve ser configurado baseado no lockfile da raiz.

## 🤖 CI/CD (Github Actions)

Para otimizar seu pipeline `.github/workflows/ci-cd.yml`, sugerimos as seguintes mudanças:

1.  **Instalação Única**: Não instale dependências dentro de cada pasta. Instale apenas na raiz.
2.  **Scripts via Workspace**: Use `pnpm --filter` para rodar scripts.

### Exemplo de Workflow Otimizado

```yaml
      # ... setup node & pnpm ...

      - name: Install dependencies (Root)
        run: pnpm install --frozen-lockfile

      - name: Generate Prisma Client
        run: pnpm --filter backend exec prisma generate

      - name: Run Lint (Parallel)
        run: pnpm -r run lint --if-present

      - name: Run Tests (Parallel)
        run: pnpm -r run test --if-present
        env:
           DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Build Backend
        run: pnpm --filter backend run build

      - name: Build Frontend
        run: pnpm --filter frontend run build
```
Isso reduz o tempo de build pois evita múltiplas instalações de `node_modules`.
