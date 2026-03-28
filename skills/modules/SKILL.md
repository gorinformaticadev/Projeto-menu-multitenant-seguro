# SKILL — Módulos

## Regra central
Módulo NÃO é parte do monorepo.

---

## O que NÃO fazer

- alterar apenas em apps/.../modules
- tratar módulo como código interno

---

## Fluxo correto

1. identificar módulo
2. considerar repo externo
3. aplicar mudança no módulo
4. sincronizar

---

## Dependências

Módulo deve ter:

- lista de dependências
- versão
- requisitos

---

## Falhas graves

- divergência entre módulo e core
- dependência não documentada