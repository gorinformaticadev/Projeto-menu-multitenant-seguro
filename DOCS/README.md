# Documentacao do Projeto Pluggor

Esta pasta concentra toda a documentacao oficial do repositorio.

## Secoes

- `INDICE_DOCUMENTACAO.md` - Mapa dos guias principais
- `install/` - Documentacao do instalador oficial (`install/*.sh`)
- `manual-instalacao/` - Guias passo a passo por ambiente
- `raiz/` - Documentos historicos movidos da raiz
- `Modulo/` - Guias especificos de modulos
- `scripts/` - Scripts auxiliares
- `examples/` - Exemplos de configuracao
- `assets/` - Imagens e recursos visuais

## Arquivos Principais

### Para Comecar
- `INICIO_RAPIDO.md` - Guia rapido para operar o sistema
- `BOAS_VINDAS.md` - Introducao ao repositorio
- `ESTRUTURA_PROJETO.md` - Organizacao do codigo fonte
- `INSTALL_QUICK_START.md` - Instalacao rapida

### Referencia de Desenvolvimento
- `COMANDOS_UTEIS.md` - Comandos de desenvolvimento (pnpm)
- `COMANDOS_PRISMA.md` - Referencia do Prisma ORM
- `ESTRUTURA_E_INSTALACAO_MODULOS.md` - Como criar modulos
- `REGRAS_CRIACAO_MODULOS.md` - Regras para modulos

### Configuracao e Interface
- `THEMING.md` - Governanca de temas/CSS
- `CONFIGURACOES_PLATAFORMA.md` - Configuracoes da plataforma
- `VERSAO_SISTEMA_MENU.md` - Exibicao de versao no menu

### Seguranca
- `CSRF_PROTECTION_GUIDE.md` - Protecao CSRF
- `SECRET_MANAGEMENT_GUIDE.md` - Gestao de secrets
- `SECURITY_AUDIT_LOGGING.md` - Auditoria de seguranca
- `SECURITY_REGRESSION_HARDENING.md` - Hardening de seguranca
- `GUIA_CLOUDFLARE_ZERO_TRUST_WAF.md` - Cloudflare Zero Trust

### Backup e Restore
- `backup-restore-architecture.md` - Arquitetura de backup
- `BACKUP_RESTORE_README.md` - README do sistema de backup

### Docker e Deploy
- `ONE_COMMAND_INSTALL.md` - Instalacao via script proprio
- `ONE_COMMAND_GITHUB.md` - Instalacao via GitHub
- `TROUBLESHOOTING_DOCKER.md` - Troubleshooting Docker

### Diagramas e Historico
- `DIAGRAMA_SISTEMA.md` - Diagramas de arquitetura
- `CONTRIBUTING.md` - Guia de contribuicao
- `CHANGELOG.md` - Historico de mudancas

## Regras

- Nao criar `.md` na raiz do repositorio, exceto `README.md` e `CHANGELOG.md`
- Sempre referenciar instalacao/update/desinstalacao via scripts em `install/`
- Scripts de apoio devem ficar em `Scripts/`
- Usa pnpm como gerenciador de pacotes (monorepo workspace)
