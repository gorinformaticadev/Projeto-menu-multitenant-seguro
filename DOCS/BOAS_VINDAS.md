# Boas Vindas ao Pluggor

Este repositorio usa uma estrutura padrao para documentacao e automacao.

## Estrutura que voce deve seguir

- `README.md` (raiz): resumo oficial do repositorio
- `DOCS/`: documentacao tecnica e funcional
- `Scripts/`: scripts auxiliares e testes manuais
- `install/`: scripts oficiais de ciclo de vida do sistema

## Fluxo oficial de operacao

### Instalar
```bash
sudo bash install/install.sh install
```

### Atualizar
```bash
sudo bash install/install.sh update
```

### Desinstalar
```bash
sudo bash install/uninstall.sh
```

### Desenvolvimento
```bash
pnpm install:all     # Instalar dependencias
pnpm dev:backend     # Iniciar backend
pnpm dev:frontend    # Iniciar frontend
```

## Proximas leituras

- `INDICE_DOCUMENTACAO.md`
- `install/README-INSTALADOR.md`
- `INICIO_RAPIDO.md`
