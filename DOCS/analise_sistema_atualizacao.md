# Análise do Sistema de Versão e Atualização

Este documento apresenta uma análise técnica detalhada do sistema de versionamento e do módulo de atualizações automáticas, conforme solicitado.

## 1. Divergência de Versão (TopBar vs. Configurações)

### O Problema
Foi identificado que a versão exibida no menu de usuário (TopBar) está correta, mas a versão mostrada em `/configuracoes/sistema/updates` não corresponde à realidade, especialmente após atualizações via instalador manual.

### Causa Técnica
O sistema utiliza duas fontes de verdade diferentes para exibir a versão atual:

1.  **TopBar:** Utiliza o endpoint `/api/system/version`, que executa a função `resolveAppVersionTag()`. Esta função busca a versão de forma dinâmica na seguinte ordem de prioridade:
    *   Variável de ambiente `APP_VERSION`.
    *   `package.json` na raiz do projeto.
    *   `package.json` do backend.
    *   **Resultado:** Reflete sempre a versão real dos arquivos presentes no disco ou no container.

2.  **Página de Updates:** Utiliza o endpoint `/api/update/status`, que consulta a tabela `system_settings` no banco de dados (Prisma).
    *   **Resultado:** Caso o sistema tenha sido atualizado via script externo (`install/install.sh` ou `install/update.sh`), esses scripts atualizam o código e as imagens Docker, mas **não atualizam o registro no banco de dados**.

### Veredito
Sim, existe um "erro" de sincronização. A atualização via instalador ignora o registro persistente de versão no banco de dados, fazendo com que a interface de gerenciamento de updates pareça estar em uma versão anterior.

---

## 2. Análise da Função de Atualização

### Preparação para Modo Native vs. Docker
A análise do serviço `UpdateService` e dos DTOs revelou o seguinte:

*   **Padrão Docker:** O sistema está **fortemente acoplado ao Docker**. A função `executeUpdate` no backend ignora o parâmetro `packageManager` enviado pelo frontend e executa internamente o script `install/update-images.sh`.
*   **Modo Native:** Embora o frontend e o banco de dados permitam selecionar `npm`, `pnpm` ou `yarn`, o backend **não possui lógica implementada** para realizar atualizações em instalações nativas (bare-metal) de forma automática.
*   **Comentário no Código:** No arquivo `update.dto.ts`, há um comentário explícito confirmando que o valor de `packageManager` é ignorado pelo backend para garantir um fluxo Docker controlado.

### Fluxo de Atualização atual (Web UI)
1.  Verifica novas tags no Git (via `git ls-remote`).
2.  Cria um log de atualização no banco.
3.  Invoca `bash install/update-images.sh`.
4.  O script Docker realiza o pull das novas imagens, executa migrations e reinicia os containers com healthcheck.
5.  Em caso de falha, o script Docker realiza rollback automático para a imagem anterior.

---

## 3. Pontos de Melhoria e Riscos

### Riscos Identificados
*   **Isolamento de Tenant:** O processo de atualização é global (afeta todos os tenants simultaneamente). Não há risco de "escrape de tenant", mas o downtime (mesmo que curto) afeta a todos de forma igual.
*   **Inconsistência de Versão:** A falha do instalador manual em atualizar o banco de dados pode levar o administrador a tentar "re-atualizar" via interface Web uma versão que já está aplicada, o que pode causar conflitos ou bugs de migração se não houver idempotência rigorosa em todos os níveis.

### Recomendações
1.  **Sincronização no Start:** O backend, ao iniciar, poderia verificar se a versão no `package.json` é superior à versão na tabela `SystemSettings` e atualizar o banco automaticamente.
2.  **Scripts de Instalação:** Adicionar um comando nos scripts `.sh` para atualizar o registro de versão no banco de dados via Prisma CLI ou chamada de API interna após o deploy bem-sucedido.
3.  **Suporte Native:** Se o suporte nativo for um requisito crítico, será necessário criar um script equivalente ao `update-images.sh` que utilize `pnpm install && pnpm build && pm2 restart` em vez de comandos Docker.

---

## Conclusão
O sistema é robusto no fluxo Docker, mas apresenta uma falha de sincronização de dados (UI vs DB) quando operado fora da interface Web. Ele **não está preparado para atualizações nativas automáticas** via interface, sendo necessário o uso dos scripts manuais para esse fim.
