# Instalação VPS Produção

Este guia detalha o procedimento oficial para instalar a aplicação em um servidor VPS (Virtual Private Server) para uso em produção.

## Pré-requisitos do Servidor

*   **Sistema Operacional:** Ubuntu 22.04 LTS (recomendado) ou Debian 11+.
*   **Recursos Mínimos:** 2 vCPU, 4GB RAM (Recomendado: 4GB+ para build local ou 2GB se usar imagens pré-buildadas).
*   **Portas Liberadas:** 80 (HTTP) e 443 (HTTPS).
*   **Domínio:** Um domínio (ex: `app.minhaempresa.com`) apontado para o IP do servidor (Registro A).

## Instalação de Dependências

No servidor VPS, instale Docker e Git:

```bash
# Atualizar pacotes
sudo apt update && sudo apt upgrade -y
```

```bash
# Instalar dependências
sudo apt install -y ca-certificates curl gnupg git
```

```bash
# Criar diretório de chave
sudo install -m 0755 -d /etc/apt/keyrings
```

```bash
# Baixar chave GPG oficial da Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
```

```bash
# Adicionar repositório oficial
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

```bash
# Atualizar lista novamente
sudo apt update
```

```bash
# Instalar Docker oficial + Compose Plugin
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

```bash
# Iniciar e habilitar Docker
sudo systemctl enable --now docker
```

## Procedimento de Instalação

Utilizaremos o script automatizado `install.sh` que gerencia toda a configuração de banco de dados, certificado SSL e Proxy Reverso.

### 1. Clonar o Repositório

```bash
git clone https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro.git
cd Projeto-menu-multitenant-seguro
```

### 2. Executar o Instalador

Execute o comando abaixo, substituindo os valores pelos seus dados reais:

```bash
sudo bash install/install.sh install -d crm.example.com.br -e seuemail@email.com -u gorinformatica
```

*   `-d`: Seu domínio completo.
*   `-e`: Seu email (usado para gerar o certificado SSL e criar o usuário admin inicial).
*   `-u`: Nome do usuário/organização no GitHub Container Registry (opcional se for fazer build local, mas recomendado manter).

**O que o script fará:**
1.  Verificará as dependências.
2.  Gerará senhas seguras para Banco de Dados e JWT.
3.  Configurará o Nginx como Proxy Reverso.
4.  Obterá um certificado SSL válido via Let's Encrypt.
5.  Subirá os containers (Backend, Frontend, Banco, Redis).
6.  Executará as migrações do banco de dados.

### 3. Verificar Instalação

Ao final, o script exibirá as credenciais de acesso.
Acesse seu domínio pelo navegador: `https://app.suaempresa.com.br`.

### 4. Atualização Futura

Para atualizar o sistema para a versão mais recente:

```bash
sudo bash install/install.sh update
```
