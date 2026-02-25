# Guia para limpar e reinstalar

Use este fluxo quando quiser reinstalar com dominio novo.

## 1. Clonar instalador (se ainda nao existir)

```bash
git clone https://github.com/gorinformaticadev/install-multitenant.git install
cd install
```

## 2. Desinstalar aplicacao atual

```bash
sudo bash install.sh uninstall
```

## 3. Instalar novamente

```bash
sudo bash install.sh install -d NOVO_DOMINIO -e SEU_EMAIL -u gorinformatica
```

Observacoes:

- O comando de uninstall remove a aplicacao e servicos do sistema.
- A pasta do instalador `install/` e preservada.

