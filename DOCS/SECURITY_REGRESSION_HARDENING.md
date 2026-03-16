# Hardening de Regressão de Segurança

Este documento define guardrails permanentes para impedir regressão da arquitetura de segurança validada no backend.

## Invariantes obrigatórias

1. Fonte de verdade runtime de segurança: `SecurityRuntimeConfigService` lendo `security_config`.
2. Rate limit global e crítico: enforcement dinâmico no backend, sem conflito com `@Throttle` estático em rotas críticas.
3. Redis strict mode: em produção, falha explícita quando storage compartilhado estiver indisponível.
4. Sessão stateful: JWT com `sid` + validação no ledger (`UserSession`) + expiração por inatividade.
5. Refresh token: rotação transacional com validação de sessão ativa/revogada.
6. Seed/bootstrap: sem senha fraca hardcoded e com remediação de legado inseguro.

## Guardrails implementados

- Testes de regressão de arquitetura e endpoints críticos:
  - `src/security-regression/security-architecture.regression.spec.ts`
  - `src/security-regression/critical-endpoints.regression.spec.ts`
  - `src/core/security-config/security-runtime-config.service.spec.ts`
- Script estático de guardrails:
  - `scripts/tests/security-regression-guardrails.js`
- Pipeline CI com etapa explícita de segurança:
  - `security:guardrails`
  - `test:security-regression`

## Política para novos endpoints críticos

Qualquer endpoint mutável de backup/restore/update em controladores administrativos deve:

1. Ser classificado explicitamente como crítico ou não-crítico.
2. Se crítico, usar `@CriticalRateLimit('backup' | 'restore' | 'update')`.
3. Não usar `@Throttle(...)` estático concorrente na mesma rota crítica.
4. Passar nos testes de regressão (falha automática quando rota mutável nova não está classificada).

## Execução local recomendada

```bash
pnpm -C apps/backend run security:guardrails
pnpm -C apps/backend run test:security-regression
```

## Critério de bloqueio de merge

PR que altera auth/sessão/throttling/security-config/seeds/rotas administrativas deve ser bloqueado se:

- qualquer guardrail falhar;
- checklist de segurança do PR não estiver completo;
- não houver evidência de execução dos testes de regressão.
