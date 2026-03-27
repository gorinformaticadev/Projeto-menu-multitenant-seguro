# Manual de Instalação Automatizada - Multitenant

Este guia descreve como instalar o sistema utilizando o script automatizado via Docker. O processo foi simplificado para exigir apenas o domínio, gerando todas as credenciais de segurança automaticamente.

## 📋 Pré-requisitos

Antes de iniciar, certifique-se de que o servidor possui:
- **Docker** instalado e rodando.
- **Docker Compose** instalado.
- **Git** instalado.
- Portas **4000** (Backend) e **5000** (Frontend) liberadas no firewall.

## 🚀 Passo a Passo da Instalação

### 1. Clonar o Repositório
Acesse seu servidor via terminal e clone o projeto:
```bash
git clone https://github.com/gorinformaticadev/Pluggor.git
cd Pluggor
```

### 2. Executar o Instalador
Dê permissão de execução ao script e inicie a instalação:
```bash
chmod +x install.sh
./install.sh
```

### 3. Configuração de Domínio
O script solicitará o domínio principal (ex: `meusistema.com`).
- O **Frontend** responderá no domínio informado.
- O **Backend** será configurado automaticamente como `api.seu-dominio.com`.

### 4. Finalização e Credenciais
Ao término, o script exibirá um resumo colorido com:
- URLs de acesso.
- **Usuário e Senha do Banco de Dados.**
- **JWT Secret** e **Encryption Key** gerados.

> ⚠️ **IMPORTANTE:** Copie e guarde estas credenciais em um local seguro. Elas são necessárias para manutenção e não serão mostradas novamente.

---

## 🛠️ Configurações Pós-Instalação

### Proxy Reverso (Nginx)
Para que o sistema funcione com HTTPS e nos domínios corretos, você deve configurar um proxy reverso. Exemplo de configuração Nginx:

**Frontend (Porta 5000):**
```nginx
server {
    server_name meusistema.com;
    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**Backend (Porta 4000):**
```nginx
server {
    server_name api.meusistema.com;
    location / {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🔍 Comandos Úteis

- **Ver logs do sistema:** `docker compose logs -f`
- **Parar o sistema:** `docker compose down`
- **Reiniciar o sistema:** `docker compose restart`
- **Atualizar o sistema:**
  ```bash
  git pull
  ./install.sh
  ```

## 🔒 Segurança
- Todas as senhas são geradas com 20 caracteres aleatórios.
- Os segredos JWT e de Criptografia usam hashes hexadecimais de 64 caracteres.
- O arquivo `.env` gerado é restrito ao servidor.
