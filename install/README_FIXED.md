# Manual de Instalação Corrigido

Este instalador foi corrigido para automatizar a geração de chaves de segurança e resolver problemas de caminhos de diretório.

## Requisitos
- Servidor Ubuntu 22.04+
- Acesso Root

## Como instalar

1. Clone o repositório (se ainda não o fez):
```bash
git clone https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro.git
cd Projeto-menu-multitenant-seguro
```

2. Execute o instalador corrigido:
```bash
sudo bash install/setup_fixed.sh seu-dominio.com.br seu-email@exemplo.com
```

## O que foi corrigido:
- **Geração Automática**: `JWT_SECRET`, `ENCRYPTION_KEY`, `DB_USER`, `DB_PASSWORD` e `DB_NAME` agora são gerados automaticamente usando `openssl`.
- **Caminhos de Diretório**: Corrigido o erro `cd: multitenant-docker: No such file or directory`.
- **Contexto Docker**: Ajustado o `docker-compose.yml` para que o build do backend e frontend funcione corretamente no monorepo.
- **Nginx**: Adicionada verificação de existência do comando nginx antes de tentar configurar.
- **Persistência**: As variáveis são salvas no arquivo `.env` automaticamente.

## Acesso
Após a conclusão, os dados de acesso serão exibidos no terminal. Salve-os em local seguro.
