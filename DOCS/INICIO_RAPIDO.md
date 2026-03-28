# Inicio Rapido

Guia direto para subir e operar o sistema usando os scripts oficiais.

## 1. Instalacao

```bash
sudo bash install/install.sh install -d dominio.com.br -e email@dominio.com -u gorinformatica
```

Ou interativo:

```bash
sudo bash install/install.sh install
```

## 2. Validacao basica

```bash
bash install/check.sh
```

## 3. Atualizacao

```bash
sudo bash install/install.sh update
```

Ou por branch especifica:

```bash
sudo bash install/install.sh update main
```

## 4. Desinstalacao

```bash
sudo bash install/uninstall.sh
```

## Desenvolvimento Local

```bash
# Instalar dependencias
pnpm install:all

# Iniciar backend e frontend
pnpm dev:backend
pnpm dev:frontend
```

## Referencias

- Guia completo do instalador: `install/README-INSTALADOR.md`
- Troubleshooting: `install/TROUBLESHOOTING.md`
- Documentacao geral: `INDICE_DOCUMENTACAO.md`
- Comandos uteis: `COMANDOS_UTEIS.md`
