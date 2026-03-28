# Indice da Documentacao

## Comecar por aqui

1. `../README.md` - Visao geral do repositorio
2. `INICIO_RAPIDO.md` - Guia rapido para operar o sistema
3. `install/README-INSTALADOR.md` - Guia oficial de instalacao
4. `install/TROUBLESHOOTING.md` - Problemas comuns de instalacao

## Instalacao e Operacao

- Instalacao: `sudo bash install/install.sh install`
- Atualizacao: `sudo bash install/install.sh update`
- Desinstalacao: `sudo bash install/uninstall.sh`
- Validacao: `bash install/check.sh`
- Restore: `install/restore-db.sh` (Docker) ou `install/restore-native.sh` (native)

### Manuais de Instalacao

- Docker Desenvolvimento: `manual-instalacao/INSTALL_DOCKER_DEV.md`
- Docker Local (Prod): `manual-instalacao/INSTALL_DOCKER_LOCAL.md`
- VPS Producao: `manual-instalacao/INSTALL_VPS_PROD.md`
- VPS Dev/Staging: `manual-instalacao/INSTALL_VPS_DEV.md`

### Instalacao One-Command

- Script proprio: `ONE_COMMAND_INSTALL.md`
- Via GitHub: `ONE_COMMAND_GITHUB.md`
- Quick Start: `INSTALL_QUICK_START.md`

## Desenvolvimento

- Comandos uteis: `COMANDOS_UTEIS.md`
- Comandos Prisma: `COMANDOS_PRISMA.md`
- Estrutura do projeto: `ESTRUTURA_PROJETO.md`

## Modulos

- Estrutura e instalacao: `ESTRUTURA_E_INSTALACAO_MODULOS.md`
- Regras de criacao: `REGRAS_CRIACAO_MODULOS.md`
- Exemplo module.json: `examples/module.json.example`

## Interface e Temas

- Guia de temas: `THEMING.md`
- Configuracoes da plataforma: `CONFIGURACOES_PLATAFORMA.md`
- Versao do sistema: `VERSAO_SISTEMA_MENU.md`

## Seguranca

- Guia CSRF: `CSRF_PROTECTION_GUIDE.md`
- Gestao de secrets: `SECRET_MANAGEMENT_GUIDE.md`
- Auditoria de seguranca: `SECURITY_AUDIT_LOGGING.md`
- Hardening: `SECURITY_REGRESSION_HARDENING.md`
- Protecao de rotas: `PROTECAO_ROTAS_RELATORIO.md`
- README seguranca: `README_SEGURANCA.md`
- Cloudflare Zero Trust: `GUIA_CLOUDFLARE_ZERO_TRUST_WAF.md`

## Backup e Restore

- Arquitetura: `backup-restore-architecture.md`
- Progresso: `BACKUP_PROGRESS_IMPLEMENTATION.md`
- README: `BACKUP_RESTORE_README.md`
- Auditoria: `Auditoria_de_backup.md`
- Troubleshooting token: `TROUBLESHOOTING_TOKEN_BACKUP.md`

## Docker

- Troubleshooting Docker: `TROUBLESHOOTING_DOCKER.md`
- Manuais: `manual-instalacao/`

## Operacao e Manutencao

- Maintenance matrix: `maintenance-matrix.md`
- Maintenance QA: `maintenance-qa.md`

## Diagramas e Arquitetura

- Diagrama do sistema: `DIAGRAMA_SISTEMA.md`
- Guia de contribuicao: `CONTRIBUTING.md`
- Changelog: `CHANGELOG.md`

## Estrutura de Pastas

- `install/` - Documentacao do instalador oficial
- `manual-instalacao/` - Guias por ambiente
- `raiz/` - Documentos historicos
- `Modulo/` - Guias especificos de modulos
- `scripts/` - Scripts auxiliares
- `assets/` - Imagens e recursos
