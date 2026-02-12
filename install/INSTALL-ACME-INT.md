# Instalação com Nginx Interno (Docker) - install-acme-int

## Visão Geral

O script `install-acme-int` foi desenvolvido para garantir a compatibilidade total com o projeto **ticketz-docker-acme**. Ele utiliza o Nginx dentro de containers Docker (`nginx-proxy` e `acme-companion`) para gerenciar o tráfego e os certificados SSL.

## Características

- ✅ **Nginx no Docker**: Não depende de Nginx instalado no sistema host.
- ✅ **Compatibilidade Ticketz**: Detecta e integra-se automaticamente a stacks `nginx-proxy` existentes.
- ✅ **SSL Automático**: Gerenciamento de certificados via `acme-companion`.
- ✅ **Portas 80/443**: O container proxy assume o controle das portas web do servidor.

## Como Usar

### 1. Preparação
Certifique-se de que as portas 80 e 443 não estão sendo usadas por nenhum serviço externo (como um Nginx instalado diretamente no Ubuntu).

### 2. Execução
```bash
git clone https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro.git
cd Projeto-menu-multitenant-seguro
sudo bash install/install-acme-int menu.exemplo.com.br admin@exemplo.com.br
```

## Integração com Ticketz
Se o Ticketz já estiver instalado, o `install-acme-int` irá:
1. Identificar o container `ticketz-nginx-proxy`.
2. Conectar o Projeto Menu à mesma rede Docker.
3. Configurar o roteamento para que ambos funcionem simultaneamente no mesmo servidor.

## Troubleshooting
- **Conflito de Portas**: Se o script falhar ao iniciar o proxy, verifique se há um Nginx externo rodando: `sudo systemctl stop nginx`.
- **Logs**: Verifique os logs do proxy com `docker logs ticketz-nginx-proxy` ou `docker logs nginx-proxy`.
