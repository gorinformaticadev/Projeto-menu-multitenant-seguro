# SKILL — Auditoria Automática

## Objetivo
Executar auditoria técnica objetiva e reprodutível antes de commit, push, PR, release ou conclusão de tarefa.

Esta skill existe para impedir que mudanças sejam dadas como concluídas sem evidência real.

Ela deve ser usada sempre que:
- houver alteração de código;
- houver alteração de build/runtime/deploy;
- houver alteração de dependências;
- houver alteração em scripts;
- houver alteração em backend, frontend ou fluxo de módulo;
- houver dúvida se a mudança está compatível com o CI/CD.

---

## Regra central
Nunca afirmar que algo está corrigido, validado ou pronto sem executar verificações reais.

Não gerar relatório baseado apenas em leitura de código.
Não tratar “compila em uma parte” como “pipeline inteiro está saudável”.
Não omitir falhas, warnings relevantes ou validações não executadas.

---

## Escopo da auditoria
A auditoria deve cobrir, conforme a natureza da mudança:

1. integridade do workspace;
2. dependências;
3. lint;
4. typecheck;
5. build;
6. testes;
7. scripts;
8. docker/compose;
9. contratos de runtime;
10. impacto em módulos;
11. aderência ao workflow Git e CI/CD.

---

## Processo obrigatório

### Etapa 1 — Entender o escopo da mudança
Antes de rodar verificações, identificar:

- quais arquivos foram alterados;
- se a mudança afeta backend, frontend, scripts, docker, update, auth, módulos ou tema;
- se a mudança exige auditoria parcial ou completa.

Nunca rodar validação aleatória sem relacionar ao escopo.

---

### Etapa 2 — Inspeção mínima obrigatória
Ler, quando existirem:

- `package.json`
- `pnpm-workspace.yaml`
- `apps/backend/package.json`
- `apps/frontend/package.json`
- `docker-compose.yml`
- `docker-compose.prod.yml`
- `docker-compose.override.yml`
- scripts em `install/`
- scripts em `package.json`
- workflow(s) em `.github/workflows/`
- configuração de PM2, quando houver
- arquivos diretamente ligados à mudança

Objetivo:
entender o que o CI exige de verdade.
Nunca assumir que o pipeline roda só lint e build sem confirmar.

---

### Etapa 3 — Auditoria de dependências
Verificar:

- dependências faltantes;
- dependências declaradas e não utilizadas;
- imports quebrados;
- dependências implícitas não documentadas;
- dependências de módulo não documentadas;
- warnings relevantes de deprecated, peer conflict ou resolução inconsistente;
- compatibilidade com o build do projeto e do CI.

Se a tarefa tocar módulo:
- verificar se o módulo possui documento próprio de dependências;
- se não possuir, apontar como falha estrutural;
- não esconder esse problema.

---

### Etapa 4 — Auditoria do workspace
Validar se o monorepo continua íntegro:

- resolução do workspace PNPM;
- scripts do root;
- scripts do backend;
- scripts do frontend;
- filtros PNPM usados pelo CI;
- referências quebradas entre pacotes e apps.

Não assumir que `pnpm install` local equivale ao ambiente do pipeline.
Se houver risco de diferença, declarar.

---

### Etapa 5 — Auditoria de lint e typecheck
Executar o que existir e fizer sentido:

- lint do root;
- lint do backend;
- lint do frontend;
- typecheck do backend;
- typecheck do frontend.

Regras:
- separar error de warning;
- não maquiar warning relevante;
- apontar warning repetitivo/estrutural se ele impactar manutenção ou CI;
- se o CI falha com warning, tratar warning como bloqueador.

Nunca resumir “sem erros graves” se ainda houver problema relevante.

---

### Etapa 6 — Auditoria de build
Executar o build real da área alterada.

Quando aplicável:
- build do backend;
- build do frontend;
- build do workspace;
- validação do output standalone do frontend;
- validação de artefatos usados por runtime.

Se a mudança tocar frontend/runtime:
verificar explicitamente se o build não reintroduz:
- porta errada;
- output incorreto;
- caminho incorreto do standalone;
- erro de import/client component;
- falhas conhecidas de runtime.

---

### Etapa 7 — Auditoria de testes
Executar os testes existentes relevantes para a área alterada.

Prioridade:
1. testes diretamente relacionados;
2. suíte da app afetada;
3. suíte ampliada quando a mudança tocar auth, tenant, update, runtime ou módulo.

Não dizer “testado” se só houve build.
Build não substitui teste.

Se não houver testes:
- declarar explicitamente;
- classificar o risco.

---

### Etapa 8 — Auditoria de scripts e CI/CD
Verificar se a mudança impacta:

- scripts do `package.json`;
- scripts em `install/`;
- scripts de update/rollback;
- comandos usados nos workflows do GitHub;
- contratos do pipeline.

Ler os workflows em `.github/workflows/` quando a tarefa puder afetar CI/CD.

Validar especialmente:
- ordem de etapas;
- filtros e paths;
- comandos reais executados;
- dependência de ambiente;
- diferenças entre local e pipeline.

Não supor o comportamento do GitHub Actions sem ler o workflow.

---

### Etapa 9 — Auditoria de Docker, PM2 e runtime
Se a mudança tocar deploy, build, runtime, update, frontend standalone, Nginx ou scripts operacionais, validar explicitamente:

- backend continua em `4000`;
- frontend continua em `5000`;
- frontend standalone correto:
  `node .next/standalone/apps/frontend/server.js`
- PM2 usa `PORT=5000`
- PM2 usa `HOSTNAME=0.0.0.0`
- nada reintroduziu uso de `3000` em produção;
- compose continua sintaticamente válido;
- contratos de Nginx/PM2/Docker não foram quebrados.

Não aceitar “build passou” como prova de deploy correto.

---

### Etapa 10 — Auditoria de módulos
Se a mudança tocar módulo, aplicar obrigatoriamente:

- não tratar `apps/frontend/src/app/modules` e `apps/backend/src/modules` como fonte principal do módulo;
- verificar se a alteração foi pensada para o repositório real do módulo;
- verificar se a mudança cria divergência entre módulo instalado e módulo versionado;
- verificar se o módulo possui documento de dependências;
- verificar se a solução depende de hack no core.

Se a solução só funciona alterando módulo instalado dentro do core, considerar a solução incorreta.

---

### Etapa 11 — Auditoria de segurança estrutural
Se a mudança tocar backend, auth, sessão, guards, WebSocket, Prisma, throttling, cron ou update, verificar:

- tenant isolation preservado;
- auth não foi relaxada;
- logout continua limpando cookies;
- trusted devices/2FA não quebraram;
- HTTP e WebSocket continuam equivalentes em validação;
- throttling não caiu indevidamente para IP;
- cron/watchdog não ganharam simplificação perigosa;
- update/maintenance/rollback continuam respeitando o fluxo real.

---

## Regras de severidade

### Bloqueador
Impede conclusão da tarefa:
- erro de build;
- erro de typecheck;
- erro de lint quando o CI bloqueia;
- teste falhando na área alterada;
- quebra de contrato de runtime;
- divergência módulo/core;
- dependência ausente;
- workflow do CI afetado sem validação;
- auth/multitenancy em risco;
- encoding pt-BR quebrado em resposta ou documentação entregue.

### Alto
Pode permitir entrega parcial, mas deve ser explicitado:
- warnings deprecados relevantes;
- falta de teste automatizado em área crítica;
- documentação de dependências do módulo ausente;
- validação parcial por limitação de ambiente;
- inconsistência entre local e pipeline ainda não comprovada.

### Médio
Registrar, mas não bloquear sozinho:
- warning não bloqueante sem efeito aparente no CI;
- oportunidade de limpeza técnica fora do escopo;
- melhoria de script sem urgência.

---

## Proibições
É proibido:

- fingir execução;
- dizer que “está tudo certo” sem comandos reais;
- esconder warnings relevantes;
- resumir saída longa de forma enganosa;
- tratar hipótese como validação;
- ignorar `.github/workflows/` quando a mudança puder afetar pipeline;
- ignorar dependências de módulo;
- concluir auditoria sem separar claramente o que foi e o que não foi validado.

---

## Saída obrigatória da auditoria
Toda auditoria deve ser reportada neste formato:

## 1. Escopo auditado
- quais áreas foram alteradas
- que tipo de auditoria foi necessária

## 2. Verificações executadas
- comandos executados
- arquivos/flows inspecionados
- workflows lidos, se aplicável

## 3. Resultado por categoria
- dependências
- lint
- typecheck
- build
- testes
- scripts
- CI/CD
- runtime/deploy
- módulos

## 4. Falhas encontradas
- bloqueadores
- altas
- médias

## 5. Conclusão objetiva
Escolher apenas uma:
- aprovado
- aprovado com ressalvas
- reprovado

## 6. Pendências
- o que falta executar
- o que precisa ser corrigido antes de merge/push/release

---

## Critérios de reprovação automática da auditoria
A auditoria é inválida se:

- não ler o workflow quando a mudança afeta CI/CD;
- não verificar build da área alterada;
- não separar fato de hipótese;
- ignorar contratos de porta/runtime;
- ignorar regra de módulo externo;
- ignorar documentação de dependências do módulo;
- responder em português com acentuação/encoding quebrados;
- afirmar aprovação sem evidência suficiente.

---

## Conduta em caso de limitação de ambiente
Se não for possível executar algo:
- declarar exatamente o que não foi possível;
- explicar por quê;
- classificar o risco;
- não mascarar a limitação.

Exemplo de conduta correta:
- “Build do frontend executado com sucesso.”
- “Testes e2e não puderam ser executados porque o ambiente local não possui X.”
- “CI ainda não foi comprovado porque o workflow Y depende de condição Z.”

Exemplo de conduta incorreta:
- “Parece estar tudo certo.”
- “Provavelmente passa no pipeline.”
- “Deve funcionar em produção.”

---

## Uso recomendado com Git workflow
Antes de:
- commit final,
- push,
- PR,
- tag,
- release,
- conclusão de correção,

executar esta skill ou uma versão proporcional ao escopo.

Mudança sem auditoria proporcional é entrega incompleta.