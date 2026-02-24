# Sistema Menu Multitenant Seguro

Plataforma SaaS multitenant com backend NestJS, frontend Next.js e foco em isolamento de dados, seguranca operacional e deploy previsivel.

## Novo formato de instalacao

O instalador oficial agora fica em repositorio separado:

- Aplicacao: `Projeto-menu-multitenant-seguro` (este repositorio)
- Instalador: `https://github.com/gorinformaticadev/install-multitenant.git`

## Fluxo oficial

1. Clonar instalador:

```bash
git clone https://github.com/gorinformaticadev/install-multitenant.git install
cd install
```

2. Instalar:

```bash
sudo bash install.sh install -d crm.example.com.br -e seuemail@email.com -u gorinformatica
```

3. Atualizar:

```bash
sudo bash install.sh update
```

4. Desinstalar:

```bash
sudo bash install.sh uninstall
```

Observacoes:

- O instalador clona automaticamente a aplicacao e executa o fluxo de instalacao selecionado.
- O uninstall remove aplicacao/servicos, mas preserva a pasta do instalador.

## Estrutura deste repositorio

```text
apps/
  backend/      -> API NestJS
  frontend/     -> Aplicacao Next.js

DOCS/           -> Documentacao tecnica e operacional
Scripts/        -> Scripts auxiliares e testes manuais
```

## Manuais de instalacao

- `DOCS/INICIO_RAPIDO.md`
- `DOCS/install/README-INSTALADOR.md`
- `DOCS/install/TROUBLESHOOTING.md`
- `DOCS/INDICE_DOCUMENTACAO.md`

## Licenca

AGPL-3.0 (`LICENSE`)

