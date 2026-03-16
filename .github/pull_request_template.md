## Resumo

Descreva brevemente o objetivo e o impacto deste PR.

## Checklist de Qualidade

- [ ] backend build/lint/test ok
- [ ] frontend build/lint ok
- [ ] scripts bash -n/shellcheck ok
- [ ] smoke tests ok
- [ ] security:guardrails ok
- [ ] test:security-regression ok
- [ ] docs atualizadas (se aplicavel)
- [ ] VERSION / BUILD_INFO consistentes (se aplicavel)

## Checklist de Segurança (Obrigatório para auth/sessão/throttling/security-config/seeds/admin routes)

- [ ] nenhuma rota crítica nova foi adicionada sem classificação explícita (crítica x não-crítica)
- [ ] rotas críticas de backup/restore/update usam `@CriticalRateLimit(...)`
- [ ] nenhum `@Throttle(...)` estático conflita com rota crítica
- [ ] `SecurityRuntimeConfigService` continua sendo a fonte runtime de políticas de segurança
- [ ] refresh token continua validando sessão ativa/revogada/inativa antes de emitir novo token
- [ ] sessão revogada/inativa continua inválida em multi-instância
- [ ] seed/bootstrap não introduz credencial fraca hardcoded e mantém remediação de legado inseguro

## Evidências

Inclua comandos executados e/ou links de logs de CI.
