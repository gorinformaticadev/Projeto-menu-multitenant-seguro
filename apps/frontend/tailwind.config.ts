import type { Config } from "tailwindcss"
import tailwindcssAnimate from "tailwindcss-animate"
import typography from "@tailwindcss/typography"

const config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      fontSize: {
        xs: '0.7rem',
        sm: '0.75rem',
        base: '0.8125rem',
        lg: '1rem',
        xl: '1.125rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
        '4xl': '1.75rem',
        '5xl': '2rem',
        '6xl': '2.25rem'
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        chart: {
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
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0'
          },
          to: {
            height: 'var(--radix-accordion-content-height)'
          }
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)'
          },
          to: {
            height: '0'
          }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      },
      boxShadow: {
        'neu-flat': '3px 3px 6px hsl(var(--shadow-dark)), -3px -3px 6px hsl(var(--shadow-light))',
        'neu-pressed': 'inset 2px 2px 4px hsl(var(--shadow-dark)), inset -2px -2px 4px hsl(var(--shadow-light))',
        'neu-sm': '1px 1px 2px hsl(var(--shadow-dark)), -1px -1px 2px hsl(var(--shadow-light))',
        'neu-sidebar': '10px 0 20px -5px hsl(var(--shadow-dark)), 4px 0 8px -2px rgba(0,0,0,0.1)'
      }
    }
  },
  plugins: [tailwindcssAnimate, typography],
} satisfies Config

export default config
