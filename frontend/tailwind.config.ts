import type { Config } from 'tailwindcss'

/**
 * KaryawanKu — Material Design 3 token bridge.
 *
 * Every color below resolves to an HSL CSS variable declared in
 * `src/app/globals.css`, so light/dark mode is a class swap on <html>.
 * Seed color: deep teal #0F766E -> hsl(175 77% 26%).
 */
const config: Config = {
  darkMode: ['class'],
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        /* ---- M3 accent roles ---- */
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          container: 'hsl(var(--primary-container))',
          fixed: 'hsl(var(--primary-fixed))',
        },
        'on-primary': {
          DEFAULT: 'hsl(var(--on-primary))',
          container: 'hsl(var(--on-primary-container))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          container: 'hsl(var(--secondary-container))',
        },
        'on-secondary': {
          DEFAULT: 'hsl(var(--on-secondary))',
          container: 'hsl(var(--on-secondary-container))',
        },
        tertiary: {
          DEFAULT: 'hsl(var(--tertiary))',
          container: 'hsl(var(--tertiary-container))',
        },
        'on-tertiary': {
          DEFAULT: 'hsl(var(--on-tertiary))',
          container: 'hsl(var(--on-tertiary-container))',
        },
        error: {
          DEFAULT: 'hsl(var(--error))',
          container: 'hsl(var(--error-container))',
        },
        'on-error': {
          DEFAULT: 'hsl(var(--on-error))',
          container: 'hsl(var(--on-error-container))',
        },

        /* ---- M3 surface roles (tonal elevation) ---- */
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          dim: 'hsl(var(--surface-dim))',
          bright: 'hsl(var(--surface-bright))',
          variant: 'hsl(var(--surface-variant))',
          container: {
            DEFAULT: 'hsl(var(--surface-container))',
            lowest: 'hsl(var(--surface-container-lowest))',
            low: 'hsl(var(--surface-container-low))',
            high: 'hsl(var(--surface-container-high))',
            highest: 'hsl(var(--surface-container-highest))',
          },
        },
        'on-surface': {
          DEFAULT: 'hsl(var(--on-surface))',
          variant: 'hsl(var(--on-surface-variant))',
        },
        outline: {
          DEFAULT: 'hsl(var(--outline))',
          variant: 'hsl(var(--outline-variant))',
        },
        inverse: {
          surface: 'hsl(var(--inverse-surface))',
          'on-surface': 'hsl(var(--inverse-on-surface))',
          primary: 'hsl(var(--inverse-primary))',
        },
        scrim: 'hsl(var(--scrim))',

        /* ---- Atlassian-style semantic status roles (Bahasa labels) ---- */
        success: {
          DEFAULT: 'hsl(var(--success))',
          container: 'hsl(var(--success-container))',
        },
        'on-success': {
          DEFAULT: 'hsl(var(--on-success))',
          container: 'hsl(var(--on-success-container))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          container: 'hsl(var(--warning-container))',
        },
        'on-warning': {
          DEFAULT: 'hsl(var(--on-warning))',
          container: 'hsl(var(--on-warning-container))',
        },
        danger: {
          DEFAULT: 'hsl(var(--danger))',
          container: 'hsl(var(--danger-container))',
        },
        'on-danger': {
          DEFAULT: 'hsl(var(--danger-foreground))',
          container: 'hsl(var(--on-danger-container))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          container: 'hsl(var(--info-container))',
        },
        'on-info': {
          DEFAULT: 'hsl(var(--on-info))',
          container: 'hsl(var(--on-info-container))',
        },

        /* ---- shadcn/ui compatibility aliases (map onto M3 roles) ---- */
        background: 'hsl(var(--surface))',
        foreground: 'hsl(var(--on-surface))',
        card: {
          DEFAULT: 'hsl(var(--surface-container-low))',
          foreground: 'hsl(var(--on-surface))',
        },
        popover: {
          DEFAULT: 'hsl(var(--surface-container))',
          foreground: 'hsl(var(--on-surface))',
        },
        muted: {
          DEFAULT: 'hsl(var(--surface-variant))',
          foreground: 'hsl(var(--on-surface-variant))',
        },
        accent: {
          DEFAULT: 'hsl(var(--secondary-container))',
          foreground: 'hsl(var(--on-secondary-container))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--error))',
          foreground: 'hsl(var(--on-error))',
        },
        border: 'hsl(var(--outline-variant))',
        input: 'hsl(var(--outline))',
        ring: 'hsl(var(--primary))',
      },

      /* M3 shape scale */
      borderRadius: {
        none: '0px',
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '28px',
        '3xl': '36px',
        full: '9999px',
      },

      /* M3 5-role typography ramp, tuned for Bahasa Indonesia line length */
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-lg': ['57px', { lineHeight: '64px', letterSpacing: '-0.25px', fontWeight: '400' }],
        'display-md': ['45px', { lineHeight: '52px', letterSpacing: '0px', fontWeight: '400' }],
        'display-sm': ['36px', { lineHeight: '44px', letterSpacing: '0px', fontWeight: '400' }],
        'headline-lg': ['32px', { lineHeight: '40px', letterSpacing: '0px', fontWeight: '400' }],
        'headline-md': ['28px', { lineHeight: '36px', letterSpacing: '0px', fontWeight: '400' }],
        'headline-sm': ['24px', { lineHeight: '32px', letterSpacing: '0px', fontWeight: '400' }],
        'title-lg': ['22px', { lineHeight: '28px', letterSpacing: '0px', fontWeight: '500' }],
        'title-md': ['16px', { lineHeight: '24px', letterSpacing: '0.15px', fontWeight: '500' }],
        'title-sm': ['14px', { lineHeight: '20px', letterSpacing: '0.1px', fontWeight: '500' }],
        'body-lg': ['16px', { lineHeight: '24px', letterSpacing: '0.5px', fontWeight: '400' }],
        'body-md': ['14px', { lineHeight: '20px', letterSpacing: '0.25px', fontWeight: '400' }],
        'body-sm': ['12px', { lineHeight: '16px', letterSpacing: '0.4px', fontWeight: '400' }],
        'label-lg': ['14px', { lineHeight: '20px', letterSpacing: '0.1px', fontWeight: '500' }],
        'label-md': ['12px', { lineHeight: '16px', letterSpacing: '0.5px', fontWeight: '500' }],
        'label-sm': ['11px', { lineHeight: '16px', letterSpacing: '0.5px', fontWeight: '500' }],
      },

      /* M3 elevation 0-5, expressed as Atlassian-style 4 usable depths + 2 overlays */
      boxShadow: {
        'elevation-0': 'none',
        'elevation-1': '0 1px 2px 0 hsl(var(--shadow) / 0.30), 0 1px 3px 1px hsl(var(--shadow) / 0.15)',
        'elevation-2': '0 1px 2px 0 hsl(var(--shadow) / 0.30), 0 2px 6px 2px hsl(var(--shadow) / 0.15)',
        'elevation-3': '0 4px 8px 3px hsl(var(--shadow) / 0.15), 0 1px 3px 0 hsl(var(--shadow) / 0.30)',
        'elevation-4': '0 6px 10px 4px hsl(var(--shadow) / 0.15), 0 2px 3px 0 hsl(var(--shadow) / 0.30)',
        'elevation-5': '0 8px 12px 6px hsl(var(--shadow) / 0.15), 0 4px 4px 0 hsl(var(--shadow) / 0.30)',
      },

      /* Atlassian z-index scale 0-80 */
      zIndex: {
        base: '0',
        raised: '10',
        nav: '20',
        dropdown: '30',
        scrim: '40',
        modal: '50',
        popover: '60',
        toast: '70',
        tooltip: '80',
      },

      /* Minimum comfortable touch target on the shop floor */
      minHeight: { touch: '48px' },
      minWidth: { touch: '48px' },

      transitionTimingFunction: {
        'm3-standard': 'cubic-bezier(0.2, 0, 0, 1)',
        'm3-emphasized': 'cubic-bezier(0.05, 0.7, 0.1, 1)',
      },
      transitionDuration: {
        'm3-short': '150ms',
        'm3-medium': '250ms',
        'm3-long': '400ms',
      },

      keyframes: {
        'skeleton-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
      },
      animation: {
        'skeleton-pulse': 'skeleton-pulse 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}

export default config
