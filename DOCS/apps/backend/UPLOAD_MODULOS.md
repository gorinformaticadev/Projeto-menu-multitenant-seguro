# Upload de Modulos com Dependencias NPM

Este documento define o fluxo oficial de instalacao de modulos com suporte a `npmDependencies`, mantendo o campo `dependencies` como dependencia entre modulos.

## Estrutura obrigatoria do `module.json`

```json
{
  "name": "crm-whatsapp",
  "displayName": "CRM WhatsApp",
  "version": "1.0.0",
  "dependencies": ["core-crm", "notificacoes"],
  "npmDependencies": {
    "backend": {
      "axios": "^1.7.2",
      "zod": "^3.23.8"
    },
    "frontend": {
      "@tanstack/react-query": "^5.59.0",
      "react-hook-form": "^7.53.0"
    }
  }
}
```

### Semantica dos campos

- `dependencies`: dependencia entre modulos.
- `npmDependencies.backend`: pacotes para `apps/backend/package.json`.
- `npmDependencies.frontend`: pacotes para `apps/frontend/package.json`.

## Politica de seguranca para NPM

### Bloqueado automaticamente

- `latest`
- `*`
- prefixos: `github:`, `git:`, `git+`, `file:`, `link:`, `workspace:`, `http:`, `https:`

### Permitido

- nomes validos de pacote NPM.
- versoes semver seguras: `^x.y.z`, `~x.y.z`, `x.y.z`.

Ao encontrar valor invalido:

- instalacao interrompida com erro `MODULE_DEPENDENCY_VALIDATION_FAILED`.
- modulo nao e instalado/ativado.

## Fluxo de instalacao

1. Upload do ZIP.
2. Leitura e validacao de `module.json`.
3. Validacao de `npmDependencies`.
4. Registro do modulo com status `uploaded`.
5. Transicao para `pending_dependencies`.
6. Registro em `module_npm_dependencies`.
7. Deteccao de conflitos de versao com `apps/backend/package.json` e `apps/frontend/package.json`.
8. Merge controlado em `dependencies` dos dois `package.json`.
9. Execucao de `pnpm install --no-frozen-lockfile` na raiz do workspace.
10. Se sucesso, dependencias ficam `installed` e modulo vai para `dependencies_installed`.
11. Se conflito, modulo vai para `dependency_conflict` (ativacao bloqueada).
12. Preparacao de banco (`prepare-database`) muda para `ready`.
13. Ativacao global muda para `active`.

## Estados de modulo

- `uploaded`
- `pending_dependencies`
- `dependencies_installed`
- `dependency_conflict`
- `ready`
- `active`

Estados legados (`installed`, `db_ready`, `detected`, `disabled`) continuam aceitos para retrocompatibilidade.

## Persistencia e auditoria

Tabela: `module_npm_dependencies`

Campos principais:

- `moduleId`
- `moduleSlug`
- `packageName`
- `version`
- `target` (`backend` | `frontend`)
- `status` (`pending` | `installed` | `conflict`)
- `createdBy`
- `installedAt`
- `note`

Eventos de auditoria relevantes:

- `MODULE_UPLOAD`
- `MODULE_DEPENDENCY_CONFLICT`
- `MODULE_DEPENDENCY_INSTALL_STARTED`
- `MODULE_DEPENDENCY_INSTALL_SUCCESS`
- `MODULE_DEPENDENCY_INSTALL_FAILED`

## Conflitos de versao

Quando modulo solicita versao incompativel com o projeto:

- dependencia recebe status `conflict`.
- modulo recebe status `dependency_conflict`.
- ativacao e preparo de banco ficam bloqueados ate resolucao.

Erro esperado:

- `MODULE_DEPENDENCY_CONFLICT`

## Rollback de instalacao

Se `pnpm install` falhar:

- `apps/backend/package.json` e `apps/frontend/package.json` sao restaurados por snapshot.
- `pnpm-lock.yaml` e restaurado por snapshot.
- notas de falha sao registradas em `module_npm_dependencies`.
- modulo permanece bloqueado para nova tentativa controlada.

## Escopo de escrita

Somente estes arquivos sao alterados automaticamente:

- `apps/backend/package.json`
- `apps/frontend/package.json`
- `pnpm-lock.yaml` (indiretamente pelo `pnpm install`)

Nunca alteramos manualmente:

- `package.json` da raiz
- `pnpm-lock.yaml` por escrita direta
