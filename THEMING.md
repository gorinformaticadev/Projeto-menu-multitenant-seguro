# THEMING.md — Guia de Governança de Temas

> Documento de referência obrigatória para qualquer desenvolvedor que mexa em estilos ou componentes visuais.

---

## 1. Estrutura de Arquivos

```
src/theme/
  theme-types.ts   → Tipos TypeScript (ThemeTokens, AuthThemeTokens)
  tokens.ts        → Mapeamento de nomes de token → variável CSS
  themes.ts        → Objetos de tema (lightTheme, darkTheme)
  auth-theme.ts    → Objeto de tema fixo para fluxo de autenticação
  apply-theme.ts   → Função que aplica tokens CSS no documento
  index.ts         → Barrel export do módulo completo
```

---

## 2. Como Criar um Token

Só adicione um token se ele representar um **papel semântico novo** (ex: `sidebarActiveIndicator`, `badgeBackground`).

**Nunca crie tokens para cores específicas** como `azulPrimario`, `cinzaClaro`, etc.

**Passos:**
1. Adicione a propriedade em `ThemeTokens` (`theme-types.ts`)
2. Adicione o mapeamento em `themeTokenVars` (`tokens.ts`)
3. Adicione os valores para cada tema em `themes.ts`
4. Adicione a variável CSS em `globals.css` (light e dark)
5. Adicione no `tailwind.config.ts` dentro de `skin`

---

## 3. Como Usar um Token nos Componentes

### ✅ Correto

```tsx
<div className="bg-skin-surface text-skin-text border border-skin-border">
```

```tsx
<button className="bg-skin-primary text-skin-text-inverse hover:bg-skin-primary-hover">
```

### ❌ Proibido

```tsx
{/* Nunca use cores Tailwind diretamente em componentes novos */}
<div className="bg-white text-slate-900 border-gray-200">
<div className="bg-blue-600 text-white">
<div style={{ color: '#1e293b' }}>
```

---

## 4. Como Criar um Novo Tema

1. Audite visualmente o app atual para capturar cores reais
2. Crie um objeto `ThemeTokens` em `themes.ts` com os valores RGB corretos

```ts
export const midnightTheme: ThemeTokens = {
  background: "5 10 20",
  surface: "10 20 40",
  // ...
};
```

3. Adicione no mapa `themes`:

```ts
export const themes = {
  light: lightTheme,
  dark: darkTheme,
  midnight: midnightTheme,
};
```

4. Adicione no `ThemeProvider` no `layout.tsx`:

```tsx
themes={['light', 'dark', 'midnight', ...]}
```

5. Use `applyTheme(midnightTheme)` ou a integração com `next-themes`.

---

## 5. Como Estilizar Páginas de Auth

As páginas de autenticação usam um **tema fixo e independente**, que nunca muda com o tema do app.

**Escopos:**
- Login (`/login`)
- Esqueci senha (`/esqueci-senha`)
- Redefinir senha (`/redefinir-senha`)
- 2FA
- Convite
- Verificação de email
- Seleção de tenant pré-login

**Regra de uso:**
- Sempre adicione `auth-theme` como classe no wrapper raiz das páginas acima
- Use classes `bg-auth-*`, `text-auth-*`, `border-auth-*` dentro dessas páginas
- **NUNCA** use `data-theme` nem tokens `skin-*` em páginas de auth

```tsx
// ✅ Correto
<div className="auth-theme min-h-screen bg-auth-background text-auth-text">

// ❌ Proibido
<div className="min-h-screen bg-skin-background">
```

---

## 6. O Que É Proibido Adicionar em Componentes Novos

| Proibido | Motivo |
| :--- | :--- |
| `#[hex]` | Cor hardcoded não responde a temas |
| `rgb(...)` / `hsl(...)` | Idem |
| `bg-slate-*`, `bg-blue-*`, etc. | Tailwind hardcoded sem semântica |
| `text-gray-*`, `text-zinc-*`, etc. | Idem |
| `border-slate-*` | Idem |
| `style={{ color: '...' }}` | Inline style sem suporte a tema |

**Exceções documentadas:**
- Gráficos (Recharts, Chart.js) com paleta própria — use variáveis CSS direto
- Branding externo com cores fixas por contrato
- Componente `login/page.tsx` — usa glassmorphism fixo no auth-theme

---

## 7. Validação Rápida

Antes de commitar, execute:

```bash
# Buscar hardcodes suspeitos
Select-String -Path "apps/frontend/src/**/*.tsx" -Pattern "#[0-9a-fA-F]{3,8}|bg-(slate|gray|blue|red|green)-\d+|text-(slate|gray)-\d+" -Recurse
```

Se houver resultados **fora dos arquivos de exceção**, corrija antes de abrir o PR.

---

## 8. Paleta de Tokens Disponíveis

### App (`skin-*`)

| Classe Tailwind | CSS Var | Uso |
| :--- | :--- | :--- |
| `bg-skin-background` | `--color-background` | Fundo de página |
| `bg-skin-background-elevated` | `--color-background-elevated` | Fundo elevado (navbar) |
| `bg-skin-surface` | `--color-surface` | Fundo de cards, painéis |
| `bg-skin-surface-hover` | `--color-surface-hover` | Hover em cards |
| `border-skin-border` | `--color-border` | Bordas sutis |
| `border-skin-border-strong` | `--color-border-strong` | Bordas pronunciadas |
| `text-skin-text` | `--color-text` | Texto principal |
| `text-skin-text-muted` | `--color-text-muted` | Texto secundário |
| `text-skin-text-inverse` | `--color-text-inverse` | Texto sobre fundos coloridos |
| `bg-skin-primary` | `--color-primary` | Ação principal |
| `bg-skin-primary-hover` | `--color-primary-hover` | Hover em ação principal |
| `bg-skin-success` | `--color-success` | Estado de sucesso |
| `bg-skin-warning` | `--color-warning` | Estado de aviso |
| `bg-skin-danger` | `--color-danger` | Estado de erro/perigo |
| `bg-skin-info` | `--color-info` | Estado informativo |
| `bg-skin-input-background` | `--color-input-background` | Fundo de inputs |
| `border-skin-input-border` | `--color-input-border` | Borda de inputs |
| `ring-skin-focus-ring` | `--color-focus-ring` | Anel de foco |
| `bg-skin-sidebar-background` | `--color-sidebar-background` | Fundo da sidebar |
| `text-skin-sidebar-text` | `--color-sidebar-text` | Texto da sidebar |
| `bg-skin-sidebar-active` | `--color-sidebar-active` | Item ativo na sidebar |
| `bg-skin-menu-hover` | `--color-menu-hover` | Hover em itens de menu |

### Auth (`auth-*`)

| Classe Tailwind | CSS Var | Uso |
| :--- | :--- | :--- |
| `bg-auth-background` | `--color-auth-background` | Fundo das páginas de auth |
| `bg-auth-surface` | `--color-auth-surface` | Cards de auth |
| `border-auth-border` | `--color-auth-border` | Bordas em auth |
| `text-auth-text` | `--color-auth-text` | Texto principal em auth |
| `text-auth-text-muted` | `--color-auth-text-muted` | Texto secundário em auth |
| `bg-auth-primary` | `--color-auth-primary` | Botão primário em auth |
