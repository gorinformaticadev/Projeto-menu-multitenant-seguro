# Documentacao do Projeto Pluggor

Esta pasta contem a documentacao tecnica e operacional do sistema.

## Estrutura

```
DOCS/
├── assets/                  # Imagens e recursos
├── install/                 # Documentacao do instalador
├── manual-instalacao/       # Guias por ambiente
└── INICIO_RAPIDO.md         # Guia rapido
```

## Instalacao e Operacao

- Guia rapido: `INICIO_RAPIDO.md`
- Instalador completo: `install/README-INSTALADOR.md`
- Troubleshooting: `install/TROUBLESHOOTING.md`

## Manuais por Ambiente

- Docker Desenvolvimento: `manual-instalacao/INSTALL_DOCKER_DEV.md`
- Docker Local (Prod): `manual-instalacao/INSTALL_DOCKER_LOCAL.md`
- VPS Producao: `manual-instalacao/INSTALL_VPS_PROD.md`
- VPS Dev/Staging: `manual-instalacao/INSTALL_VPS_DEV.md`

## Scripts de Instalacao

Os scripts oficiais estao na pasta `install/` na raiz do repositorio:

- `install/install.sh` - Instalacao e atualizacao
- `install/check.sh` - Validacao do ambiente
- `install/uninstall.sh` - Desinstalacao
- `install/renew-cert.sh` - Renovacao de certificado SSL
- `install/restore-db.sh` - Restore via API interna (Docker)
- `install/restore-native.sh` - Restore via API interna (native)

## Regras

- Nao criar `.md` na raiz do repositorio (exceto `README.md` e `CHANGELOG.md`)
- Scripts de apoio devem ficar em `Scripts/`
- Sempre usar `pnpm` como gerenciador de pacotes
