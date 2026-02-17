# Sistema Menu Multitenant Seguro

Repositorio monorepo com backend NestJS, frontend Next.js e stack Docker para operacao multitenant.

## Estrutura oficial

- `README.md` -> resumo principal do repositorio (este arquivo)
- `DOCS/` -> toda documentacao funcional, tecnica e historica
- `Scripts/` -> scripts auxiliares, testes manuais e utilitarios
- `install/` -> scripts oficiais de instalacao, update e desinstalacao
- `apps/backend` -> API NestJS
- `apps/frontend` -> aplicacao Next.js

## Fluxo de instalacao oficial

Use sempre os scripts da pasta `install/`:

1. Instalacao inicial
```bash
bash install/install.sh
```

2. Atualizacao
```bash
bash install/update.sh
```

3. Desinstalacao
```bash
bash install/uninstall.sh
```

Scripts relacionados:
- Validacao: `install/check.sh`
- Restauracao de banco: `install/restore-db.sh`
- Renovacao de certificado: `install/renew-cert.sh`

## Documentacao recomendada

- Guia principal do instalador: `DOCS/install/README-INSTALADOR.md`
- Troubleshooting de instalacao: `DOCS/install/TROUBLESHOOTING.md`
- Inicio rapido: `DOCS/INICIO_RAPIDO.md`
- Indice geral da documentacao: `DOCS/INDICE_DOCUMENTACAO.md`

## Padrao de organizacao aplicado

- Arquivos `.md` na raiz: somente `README.md`
- Documentacao fora da raiz: centralizada em `DOCS/`
- Scripts e testes auxiliares: centralizados em `Scripts/`
- Scripts operacionais de deploy/install: mantidos em `install/`
