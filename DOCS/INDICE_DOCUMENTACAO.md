# Indice da documentacao

## Comecar por aqui

1. `../README.md` - visao geral e novo formato
2. `install/README-INSTALADOR.md` - guia oficial do instalador separado
3. `install/TROUBLESHOOTING.md` - problemas comuns

## Operacao

- Instalacao: `install.sh install`
- Atualizacao: `install.sh update`
- Desinstalacao: `install.sh uninstall`

## Fluxo resumido

```bash
git clone https://github.com/gorinformaticadev/install-multitenant.git install
cd install
sudo bash install.sh install -d app.empresa.com -e admin@empresa.com -u gorinformatica
```

## Documentacao por area

- Backend: `apps/backend/README.md`
- Frontend: `apps/frontend/README.md`
- Scripts auxiliares: `../Scripts/`
- Historico tecnico: `Documentacoes/`
- Arquivos herdados da raiz: `raiz/`

