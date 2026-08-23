/* Tailwind CDN config — maps utilities onto the same CSS variables kk.css
   declares, so `bg-surface-1` in markup and `.card` in CSS can never drift.
   Load order: kk.css, then the Tailwind CDN, then this file. */
tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          hover: 'hsl(var(--primary-hover))',
          press: 'hsl(var(--primary-press))',
          on: 'hsl(var(--on-primary))',
          container: 'hsl(var(--primary-container))',
          oncontainer: 'hsl(var(--on-primary-container))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          container: 'hsl(var(--accent-container))',
          oncontainer: 'hsl(var(--on-accent-container))',
        },
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          1: 'hsl(var(--surface-1))',
          2: 'hsl(var(--surface-2))',
          3: 'hsl(var(--surface-3))',
          4: 'hsl(var(--surface-4))',
        },
        onsurface: {
          DEFAULT: 'hsl(var(--on-surface))',
          variant: 'hsl(var(--on-surface-variant))',
        },
        outline: {
          DEFAULT: 'hsl(var(--outline))',
          variant: 'hsl(var(--outline-variant))',
        },
        success: { DEFAULT: 'hsl(var(--success))', container: 'hsl(var(--success-container))', on: 'hsl(var(--on-success-container))' },
        warning: { DEFAULT: 'hsl(var(--warning))', container: 'hsl(var(--warning-container))', on: 'hsl(var(--on-warning-container))' },
        danger:  { DEFAULT: 'hsl(var(--danger))',  container: 'hsl(var(--danger-container))',  on: 'hsl(var(--on-danger-container))' },
        info:    { DEFAULT: 'hsl(var(--info))',    container: 'hsl(var(--info-container))',    on: 'hsl(var(--on-info-container))' },
      },
      borderRadius: {
        xs: 'var(--r-xs)', sm: 'var(--r-sm)', md: 'var(--r-md)',
        lg: 'var(--r-lg)', xl: 'var(--r-xl)', full: 'var(--r-full)',
      },
      boxShadow: { e1: 'var(--e1)', e2: 'var(--e2)', e3: 'var(--e3)', e4: 'var(--e4)' },
      transitionTimingFunction: {
        standard: 'var(--ease-standard)',
        emphasized: 'var(--ease-emphasized)',
      },
    },
  },
};
