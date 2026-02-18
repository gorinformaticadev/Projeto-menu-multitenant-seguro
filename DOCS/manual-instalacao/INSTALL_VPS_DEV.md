# Instalação VPS Dev (Ambiente de Staging)

Este guia descreve como configurar um ambiente de Desenvolvimento/Staging em um VPS. Este ambiente é idêntico à produção, mas roda com código da branch de desenvolvimento, ideal para testes e validação antes do deploy final.

## Pré-requisitos

*   **VPS:** Ubuntu 22.04 LTS.
*   **Domínio de Teste:** Ex: `dev.suaempresa.com.br` ou `staging.suaempresa.com.br`.
*   **Docker e Git** instalados.

## Diferenças para Produção

*   Utiliza a branch `develop` (ou outra branch de feature).
*   Geralmente usa um subdomínio específico (`dev.`).
*   Pode ter dados fictícios (seeds) recarregados frequentemente.

## Procedimento de Instalação

### 1. Clonar e Selecionar a Branch

Clone o repositório e mude para a branch de desenvolvimento:

```bash
git clone https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro.git
cd Projeto-menu-multitenant-seguro

# Listar branches disponíveis
git branch -r

# Checkout na branch de desenvolvimento (ex: develop)
git checkout develop
```

### 2. Executar Instalação para Staging

Use o mesmo script de instalação, mas aponte para o subdomínio de dev. Recomendamos também definir uma variável para identificar o ambiente, se necessário, mas o script padroniza como 'production' para o build. Para fins de *staging*, isso é o desejado (testar o build de produção).

```bash
sudo bash install/install.sh install \
  -d dev.suaempresa.com.br \
  -e admin@suaempresa.com.br \
  -u gorinformatica
```

### 3. (Opcional) Buildar Imagens Locais

Se você estiver testando alterações que ainda não têm imagem no Registry, o script tentará fazer o build automaticamente se não encontrar a imagem remota.

Para forçar o uso do código local atual:
Edite o arquivo `install/.env.production` (gerado após o primeiro comando) e garanta que `IMAGE_TAG` seja uma tag que não existe remotamente, ou simplesmente rode o update que fará o build se a imagem não for encontrada.

Ou, manualmente:
```bash
docker compose -f docker-compose.prod.yml -f docker-compose.prod.build.yml --env-file install/.env.production build
docker compose -f docker-compose.prod.yml --env-file install/.env.production up -d
```

### 4. Atualização Contínua (CI/CD Manual)

Para atualizar seu ambiente de dev com o código mais recente da branch:

```bash
# Baixar código novo
git pull origin develop

# Atualizar containers (fará build se necessário)
sudo bash install/install.sh update
```

### 5. Dicas de Debug em VPS

Se precisar debugar erros no servidor de staging:

*   **Ver logs do backend:**
    ```bash
    docker logs -f multitenant-backend
    ```
*   **Acessar banco de dados:**
    ```bash
    docker exec -it multitenant-postgres psql -U <usuario_db> -d <nome_db>
    ```
    *(As credenciais ficam salvas em `install/.env.production`)*
