import type { Config } from 'tailwindcss'

/**
 * KaryawanKu — ProMax token bridge.
 *
 * Maps Tailwind utilities onto the HSL CSS variables declared in
 * `src/app/globals.css` (mirror of `prototype-promax/assets/kk-tailwind.js`),
 * so `bg-surface-1`, `text-on-surface-variant`, etc. can never drift from the
 * plain-CSS shell classes. Dark mode is a `.dark` class swap on <html>.
 */
const config: Config = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          hover: 'hsl(var(--primary-hover) / <alpha-value>)',
          press: 'hsl(var(--primary-press) / <alpha-value>)',
          on: 'hsl(var(--on-primary) / <alpha-value>)',
          container: 'hsl(var(--primary-container) / <alpha-value>)',
          oncontainer: 'hsl(var(--on-primary-container) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          container: 'hsl(var(--accent-container) / <alpha-value>)',
          oncontainer: 'hsl(var(--on-accent-container) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'hsl(var(--surface) / <alpha-value>)',
          1: 'hsl(var(--surface-1) / <alpha-value>)',
          2: 'hsl(var(--surface-2) / <alpha-value>)',
          3: 'hsl(var(--surface-3) / <alpha-value>)',
          4: 'hsl(var(--surface-4) / <alpha-value>)',
          // M3-naming aliases some components were scaffolded with — same tokens, different name.
          container: 'hsl(var(--surface-2) / <alpha-value>)',
          'container-high': 'hsl(var(--surface-3) / <alpha-value>)',
          'container-highest': 'hsl(var(--surface-4) / <alpha-value>)',
        },
        onsurface: {
          DEFAULT: 'hsl(var(--on-surface) / <alpha-value>)',
          variant: 'hsl(var(--on-surface-variant) / <alpha-value>)',
        },
        outline: {
          DEFAULT: 'hsl(var(--outline) / <alpha-value>)',
          variant: 'hsl(var(--outline-variant) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'hsl(var(--success) / <alpha-value>)',
          container: 'hsl(var(--success-container) / <alpha-value>)',
          on: 'hsl(var(--on-success-container) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning) / <alpha-value>)',
          container: 'hsl(var(--warning-container) / <alpha-value>)',
          on: 'hsl(var(--on-warning-container) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'hsl(var(--danger) / <alpha-value>)',
          container: 'hsl(var(--danger-container) / <alpha-value>)',
          on: 'hsl(var(--on-danger-container) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'hsl(var(--info) / <alpha-value>)',
          container: 'hsl(var(--info-container) / <alpha-value>)',
          on: 'hsl(var(--on-info-container) / <alpha-value>)',
        },
        // shadcn-scaffold aliases — several components were built against these
        // names before the ProMax token bridge landed. Point them at the real tokens.
        card: 'hsl(var(--surface) / <alpha-value>)',
        'card-foreground': 'hsl(var(--on-surface) / <alpha-value>)',
        foreground: 'hsl(var(--on-surface) / <alpha-value>)',
        border: 'hsl(var(--outline-variant) / <alpha-value>)',
        'muted-foreground': 'hsl(var(--on-surface-variant) / <alpha-value>)',
        destructive: 'hsl(var(--danger) / <alpha-value>)',
      },
      fontSize: {
        'body-sm': ['13.5px', { lineHeight: '1.55' }],
        'body-md': ['15px', { lineHeight: '1.55' }],
        'title-md': ['17px', { lineHeight: '1.25' }],
        'title-lg': ['20px', { lineHeight: '1.25' }],
      },
      minHeight: {
        touch: '44px',
      },
      borderRadius: {
        xs: 'var(--r-xs)',
        sm: 'var(--r-sm)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
        xl: 'var(--r-xl)',
        full: 'var(--r-full)',
      },
      boxShadow: {
        e1: 'var(--e1)',
        e2: 'var(--e2)',
        e3: 'var(--e3)',
        e4: 'var(--e4)',
      },
      transitionTimingFunction: {
        standard: 'var(--ease-standard)',
        emphasized: 'var(--ease-emphasized)',
        'm3-standard': 'var(--ease-standard)',
      },
      transitionDuration: {
        fast: 'var(--d-fast)',
        base: 'var(--d-base)',
        slow: 'var(--d-slow)',
        'm3-short': 'var(--d-fast)',
      },
      zIndex: {
        raised: 'var(--z-raised)',
        nav: 'var(--z-nav)',
        drawer: 'var(--z-drawer)',
        modal: 'var(--z-modal)',
        toast: 'var(--z-toast)',
      },
      height: {
        appbar: 'var(--appbar-h)',
        bottomnav: 'var(--bottomnav-h)',
      },
      width: {
        rail: 'var(--rail-w)',
      },
    },
  },
  plugins: [],
}

export default config