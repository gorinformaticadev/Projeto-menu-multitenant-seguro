# Implementação do Modo Native (`install.sh`)

## Objetivo
Implementar no instalador `install/install.sh` um fluxo de instalação `native` equivalente ao fluxo Docker já funcional, mantendo a sequência definida e alterando a ordem apenas quando tecnicamente necessário para evitar falhas.

## Escopo
- Incluir execução de instalação sem Docker quando selecionado `Native`.
- Preservar fluxo Docker atual sem regressões.
- Reaproveitar variáveis e regras já usadas no modo Docker (`install/.env.production`).

## Premissas
- Sistema alvo Ubuntu/Debian com `sudo`/root.
- Instalação executada via `sudo bash install.sh install ...`.
- Domínio apontado para o servidor.
- PM2 e serviços rodarão com usuário `multitenant` (privilégio mínimo necessário).
- Comandos que exigem root devem elevar privilégio durante a execução (ex.: `sudo su - root -c "<comando>"`).
- O usuário `multitenant` não recebe `sudo` por padrão; apenas permissões de dono dos arquivos da aplicação.

## Sequência de Implementação (mantida)
1. Criar/atualizar usuário `multitenant` com senha definida no instalador.
2. Ajustar permissões de diretórios e usuário para execução da aplicação.
3. Atualizar sistema (`apt update/upgrade`, autoremove) e normalizar regras de portas (80/443).
4. Instalar/configurar UFW (deny incoming, allow outgoing, liberar ssh/22/80/443, enable).
5. Setar timezone `America/Sao_Paulo`.
6. Instalar Node.js conforme projeto (Node 20).
7. Instalar dependências globais necessárias e PM2.
8. Instalar `snapd` e atualizar core.
9. Instalar Nginx e remover site default.
10. Configurar Nginx nativo (proxy reverso de frontend/backend, `/api`, `/uploads`, `/socket.io`).
11. Instalar dependências do monorepo (`pnpm install`).
12. Instalar Certbot via snap (método prioritário solicitado).
13. Build backend/frontend + compilação do seed (`dist/prisma/seed.js`) e artefatos (`dist/main.js`).
14. Instalar e configurar banco (PostgreSQL) com credenciais no padrão do modo Docker.
15. Criar `.env` e `.env.local` a partir dos exemplos e sobrescrever variáveis de produção.
16. Ajustar dados de seed (admin email/senha via `INSTALL_ADMIN_EMAIL` e `INSTALL_ADMIN_PASSWORD`).
17. Executar `prisma migrate deploy` e seed.
18. Iniciar backend/frontend no PM2 com nomes por instância.
19. Validar e aplicar proxy reverso Nginx final para modo nativo.
20. Reiniciar backend/frontend e aguardar subida.
21. Gerar certificado TLS com Certbot para domínio único.
22. Garantir firewall ativo ao final.
23. Exibir relatório final com credenciais/URLs/dados do banco.

## Ajustes mínimos necessários de ordem
- As checagens de Docker ficam apenas no fluxo Docker. No modo Native, não devem rodar.
- A configuração do Nginx (passo 10/19) é feita antes do Certbot para permitir validação HTTP-01.
- Build (passo 13) e geração de seed compilado são obrigatórios antes do passo 17.

## Mapeamento técnico no projeto atual
- Backend:
  - Build: `pnpm --filter backend build`
  - Seed compilado adicional: `pnpm --filter backend exec tsc prisma/seed.ts --outDir dist/prisma --skipLibCheck --module commonjs --target ES2021 --esModuleInterop --resolveJsonModule`
  - Migrate: `pnpm --filter backend exec prisma migrate deploy --schema prisma/schema.prisma`
  - Seed: `node dist/prisma/seed.js`
- Frontend:
  - Build: `pnpm --filter frontend build`
  - Start: `pnpm --filter frontend start` (porta 5000)
- PM2:
  - Backend: `pm2 start dist/main.js --name <instancia>-backend`
  - Frontend: `pm2 start pnpm --name <instancia>-frontend --filter frontend -- start`
- Nginx native:
  - Upstream frontend: `127.0.0.1:5000`
  - Upstream backend: `127.0.0.1:4000`
  - Rotas: `/`, `/api`, `/uploads`, `/socket.io`, `/.well-known/acme-challenge/`

## Saídas esperadas
- Novo fluxo `native` funcional no `install.sh`.
- Serviços backend/frontend em PM2 com startup persistido (`pm2 save` + startup).
- Nginx servindo domínio com proxy correto.
- Certificado SSL emitido e renovação automática via Certbot.
- Relatório final equivalente ao modo Docker.
