# Instalacao rapida

## Fluxo novo (instalador separado)

```bash
git clone https://github.com/gorinformaticadev/install-multitenant.git install
cd install
sudo bash install.sh install -d app.empresa.com -e admin@empresa.com -u gorinformatica
```

## Comandos principais

```bash
sudo bash install.sh install
sudo bash install.sh update
sudo bash install.sh uninstall
```

## O que o instalador faz

1. Clona automaticamente o repositorio da aplicacao.
2. Executa o modo escolhido (local/vps, docker/native).
3. Aplica migrations e seed.
4. Configura nginx/ssl conforme o modo.

## Observacoes

- `uninstall` remove a aplicacao, mas nao remove a pasta do instalador.
- Se quiser mudar o caminho da aplicacao, use `INSTALL_PROJECT_DIR`.
- Se quiser trocar o repo da aplicacao, use `APP_REPO_URL`.

