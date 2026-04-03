# Scripts auxiliares

Organizacao da pasta `Scripts/`:

- `tests/` -> scripts de teste manual
- `docs/` -> scripts utilitarios extraidos da documentacao
- `docs2/` -> scripts legados mantidos para referencia
- `documentacoes/` -> scripts de operacao e diagnostico
- `root/` -> scripts que estavam na raiz

Importante:
- Scripts oficiais de instalacao, update e desinstalacao ficam em `install/`.
- Use `install/install.sh`, `install/update.sh` e `install/uninstall.sh` como fluxo padrao.

Contrato operacional da app:

- `Scripts/deploy.sh` concentra o deploy da plataforma
- o instalador/orquestrador deve chamar apenas:
  - `preflight`
  - `full`
  - `start-validation`
  - `health`
  - `stop-validation`
  - `activate`
  - `published-health`
  - `version`
- o script deve rodar sempre em uma release temporaria, nunca diretamente no source repo e nunca no runtime publicado antes do `promote`
