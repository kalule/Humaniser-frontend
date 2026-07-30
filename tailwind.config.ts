import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /* Legacy tokens — kept for landing page and auth pages */
        primary: '#6366F1',
        secondary: '#8B5CF6',
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        dark: '#0a0e1a',
        card: '#1E293B',
        border: '#334155',
        'text-main': '#F8FAFC',
        muted: '#94A3B8',

        /* Light-theme design tokens — map to CSS custom properties */
        'surface-page':    'var(--surface-page)',
        'surface-rail':    'var(--surface-rail)',
        'surface-sidebar': 'var(--surface-sidebar)',
        'surface-card':    'var(--surface-card)',
        'purple-accent':   'var(--color-purple)',
        'purple-tint':     'var(--color-purple-tint)',
        'purple-text':     'var(--color-purple-text)',
        'purple-deep':     'var(--color-purple-deep)',
        'border-h':        'var(--border-hairline)',
        'border-s':        'var(--border-sidebar)',
        'border-strong':   'var(--border-strong)',
        'text-pri':        'var(--text-primary)',
        'text-sec':        'var(--text-secondary)',
        'text-mut':        'var(--text-muted)',
        'text-disabled':   'var(--text-disabled)',
        'green-accent':    'var(--color-green)',
        'green-tint':      'var(--color-green-tint)',
        'green-text':      'var(--color-green-text)',
        'amber-accent':    'var(--color-amber)',
        'amber-tint':      'var(--color-amber-tint)',
        'amber-text':      'var(--color-amber-text)',
        'red-accent':      'var(--color-red)',
        'red-tint':        'var(--color-red-tint)',
        'red-text':        'var(--color-red-text)',
        'coral-accent':    'var(--color-coral)',
        'coral-tint':      'var(--color-coral-tint)',
        'coral-text':      'var(--color-coral-text)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Syne', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        elevated: '0 4px 12px rgba(0,0,0,0.08)',
        glow: '0 0 40px rgba(124,58,237,0.12)',
        'glow-lg': '0 0 60px rgba(124,58,237,0.20)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-brand': 'linear-gradient(135deg, #7c3aed, #a855f7)',
      },
      animation: {
        'gradient-shift': 'gradient-shift 8s ease infinite',
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'marquee': 'marquee 30s linear infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}

export default config
