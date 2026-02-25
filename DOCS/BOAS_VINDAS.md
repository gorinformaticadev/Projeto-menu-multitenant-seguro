# Boas vindas

Este repositorio contem a aplicacao. O instalador oficial agora fica em repositorio separado.

## Estrutura

- `README.md` (raiz): resumo oficial
- `DOCS/`: documentacao tecnica e funcional
- `Scripts/`: scripts auxiliares

## Fluxo oficial de operacao

1. Clonar instalador:

```bash
git clone https://github.com/gorinformaticadev/install-multitenant.git install
cd install
```

2. Instalar:

```bash
sudo bash install.sh install -d app.empresa.com -e admin@empresa.com -u gorinformatica
```

3. Atualizar:

```bash
sudo bash install.sh update
```

4. Desinstalar:

```bash
sudo bash install.sh uninstall
```

## Leitura recomendada

- `DOCS/INICIO_RAPIDO.md`
- `DOCS/install/README-INSTALADOR.md`
- `DOCS/INDICE_DOCUMENTACAO.md`

