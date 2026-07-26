import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        c2k: {
          bg: {
            DEFAULT: '#0f0f0f',
            card: '#1a1a1a',
            elevated: '#252525',
            charcoal: '#2d2d2d',
          },
          accent: {
            primary: '#14b8a6',
            'primary-hover': '#0d9488',
            secondary: '#22d3ee',
            'secondary-hover': '#06b6d4',
          },
          text: {
            primary: '#ffffff',
            secondary: '#a3a3a3',
            muted: '#737373',
          },
          border: {
            DEFAULT: 'var(--c2k-border)',
            strong: 'var(--c2k-border-strong)',
          },
          overlay: 'var(--c2k-overlay-scrim)',
          'focus-ring': 'var(--c2k-focus-ring)',
          danger: 'var(--c2k-danger)',
          success: 'var(--c2k-success)',
          warning: 'var(--c2k-warning)',
        },
        dc: {
          surface: {
            DEFAULT: 'var(--dc-surface)',
            muted: 'var(--dc-surface-muted)',
          },
          elevated: {
            DEFAULT: 'var(--dc-elevated)',
            solid: 'var(--dc-elevated-solid)',
            muted: 'var(--dc-elevated-muted)',
            hover: 'var(--dc-elevated-hover, var(--dc-elevated-muted))',
          },
          input: 'var(--dc-input, var(--dc-surface-muted))',
          text: {
            DEFAULT: 'var(--dc-text)',
            muted: 'var(--dc-text-muted)',
            subtle: 'var(--dc-text-subtle)',
          },
          muted: 'var(--dc-muted)',
          subtle: 'var(--dc-text-subtle)',
          accent: {
            DEFAULT: 'var(--dc-accent)',
            hover: 'var(--dc-accent-hover)',
            muted: 'var(--dc-accent-muted)',
            border: 'var(--dc-accent-border)',
            foreground: 'var(--dc-accent-foreground)',
          },
          border: {
            DEFAULT: 'var(--dc-border-subtle)',
            subtle: 'var(--dc-border-subtle)',
            strong: 'var(--dc-border-strong)',
          },
          danger: {
            DEFAULT: 'var(--dc-danger)',
            muted: 'var(--dc-danger-muted)',
            border: 'var(--dc-danger-border)',
          },
          success: {
            DEFAULT: 'var(--dc-success)',
            muted: 'var(--dc-success-muted)',
          },
          warning: {
            DEFAULT: 'var(--dc-warning)',
            muted: 'var(--dc-warning-muted)',
          },
        },
      },
      fontSize: {
        'dc-micro': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.02em' }],
        'c2k-display': ['1.5rem', { lineHeight: '2rem', fontWeight: '600' }],
        'c2k-body': ['0.875rem', { lineHeight: '1.25rem', fontWeight: '400' }],
        'c2k-meta': ['0.75rem', { lineHeight: '1rem', fontWeight: '500', letterSpacing: '0.02em' }],
      },
      spacing: {
        'c2k-1': 'var(--c2k-space-1)',
        'c2k-2': 'var(--c2k-space-2)',
        'c2k-3': 'var(--c2k-space-3)',
        'c2k-4': 'var(--c2k-space-4)',
        'c2k-5': 'var(--c2k-space-5)',
        'c2k-6': 'var(--c2k-space-6)',
      },
      maxWidth: {
        'shell-wide': '1920px',
        'shell-feed': '1440px',
        'shell-feed-wide': '1600px',
      },
      minHeight: {
        touch: '2.75rem',
      },
      minWidth: {
        touch: '2.75rem',
      },
      /**
       * Single app layering contract (UI Surface System).
       * Use these named tokens — never raw z-[9999]. See docs/UI_SURFACE_SYSTEM.md.
       * base content = 0 (default, no token needed).
       */
      zIndex: {
        'dc-sticky': '30', // sticky rails / in-column sticky chrome
        'dc-chrome': '40', // header / top chrome
        'dc-subnav': '45', // secondary nav, route-pending bar
        'dc-dropdown': '100', // dropdowns, popovers, menus, three-dot menus
        'dc-tooltip': '120', // tooltips
        'dc-modal-backdrop': '200', // modal/dialog/sheet scrim
        'dc-modal': '210', // modal / dialog / bottom sheet panel
        'dc-confirm': '220', // confirm dialog layered over a modal
        'dc-toast': '300', // toasts / transient status
        'dc-critical': '400', // command palette / critical global overlay
      },
      borderRadius: {
        'c2k-card': '1rem',
      },
      boxShadow: {
        'c2k-soft': '0 4px 6px -1px rgb(0 0 0 / 0.2), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        display: ['"Sora"', 'Manrope', 'system-ui', 'sans-serif'],
        /* Legacy `font-serif` in organizer/dancecard = display face, not a serif. */
        serif: ['"Sora"', 'Manrope', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [typography],
}
