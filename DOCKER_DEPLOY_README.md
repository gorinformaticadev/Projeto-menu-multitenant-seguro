# 🚀 Deploy Docker - Guia de Configuração

## 📋 Problema Identificado
O pipeline CI/CD estava falhando no login do Docker Hub devido a configuração incompleta dos secrets no GitHub.

## ✅ Solução Aplicada

### 1. **Workflow Corrigido com Validação Robusta** (`.github/workflows/ci-cd.yml`)
```yaml
- name: Validate Docker Hub secrets
  run: |
    echo "🔍 Validating Docker Hub secrets..."

    if [ -z "${{ secrets.DOCKER_USERNAME }}" ]; then
      echo "❌ ERROR: DOCKER_USERNAME secret is missing or empty"
      exit 1
    fi

    if [ -z "${{ secrets.DOCKER_TOKEN }}" ]; then
      echo "❌ ERROR: DOCKER_TOKEN secret is missing or empty"
      exit 1
    fi

    echo "✅ All Docker Hub secrets are valid and available"

- name: Login to Docker Hub
  uses: docker/login-action@v2
  with:
    username: ${{ secrets.DOCKER_USERNAME }}
    password: ${{ secrets.DOCKER_TOKEN }}
```

### 2. **Workflow Pages Desabilitado** (`.github/workflows/pages.yml`)
- **Motivo**: GitHub Pages é incompatível com aplicações SSR
- **Solução**: Workflow desabilitado para evitar builds desnecessários

### 3. **Contexto do Workflow Corrigido**
- Job `test` só roda em push (não herda contexto de PR)
- Job `build` independente e só roda em main
- Validação robusta dos secrets antes do login

## 🔐 Configuração dos Secrets no GitHub

### ❌ Erro Atual: "Username and password required"
Este erro indica que os secrets não estão configurados ou estão vazios.

### ✅ Passo a Passo para Configurar

#### 1. Acesse as configurações do repositório
1. Vá para o seu repositório no GitHub
2. Clique em **Settings** → **Secrets and variables** → **Actions**
3. Clique em **New repository secret**

#### 2. Crie os secrets necessários
```
DOCKER_USERNAME    # Seu username do Docker Hub
DOCKER_TOKEN       # Token de acesso (não a senha!)
```

#### 3. Como gerar o Docker Hub Token
1. Acesse [Docker Hub](https://hub.docker.com/)
2. Vá para **Account Settings** → **Security**
3. Clique em **New Access Token**
4. Dê um nome descritivo (ex: `github-actions`)
5. Selecione permissão **Read, Write, Delete**
6. **IMPORTANTE**: Copie o token imediatamente (ele só aparece uma vez!)
7. Cole no secret `DOCKER_TOKEN` do GitHub

#### 4. Verificação dos Secrets
Após criar, os secrets devem aparecer na lista:
- ✅ `DOCKER_USERNAME` (com valor definido)
- ✅ `DOCKER_TOKEN` (com valor definido)

### 🧪 Teste Local (Opcional)
Antes de commitar, teste o login localmente:

```bash
# Substitua pelos seus valores
echo "YOUR_DOCKER_TOKEN" | docker login -u YOUR_USERNAME --password-stdin

# Se funcionar, verá: "Login Succeeded"
```

## 🐳 Build e Push das Imagens

O workflow agora:
1. ✅ Faz login no Docker Hub corretamente
2. ✅ Build das imagens backend e frontend
3. ✅ Push para Docker Hub com tag `latest`

### Tags das Imagens
- **Backend**: `{DOCKER_USERNAME}/multitenant-backend:latest`
- **Frontend**: `{DOCKER_USERNAME}/multitenant-frontend:latest`

### 🔧 Alternativa: Login Manual no Workflow
Se o `docker/login-action` continuar falhando, use login manual:

```yaml
- name: Login to DockerHub
  run: |
    echo "${{ secrets.DOCKER_TOKEN }}" | docker login -u "${{ secrets.DOCKER_USERNAME }}" --password-stdin
```

## 🚀 Próximos Passos

1. **Configure os secrets** no GitHub conforme acima
2. **Push para a branch main** para testar o pipeline
3. **Verifique as imagens** no Docker Hub após o build
4. **Configure o deploy** no seu servidor de produção

## 📝 Comandos Úteis

### Verificar imagens localmente
```bash
# Backend
docker build -t multitenant-backend ./apps/backend
docker run -p 4000:4000 multitenant-backend

# Frontend
docker build -t multitenant-frontend ./apps/frontend
docker run -p 3000:3000 multitenant-frontend
```

### Deploy em produção
```bash
# Pull das imagens
docker pull {DOCKER_USERNAME}/multitenant-backend:latest
docker pull {DOCKER_USERNAME}/multitenant-frontend:latest

# Usar docker-compose para orquestração
docker-compose up -d
```

## ⚠️ Importante
- **GitHub Pages**: Desabilitado pois é incompatível com SSR
- **Deploy**: Use plataformas como Railway, Render, ou VPS próprio
- **Secrets**: Nunca commite tokens/senhas no código

🎉 **Pipeline pronto para deploy com Docker!**