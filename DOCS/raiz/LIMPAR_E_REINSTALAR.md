# Guia para Nova Instalação Limpa

Se você vai trocar de domínio e quer garantir que não haja conflitos de certificados antigos ou banco de dados sujo, siga este passo a passo:

## 1. Limpeza Total (No VPS)

```bash
cd /home/ubuntu/Projeto-menu-multitenant-seguro

# Parar e remover tudo (containers, redes e volumes)
docker compose --env-file install/.env.production -f docker-compose.prod.yml down -v

# Remover pastas de certificados e logs antigos
sudo rm -rf nginx/certs/*
sudo rm -rf nginx/conf.d/*
sudo rm -rf nginx/webroot/*
sudo rm -rf apps/backend/.env
sudo rm -rf apps/frontend/.env.local
sudo rm -rf install/.env.production
```

## 2. Atualizar Código com as Correções

```bash
git pull origin main
```

## 3. Nova Instalação

Substitua `NOVO_DOMINIO` e `SEU_EMAIL` pelos novos dados:

```bash
sudo bash install/install.sh install -d NOVO_DOMINIO -e SEU_EMAIL
```

---

## O que eu mudei no instalador:

1. **Robustez no SSL**: Agora o script faz um teste em "staging" antes de pedir o certificado real. Isso evita que você seja bloqueado pelo Let's Encrypt se o DNS ainda não tiver propagado.
2. **Auto-Migração**: O backend agora executa as migrações do banco de dados automaticamente na primeira subida.
3. **Permissões**: O Dockerfile agora cria as pastas necessárias com as permissões corretas para o usuário `nestjs`.
4. **Fix 502**: O Nginx agora está configurado para evitar o erro de rota duplicada `/api/api`.
