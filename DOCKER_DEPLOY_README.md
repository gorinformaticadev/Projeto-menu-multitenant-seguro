# 🚀 Deploy Docker - Guia de Configuração

## 📋 Problema Identificado
O pipeline CI/CD estava falhando no login do Docker Hub devido a configuração incorreta dos secrets.

## ✅ Solução Aplicada

### 1. **Workflow Corrigido** (`.github/workflows/ci-cd.yml`)
```yaml
- name: Login to DockerHub
  uses: docker/login-action@v2
  with:
    username: ${{ secrets.DOCKERHUB_USERNAME }}
    password: ${{ secrets.DOCKERHUB_TOKEN }}
```

### 2. **Workflow Pages Desabilitado** (`.github/workflows/pages.yml`)
- **Motivo**: GitHub Pages é incompatível com aplicações SSR
- **Solução**: Workflow desabilitado para evitar builds desnecessários

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
DOCKERHUB_USERNAME    # Seu username do Docker Hub
DOCKERHUB_TOKEN       # Token de acesso (não a senha!)
```

#### 3. Como gerar o Docker Hub Token
1. Acesse [Docker Hub](https://hub.docker.com/)
2. Vá para **Account Settings** → **Security**
3. Clique em **New Access Token**
4. Dê um nome descritivo (ex: `github-actions`)
5. Selecione permissão **Read, Write, Delete**
6. **IMPORTANTE**: Copie o token imediatamente (ele só aparece uma vez!)
7. Cole no secret `DOCKERHUB_TOKEN` do GitHub

#### 4. Verificação dos Secrets
Após criar, os secrets devem aparecer na lista:
- ✅ `DOCKERHUB_USERNAME` (com valor definido)
- ✅ `DOCKERHUB_TOKEN` (com valor definido)

### 🧪 Teste Local (Opcional)
Antes de commitar, teste o login localmente:

```bash
# Substitua pelos seus valores
echo "YOUR_DOCKERHUB_TOKEN" | docker login -u YOUR_USERNAME --password-stdin

# Se funcionar, verá: "Login Succeeded"
```

## 🐳 Build e Push das Imagens

O workflow agora:
1. ✅ Faz login no Docker Hub corretamente
2. ✅ Build das imagens backend e frontend
3. ✅ Push para Docker Hub com tag `latest`

### Tags das Imagens
- **Backend**: `{DOCKERHUB_USERNAME}/multitenant-backend:latest`
- **Frontend**: `{DOCKERHUB_USERNAME}/multitenant-frontend:latest`

### 🔧 Alternativa: Login Manual no Workflow
Se o `docker/login-action` continuar falhando, use login manual:

```yaml
- name: Login to DockerHub
  run: |
    echo "${{ secrets.DOCKERHUB_TOKEN }}" | docker login -u "${{ secrets.DOCKERHUB_USERNAME }}" --password-stdin
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
docker pull {DOCKERHUB_USERNAME}/multitenant-backend:latest
docker pull {DOCKERHUB_USERNAME}/multitenant-frontend:latest

# Usar docker-compose para orquestração
docker-compose up -d
```

## ⚠️ Importante
- **GitHub Pages**: Desabilitado pois é incompatível com SSR
- **Deploy**: Use plataformas como Railway, Render, ou VPS próprio
- **Secrets**: Nunca commite tokens/senhas no código

🎉 **Pipeline pronto para deploy com Docker!**