# Guia de Estilo Neumórfico - Sistema Multitenant

Este documento detalha a implementação do novo tema neumórfico, focado em alta usabilidade, estética moderna e acessibilidade.

## 1. Visão Geral

O neumorfismo (Soft UI) simula relevo e profundidade através de jogos de sombra e luz. Diferente do Material Design que usa sombras para "flutuar", o neumorfismo faz os elementos parecerem extrudados da superfície do fundo.

### Regras de Ouro
- **Fundo Unificado**: O fundo da página e dos componentes geralmente compartilham a mesma cor.
- **Luz e Sombra**: Uma sombra clara (topo-esquerda) e uma escura (fundo-direita) criam o volume.
- **Estados**:
  - **Flat/Elevado (Padrão)**: Elemento em repouso.
  - **Pressed (Ativo/Input)**: Sombra interna, dando impressão de profundidade/cavidade.

## 2. Configuração e Tokens

As cores e sombras foram configuradas via **CSS Variables** e **Tailwind Config** para garantir consistência e facilitar temas dinâmicos (multitenant).

### Variáveis CSS (Globals.css)
Cores baseadas em HSL para fácil manipulação via código.

```css
/* Exemplo simplificado (Light Mode) */
--background: 216 33% 95%; /* #eef2f6 */
--shadow-light: 0 0% 100%; /* #ffffff */
--shadow-dark: 216 20% 82%; /* #cbd5e1 */
```

### Classes de Sombra (Tailwind)
Adicionamos utilitários personalizados em `tailwind.config.ts`:

- `shadow-neu-flat`: Estado padrão para cards e botões.
- `shadow-neu-pressed`: Estado ativo, pressionado ou para inputs (concavidade).
- `shadow-neu-sm`: Versão mais sutil para elementos menores.

## 3. Exemplos de Componentes

Abaixo estão exemplos de como construir os componentes principais usando as classes do Tailwind configuradas.

### Botões (Buttons)

Botões devem parecer táteis. Use `active:shadow-neu-pressed` para feedback de clique realista.

```tsx
import { Button } from "@/components/ui/button"

export function NeumorphicButton() {
  return (
    <div className="flex gap-4 p-4 bg-background">
      {/* Botão Primário */}
      <Button 
        className="
          bg-primary text-primary-foreground 
          rounded-xl border-none 
          shadow-neu-sm hover:shadow-neu-flat active:shadow-neu-pressed 
          transition-all duration-300 ease-in-out
          hover:-translate-y-0.5 active:translate-y-0
        "
      >
        Salvar Alterações
      </Button>

      {/* Botão Secundário / Ghost */}
      <Button 
        variant="secondary"
        className="
          bg-background text-foreground 
          rounded-xl border border-transparent
          shadow-neu-flat hover:text-primary
          active:shadow-neu-pressed
          transition-all duration-300
        "
      >
        Cancelar
      </Button>
    </div>
  )
}
```

### Cards de Conteúdo

Cards devem emergir suavemente do fundo.

```tsx
export function NeumorphicCard({ title, children }) {
  return (
    <div className="
      bg-card text-card-foreground
      rounded-2xl
      shadow-neu-flat
      p-6
      transition-shadow duration-300
      hover:shadow-lg
    ">
      <h3 className="text-xl font-semibold mb-4 text-primary">{title}</h3>
      <div className="text-muted-foreground">
        {children}
      </div>
    </div>
  )
}
```

### Inputs de Formulário

Campos de texto usam `shadow-neu-pressed` permanentemente para parecerem "afundados" na superfície.

```tsx
export function NeumorphicInput() {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium ml-1 text-muted-foreground">
        Nome do Usuário
      </label>
      <input 
        type="text"
        placeholder="Digite seu nome..."
        className="
          w-full
          bg-background
          rounded-xl
          px-4 py-3
          shadow-neu-pressed
          outline-none
          focus:ring-2 focus:ring-primary/50
          placeholder:text-muted-foreground/50
          transition-all
        "
      />
    </div>
  )
}
```

### Sidebar / Menu Lateral

A sidebar pode ser levemente elevada ou separada por uma sombra sutil.

```tsx
export function Sidebar() {
  return (
    <aside className="
      h-screen w-64
      bg-background
      shadow-neu-flat
      z-50
      flex flex-col
      border-r border-transparent /* Opcional: remover borda padrão se usar sombra */
    ">
      <div className="p-6 text-2xl font-bold text-primary">
        Logo
      </div>
      <nav className="flex-1 px-4 space-y-2">
        <a href="#" className="
          block px-4 py-3 rounded-xl
          text-foreground
          hover:text-primary hover:shadow-neu-flat
          active:shadow-neu-pressed
          transition-all duration-200
        ">
          Dashboard
        </a>
        <a href="#" className="
          block px-4 py-3 rounded-xl
          text-muted-foreground
          hover:text-primary hover:shadow-neu-flat
          transition-all duration-200
        ">
          Configurações
        </a>
      </nav>
    </aside>
  )
}
```

## 4. Acessibilidade e Multitenant

### Acessibilidade
- **Não confie apenas na sombra**: Use cores de texto com alto contraste (`foreground` foi ajustado para cinza escuro, não preto puro, mas legível).
- **Foco**: O estado de foco (`focus:ring`) é crucial no neumorfismo, pois os limites do input podem ser sutis. Mantenha o ring visível.

### Multitenant
Para alterar o tema por cliente (Tenant), basta injetar novas variáveis CSS no `:root` ou em uma classe wrapper (ex: `.tenant-theme-1`).

Como usamos HSL, você pode alterar apenas a matiz (`--primary`) programaticamente:

```css
/* Tema Tenant Vermelho */
.theme-red {
  --primary: 0 90% 60%;
  --ring: 0 90% 60%;
}
```

## 5. Próximos Passos
1. Substituir progressivamente os componentes existentes pelos exemplos acima.
2. Testar em telas de baixa qualidade (TN panels) para garantir que as sombras sejam visíveis.
3. Ajustar o `radius` global se preferir um visual mais "arredondado" (current: `0.75rem`).
