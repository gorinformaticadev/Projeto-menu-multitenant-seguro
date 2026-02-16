# Arquitetura de Instalação de Módulos e Desafios em Docker

Este documento explica detalhadamente como funciona a instalação de módulos em ambientes Dockerizados, os problemas encontrados com builds de Frontend (Next.js) e Backend (NestJS), e as soluções arquiteturais necessárias.

## 1. O Problema Fundamental: Imutabilidade vs Dinamicidade

Em arquiteturas baseadas em containers (Docker), o princípio fundamental é a **imutabilidade**.
- Uma imagem Docker é construída ("buildada") uma vez e deve rodar exatamente igual em qualquer lugar.
- O código-fonte é compilado/transpilado durante o processo de build da imagem.
- **Em produção, não existe compilador rodando** (geralmente). O código é estático.

### O Conflito com Instalação de Módulos via Upload
A funcionalidade de "Upload de Módulo (.zip)" tenta injetar código novo (arquivos `.ts`, `.tsx`, `.css`) em uma aplicação que JÁ ESTÁ RODANDO e JÁ FOI COMPILADA.

Isso gera dois problemas principais:
1.  **Backend (NestJS)**: O código roda a partir da pasta `dist/` (compilada). Injetar um arquivo `.ts` na pasta `src/` não faz ele entrar em execução automaticamente. O NestJS precisa recompilar (build) para entender esse arquivo novo.
2.  **Frontend (Next.js)**: O problema é ainda pior. O Next.js gera bundles otimizados de JavaScript/HTML/CSS no build. Se você colocar um arquivo `page.tsx` novo na pasta, o servidor Next.js em produção (que roda `next start`) **ignora completamente** esse arquivo, pois ele só serve o que estava na pasta `.next` no momento do build.

---

## 2. Cenário Atual (Docker Production)

### Backend (NestJS)
- **Estado**: Rodando via `node dist/main`.
- **O que acontece no Upload**:
    - O instalador recebe o `.zip`.
    - Extrai os arquivos para `/app/src/modules/...` (código fonte).
    - **Resultado**: O código fonte (`.ts`) está lá, mas o Node.js está executando o JavaScript antigo da pasta `dist/`. O novo módulo **não é carregado** na memória.
    - **Correção "Gambiarra"**: Se houver mapeamento de volume e o container reiniciar, e o `entrypoint` fizer um rebuild antes de rodar, funcionaria. Mas restartar container em produção é downtime.

### Frontend (Next.js)
- **Estado**: Rodando via `next start` (servidor de produção otimizado).
- **O que acontece no Upload**:
    - O backend tenta escrever arquivos na pasta do frontend (`../frontend/src/...`).
    - **Erro 1 (Permissão)**: O container do backend geralmente não tem permissão de escrita no volume do frontend, ou os volumes nem estão compartilhados. Isso gera erros `EACCES` ou "Directory not found".
    - **Erro 2 (Build)**: Mesmo se conseguisse escrever o arquivo `.tsx`, o Next.js em modo produção **NÃO OBSERVA** mudanças em arquivos. Ele não recompila. A nova rota (ex: `/dashboard/ordem-servico`) simplesmente retorna **404**.

---

## 3. Soluções e Arquitetura Necessária

Para ter um sistema de módulos dinâmicos real em Docker, você precisa de uma das seguintes abordagens. A **Abordagem B** é a mais profissional (CI/CD).

### Abordagem A: Instalação em Desenvolvimento (Recomendada para Estabilidade)
Neste modelo, "Instalar Módulo" via interface web serve apenas para **ativar** funcionalidades (banco de dados, menus, feature flags) de módulos que **já estão no código**, mas inativos.

**Fluxo:**
1.  Dev baixa o `.zip` no ambiente local.
2.  Extrai para `apps/backend/src/modules` e `apps/frontend/src/app/modules`.
3.  Testa localmente.
4.  Faz `git commit` e `git push`.
5.  Servidor de Produção faz `git pull` e `docker compose up -d --build`.
    - O build do Docker recompila o Backend e o Frontend com o novo código.
6.  Admin acessa o painel e clica em "Ativar" (apenas roda migrations e libera menus).

### Abordagem B: Pipeline de CI/CD (Automatização Profissional)
O upload do ZIP dispara um gatilho em um servidor de Build (GitHub Actions, Jenkins, Portainer).

**Fluxo:**
1.  Upload do `.zip` via API.
2.  Backend salva o arquivo em um storage (S3/MinIO) ou repositório Git.
3.  Backend aciona um Webhook de Deploy.
4.  O processo de Deploy:
    - Baixa o código atual.
    - Descompacta o módulo nas pastas corretas.
    - Roda `npm run build` do Backend.
    - Roda `npm run build` do Frontend.
    - Cria novas imagens Docker.
    - Substitui os containers (Rolling Update).
5.  O sistema volta com o módulo instalado.

### Abordagem C: Volumes Dinâmicos e Rebuild em Runtime (Lenta e Insegura - "WordPress Style")
Tenta imitar como PHP/WordPress funcionam, onde jogar um arquivo `.php` já o coloca no ar.

**Necessário no `docker-compose.prod.yml`:**
1.  **Volumes Compartilhados**: Host mapeado para dentro dos containers (`./apps/frontend:/app`).
2.  **Modo Dev em Produção**: Rodar o frontend com `npm run dev` (muito lento, consome muita memória) ou usar um processo watcher que dispara `next build` automaticamente (downtime alto).
3.  **Backend com Watch**: Rodar com `npm run start:dev` (inseguro para prod).

**Por que não fazer a Abordagem C?**
- **Performance**: `npm run dev` é 10x mais lento que `npm start`.
- **Segurança**: Código fonte exposto e alterável em tempo de execução.
- **Estabilidade**: Um erro de sintaxe num arquivo novo derruba o site inteiro.

---

## 4. O Que Aconteceu no Seu Caso Específico?

1.  **Upload Backend**: O ZIP foi recebido e descompactado em `/app/src/modules`. O backend "achou" que instalou.
    - **Migrations**: Funcionaram porque o script lê os arquivos `.sql` direto do disco, não precisa compilar.
    - **Lógica**: Se o código `.ts` novo não foi compilado para `.js` na pasta `dist`, a lógica do controller/service novo **não está rodando**. Só as migrations rodaram.

2.  **Upload Frontend**: Falhou silenciosamente (depois da nossa correção de logs).
    - Os arquivos `.tsx` **não foram escritos** no volume do frontend.
    - O container Frontend continua servindo a versão antiga do site.
    - **Resultado**: Os menus aparecem (banco de dados), mas clicá-los leva a lugar nenhum ou 404.

## 5. Resumo da Ação Recomendada

Para produção, **esqueça o upload de código (.zip) via interface web** se você não tiver um pipeline de CI/CD complexo por trás.

**Use o fluxo de desenvolvimento:**
1.  Adicione o módulo no seu repositório Git.
2.  Faça o deploy (rebuild) dos containers.
3.  Use a interface web apenas para **Ativação e Configuração** (rodar migrations, definir permissões).
