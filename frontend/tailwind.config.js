/** @type {import('tailwindcss').Config} */
export default {
  // html.dark drives dark: variants; html.theme-light is legacy (CSS vars handle it)
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── NeuroTree M-19 palette (light mode) ──────────────────────────────
        nt: {
          bg:         '#faf2e3',
          'bg-2':     '#f3e8d2',
          'bg-3':     '#ece0cc',
          surface:    '#f5ead8',
          primary:    '#354e47',
          'primary-dk': '#243630',
          'primary-lt': '#4e7267',
          coral:      '#db6271',
          'coral-dk': '#c04f5e',
          'coral-lt': '#e8909a',
          text:       '#2c3e38',
          'text-2':   '#4a5e57',
          'text-3':   '#6b7c76',
        },
        // ── Dark mode palette ─────────────────────────────────────────────────
        'nt-dark': {
          bg:         '#092328',
          'bg-2':     '#0d2e34',
          'bg-3':     '#113840',
          surface:    '#12544f',
          primary:    '#2a835f',
          'primary-dk': '#1d6048',
          'primary-lt': '#8bbb92',
        },
        // ── Legacy alias (still referenced by some Tailwind classes) ──────────
        bg: {
          primary:   '#faf2e3',
          secondary: '#f3e8d2',
          elevated:  '#f5ead8',
        },
        accent: {
          cyan:  '#4e7267',
          green: '#354e47',
        },
      },
      boxShadow: {
        // Skeuomorphic raised card — light
        'clay-out':    '5px 5px 12px rgba(160,140,110,0.45), -3px -3px 8px rgba(255,255,255,0.85), inset 1px 1px 2px rgba(255,255,255,0.90), inset -1px -1px 2px rgba(160,140,110,0.30)',
        'clay-out-sm': '3px 3px 7px rgba(160,140,110,0.40), -2px -2px 5px rgba(255,255,255,0.80), inset 1px 1px 1px rgba(255,255,255,0.85), inset -1px -1px 1px rgba(160,140,110,0.25)',
        'clay-in':     'inset 3px 3px 7px rgba(160,140,110,0.40), inset -3px -3px 7px rgba(255,255,255,0.80)',
      },
      fontFamily: {
        sans:    ['"Geist Mono Variable"', 'ui-monospace', 'monospace'],
        mono:    ['"Geist Mono Variable"', 'ui-monospace', 'monospace'],
        // serif retained for any legacy class references
        serif:   ['"Geist Mono Variable"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        '3xl': '1.5rem',
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      animation: {
        'fade-in':    'fadeIn 0.5s ease forwards',
        'fade-up':    'fadeUp 0.5s ease forwards',
        'glow-pulse': 'glowPulse 2.5s ease-in-out infinite',
        'card-in':    'cardIn 0.25s ease forwards',
        'organic':    'organicPulse 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:       { from: { opacity: 0 },                              to: { opacity: 1 } },
        fadeUp:       { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        glowPulse:    { '0%, 100%': { filter: 'brightness(0.90)' }, '50%': { filter: 'brightness(1.30)' } },
        cardIn:       { from: { opacity: 0, transform: 'scale(0.95) translateY(8px)' }, to: { opacity: 1, transform: 'scale(1) translateY(0)' } },
        organicPulse: { '0%, 100%': { opacity: '0.8', transform: 'scale(1)' }, '50%': { opacity: '0.4', transform: 'scale(1.15)' } },
      },
    },
  },
  plugins: [],
}
