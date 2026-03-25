# THEME_REFACTOR_STATUS.md
# Estado da Refatoração de Temas — Continuar Daqui

> **Status:** EM PROGRESSO — Sessão interrompida em 2026-03-18  
> **Último commit:** `a1a8102` — `refacor(themas): Criação de gestor de temas`  
> **Stash ativo:** Sim — contém mudanças MISTAS (válidas + destrutivas, NÃO aplicar todo)

---

## ⚠️ ATENÇÃO ANTES DE QUALQUER COISA

Existe um `git stash` salvo. Ele contém **mudanças boas misturadas com um erro grave**:  
O script `scripts/migrate-colors.js` tinha um bug que **colapsou quebras de linha** de 299 arquivos em uma única linha cada, destruindo a formatação.

O `git stash` reverteu tudo. **NÃO faça `git stash pop`.**

---

## O Que Já Existe no Repositório (commit `a1a8102`)

- `apps/frontend/src/app/globals.css` — Adicionadas 3 classes de accent theme (`.theme-blue`, `.theme-emerald`, `.theme-violet`)
- `apps/frontend/src/components/ThemeToggle.tsx` — Atualizado
- `apps/frontend/src/components/operational-dashboard/OperationalDashboard.tsx` — Parcialmente ajustado
- `tmp/` — Scripts de auditoria (descartáveis)

## O Que Precisa Ser Adicionado (da sessão atual)

### 1. `apps/frontend/src/app/globals.css`

Adicionar dentro de `:root` após as variáveis existentes:
```css
/* Tokens Semânticos RGB — Light */
--color-background: 241 245 249;
--color-background-elevated: 248 250 252;
--color-surface: 255 255 255;
--color-surface-hover: 241 245 249;
--color-border: 226 232 240;
--color-border-strong: 148 163 184;
--color-text: 15 23 42;
--color-text-muted: 100 116 139;
--color-text-inverse: 255 255 255;
--color-primary: 37 99 235;
--color-primary-hover: 29 78 216;
--color-secondary: 241 245 249;
--color-success: 34 197 94;
--color-warning: 245 158 11;
--color-danger: 239 68 68;
--color-info: 14 165 233;
--color-input-background: 255 255 255;
--color-input-border: 226 232 240;
--color-focus-ring: 59 130 246;
--color-sidebar-background: 255 255 255;
--color-sidebar-text: 71 85 105;
--color-sidebar-active: 37 99 235;
--color-menu-hover: 241 245 249;
```

Adicionar dentro de `.dark` após as variáveis existentes:
```css
/* Tokens Semânticos RGB — Dark */
--color-background: 10 10 10;
--color-background-elevated: 15 15 15;
--color-surface: 10 10 10;
--color-surface-hover: 38 38 38;
--color-border: 38 38 38;
--color-border-strong: 70 70 70;
--color-text: 250 250 250;
--color-text-muted: 163 163 163;
--color-text-inverse: 10 10 10;
--color-primary: 250 250 250;
--color-primary-hover: 226 228 234;
--color-secondary: 24 24 27;
--color-success: 34 197 94;
--color-warning: 245 158 11;
--color-danger: 127 29 29;
--color-info: 14 165 233;
--color-input-background: 10 10 10;
--color-input-border: 38 38 38;
--color-focus-ring: 60 130 246;
--color-sidebar-background: 10 10 10;
--color-sidebar-text: 226 232 240;
--color-sidebar-active: 250 250 250;
--color-menu-hover: 38 38 38;
```

Adicionar novo bloco dentro de `@layer base` (antes do fechamento):
```css
/* Tema Auth — fixo, não muda com o tema do app */
.auth-theme {
  --color-auth-background: 15 23 42;
  --color-auth-surface: 30 41 59;
  --color-auth-border: 51 65 85;
  --color-auth-text: 248 250 252;
  --color-auth-text-muted: 148 163 184;
  --color-auth-primary: 79 70 229;
  --color-auth-primary-hover: 67 56 202;
}
```

### 2. `apps/frontend/tailwind.config.ts`

Adicionar dentro de `extend.colors`:
```ts
skin: {
  background: "rgb(var(--color-background) / <alpha-value>)",
  "background-elevated": "rgb(var(--color-background-elevated) / <alpha-value>)",
  surface: "rgb(var(--color-surface) / <alpha-value>)",
  "surface-hover": "rgb(var(--color-surface-hover) / <alpha-value>)",
  border: "rgb(var(--color-border) / <alpha-value>)",
  "border-strong": "rgb(var(--color-border-strong) / <alpha-value>)",
  text: "rgb(var(--color-text) / <alpha-value>)",
  "text-muted": "rgb(var(--color-text-muted) / <alpha-value>)",
  "text-inverse": "rgb(var(--color-text-inverse) / <alpha-value>)",
  primary: "rgb(var(--color-primary) / <alpha-value>)",
  "primary-hover": "rgb(var(--color-primary-hover) / <alpha-value>)",
  secondary: "rgb(var(--color-secondary) / <alpha-value>)",
  success: "rgb(var(--color-success) / <alpha-value>)",
  warning: "rgb(var(--color-warning) / <alpha-value>)",
  danger: "rgb(var(--color-danger) / <alpha-value>)",
  info: "rgb(var(--color-info) / <alpha-value>)",
  "input-background": "rgb(var(--color-input-background) / <alpha-value>)",
  "input-border": "rgb(var(--color-input-border) / <alpha-value>)",
  "focus-ring": "rgb(var(--color-focus-ring) / <alpha-value>)",
  "sidebar-background": "rgb(var(--color-sidebar-background) / <alpha-value>)",
  "sidebar-text": "rgb(var(--color-sidebar-text) / <alpha-value>)",
  "sidebar-active": "rgb(var(--color-sidebar-active) / <alpha-value>)",
  "menu-hover": "rgb(var(--color-menu-hover) / <alpha-value>)",
},
auth: {
  background: "rgb(var(--color-auth-background) / <alpha-value>)",
  surface: "rgb(var(--color-auth-surface) / <alpha-value>)",
  border: "rgb(var(--color-auth-border) / <alpha-value>)",
  text: "rgb(var(--color-auth-text) / <alpha-value>)",
  "text-muted": "rgb(var(--color-auth-text-muted) / <alpha-value>)",
  primary: "rgb(var(--color-auth-primary) / <alpha-value>)",
  "primary-hover": "rgb(var(--color-auth-primary-hover) / <alpha-value>)",
},
```

### 3. Criar `apps/frontend/src/theme/` (módulo completo)

Ver arquivo `THEMING.md` na raiz para estrutura completa.

Criar estes arquivos:
- `theme-types.ts` — Tipo `ThemeTokens`
- `tokens.ts` — Mapeamento para variáveis CSS
- `themes.ts` — Objetos `lightTheme` e `darkTheme`
- `auth-theme.ts` — Tipo `AuthThemeTokens` + objeto `authTheme`
- `apply-theme.ts` — Função `applyTheme()`
- `index.ts` — Barrel export

### 4. Migrar componentes core (ordem de prioridade)

1. `components/Sidebar.tsx` — bg-secondary → bg-skin-sidebar-background
2. `components/TopBar.tsx` — bg-card → bg-skin-surface
3. `components/dashboard/DashboardHome.tsx`
4. `components/operational-dashboard/OperationalDashboard.tsx` (cuidado: tem cores de gráficos que NÃO devem ser migradas)
5. `components/system-notifications/SystemNotificationsList.tsx`
6. `components/NotificationCenter.tsx`
7. Páginas de configurações

### 5. Usar o script de auditoria

```bash
node scripts/check-hardcoded-colors.js
```

Ao migrar manualmente, use o mapeamento semântico:

| Tailwind antigo | Token novo |
|:---|:---|
| `bg-white`, `bg-slate-950`, `bg-slate-900` | `bg-skin-surface` |
| `bg-slate-50`, `bg-slate-100` | `bg-skin-background-elevated` ou `bg-skin-surface-hover` |
| `text-slate-900`, `text-slate-800`, `text-slate-700` | `text-skin-text` |
| `text-slate-600`, `text-slate-500`, `text-slate-400` | `text-skin-text-muted` |
| `border-slate-200`, `border-slate-800` | `border-skin-border` |
| `border-slate-300`, `border-slate-700` | `border-skin-border-strong` |
| `bg-blue-600`, `bg-blue-500` | `bg-skin-primary` |
| `bg-blue-700` | `bg-skin-primary-hover` |
| `text-blue-600`, `text-blue-700` | `text-skin-primary` |
| `bg-emerald-50` | `bg-skin-success/10` |
| `text-emerald-900` | `text-skin-success` |
| `bg-amber-50` | `bg-skin-warning/10` |
| `text-amber-900` | `text-skin-warning` |
| `bg-rose-50`, `bg-red-50` | `bg-skin-danger/10` |
| `text-rose-900`, `text-red-700` | `text-skin-danger` |

---

## ✅ Critério de Conclusão

- [ ] `scripts/check-hardcoded-colors.js` retorna < 50 erros (excluindo arquivos de exceção)
- [ ] Dark mode visual idêntico ao antes da refatoração
- [ ] Login ainda funciona com `auth-theme` isolado
- [ ] `tailwind.config.ts` tem cores `skin-*` e `auth-*`
- [ ] `globals.css` tem tokens semânticos em `:root` e `.dark`
- [ ] Módulo `src/theme/` existe e exporta corretamente
- [ ] `THEMING.md` existe na raiz

## ❌ O Que Nunca Fazer

- **NÃO usar `content.replace(/\s{2,}/g, ' ')`** em scripts de migração — destrói formatação
- **NÃO aplicar `git stash pop`** — o stash tem arquivos destruídos
- **NÃO migrar** `OperationalDashboard.tsx` linhas de `strokeColor` / `fillColor` nos gráficos
- **NÃO migrar** páginas de auth (`login`, `esqueci-senha`, etc.)
