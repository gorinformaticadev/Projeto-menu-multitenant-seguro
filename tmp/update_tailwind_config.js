const fs = require('fs');
const FILE_PATH = 'c:\\Users\\Gilson\\Documents\\GitHub\\Projeto-menu-multitenant-seguro\\apps\\frontend\\tailwind.config.ts';

function updateTailwind() {
    let content = fs.readFileSync(FILE_PATH, 'utf8');
    
    if (content.includes('skin: {')) {
        console.log('Skin colors already extended in tailwind.config.ts');
        return;
    }

    const skinVars = `        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))'
        },
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
          sidebarBackground: "rgb(var(--color-sidebar-background) / <alpha-value>)",
          sidebarText: "rgb(var(--color-sidebar-text) / <alpha-value>)",
          sidebarActive: "rgb(var(--color-sidebar-active) / <alpha-value>)",
          menuHover: "rgb(var(--color-menu-hover) / <alpha-value>)",
          inputBackground: "rgb(var(--color-input-background) / <alpha-value>)",
          inputBorder: "rgb(var(--color-input-border) / <alpha-value>)",
          focusRing: "rgb(var(--color-focus-ring) / <alpha-value>)",
        }`;

    const placeholder = `        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))'
        }`;

    if (content.includes(placeholder)) {
        content = content.replace(placeholder, skinVars);
    } else {
        // Fallback or Regex replacing standard chart mapping
        content = content.replace(/chart:\s*{[^}]*}/m, skinVars);
    }

    fs.writeFileSync(FILE_PATH, content);
    console.log('Extended tailwind.config.ts colors with skin variables.');
}

updateTailwind();
