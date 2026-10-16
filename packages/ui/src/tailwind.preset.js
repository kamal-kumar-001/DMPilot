/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'var(--border-default)',
        input: 'var(--border-default)',
        ring: 'var(--primary)',
        background: 'var(--bg-app)',
        foreground: 'var(--text-main)',
        primary: {
          DEFAULT: '#00BB88',
          foreground: '#FFFFFF',
          hover: '#00A376',
        },
        accent: {
          emerald: '#10B981',
          cyan: '#06B6D4',
          white: '#FFFFFF',
          gray: '#64748B',
        },
        card: {
          DEFAULT: 'var(--bg-surface)',
          foreground: 'var(--text-main)',
          border: 'var(--border-default)',
        },
      },
      borderRadius: {
        lg: '12px',
        md: '8px',
        sm: '6px',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #00BB88 0%, #06B6D4 100%)',
        'brand-gradient-subtle':
          'linear-gradient(135deg, rgba(0, 187, 136, 0.08) 0%, rgba(6, 182, 212, 0.05) 100%)',
        'cream-gradient': 'linear-gradient(180deg, #FFFFFF 0%, #FAF9F5 100%)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        brand: '0 4px 14px 0 rgba(0, 187, 136, 0.25)',
        'brand-lg': '0 8px 25px 0 rgba(0, 187, 136, 0.35)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'pulse-slow': {
          '0%, 100%': { opacity: 0.6, transform: 'scale(1)' },
          '50%': { opacity: 0.85, transform: 'scale(1.03)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'pulse-slow': 'pulse-slow 8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
