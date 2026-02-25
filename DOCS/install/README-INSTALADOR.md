# README do instalador

Este guia descreve o formato atual do instalador separado da aplicacao.

## Repositorios

- Instalador: `https://github.com/gorinformaticadev/install-multitenant.git`
- Aplicacao: `https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro.git`

## Uso rapido

```bash
git clone https://github.com/gorinformaticadev/install-multitenant.git install
cd install
sudo bash install.sh install -d app.empresa.com -e admin@empresa.com -u gorinformatica
```

## Comandos disponiveis

```bash
sudo bash install.sh install
sudo bash install.sh update
sudo bash install.sh uninstall
```

## Opcoes de install

```bash
sudo bash install.sh install [opcoes]
```

- `-d`, `--domain DOMAIN`: dominio principal
- `-e`, `--email EMAIL`: email para SSL e admin
- `-u`, `--user USER`: owner das imagens/registry (ex.: `gorinformatica`)
- `-n`, `--no-prompt`: modo nao interativo

## Variaveis de ambiente importantes

- `INSTALL_PROJECT_DIR`: caminho onde a aplicacao sera clonada
- `APP_REPO_URL`: URL do repositorio da aplicacao
- `INSTALL_DOMAIN`: dominio (equivalente a `-d`)
- `LETSENCRYPT_EMAIL`: email (equivalente a `-e`)
- `IMAGE_OWNER`: owner de imagem (equivalente a `-u`)

## Comportamento esperado

1. O instalador clona a aplicacao automaticamente se nao existir.
2. Install/update atuam no diretorio da aplicacao clonado.
3. Uninstall remove a aplicacao e servicos, sem remover a pasta `install/`.

## Troubleshooting rapido

- Falha de clone: verificar acesso Git e conectividade.
- Falha SSL: verificar DNS apontando para o servidor e portas 80/443 liberadas.
- Falha de seed: revisar logs do instalador e executar seed manual no backend.

