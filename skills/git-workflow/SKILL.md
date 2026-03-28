# SKILL — Git Workflow

## Objetivo
Garantir que qualquer alteração seja segura, rastreável e compatível com CI/CD.

---

## Regras obrigatórias

### Branch
- nunca usar main diretamente
- criar branch:
  fix/*
  feat/*
  chore/*
  refactor/*

---

### Commits
- um propósito por commit
- não misturar backend + frontend + infra

---

### PR
Sempre conter:

- diagnóstico
- o que mudou
- impacto
- como testar

---
### Antes do push ou PR
Executar auditoria automática proporcional ao escopo usando:
- `skills/auto-audit/SKILL.md`

Sem auditoria, a entrega não deve ser considerada pronta.

### Antes do push

Rodar:

pnpm install
pnpm lint
pnpm build

Se existir:
pnpm test

---

### CI/CD

A mudança NÃO pode:

- quebrar build
- quebrar scripts
- quebrar docker

---

## Erros críticos

- commit gigante
- PR sem validação
- quebra de pipeline