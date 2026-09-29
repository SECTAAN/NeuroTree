/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── Elegant Dark Gray backgrounds (10.3) ──────────────────────────
        bg: {
          primary:   '#111315',
          secondary: '#151719',
          tertiary:  '#191C1F',
          elevated:  '#202326',
          card:      '#1A1D21',
        },
        // ── Cyberpunk Accent (10.6) ───────────────────────────────────────
        accent: {
          cyan:   '#00F3FF',
          purple: '#BF00FF',
          blue:   '#4D7CFE',
          green:  '#00FFA3',
        },
        // ── Glass layers ──────────────────────────────────────────────────
        glass: {
          subtle:   'rgba(255,255,255,0.04)',
          standard: 'rgba(255,255,255,0.08)',
          focus:    'rgba(255,255,255,0.12)',
        },
      },
      boxShadow: {
        // Neon glow — used sparingly per Rule 4 & 6
        'glow-cyan':   '0 0 12px rgba(0,243,255,0.4), 0 0 40px rgba(0,243,255,0.15)',
        'glow-purple': '0 0 12px rgba(191,0,255,0.4), 0 0 40px rgba(191,0,255,0.15)',
        'glow-blue':   '0 0 12px rgba(77,124,254,0.4), 0 0 40px rgba(77,124,254,0.15)',
        'glow-green':  '0 0 12px rgba(0,255,163,0.4), 0 0 40px rgba(0,255,163,0.15)',
        // Glass depth shadows
        'glass-sm':  '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)',
        'glass-md':  '0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
        'glass-lg':  '0 16px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.10)',
      },
      backgroundImage: {
        // Radial ambient lighting
        'ambient-center': 'radial-gradient(ellipse 70% 50% at 50% 100%, rgba(77,124,254,0.12) 0%, transparent 70%)',
        'ambient-topleft':'radial-gradient(ellipse 50% 40% at 0% 0%, rgba(0,243,255,0.06) 0%, transparent 60%)',
        // Liquid glass button
        'liquid':         'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(0,200,255,0.06) 50%, rgba(180,0,255,0.06) 100%)',
      },
      animation: {
        'fade-in':        'fadeIn 0.5s ease forwards',
        'fade-up':        'fadeUp 0.5s ease forwards',
        'glow-pulse':     'glowPulse 2.5s ease-in-out infinite',
        'energy-flow':    'energyFlow 1.6s linear infinite',
        'sidebar-in':     'sidebarIn 0.3s ease forwards',
        'card-in':        'cardIn 0.25s ease forwards',
        'encrypt-flicker':'encryptFlicker 0.08s linear',
      },
      keyframes: {
        fadeIn:    { from: { opacity: 0 },                      to: { opacity: 1 } },
        fadeUp:    { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        glowPulse: {
          '0%, 100%': { opacity: '0.7', filter: 'brightness(0.9)' },
          '50%':      { opacity: '1',   filter: 'brightness(1.4)' },
        },
        energyFlow:{
          '0%':   { strokeDashoffset: '200' },
          '100%': { strokeDashoffset: '0'   },
        },
        sidebarIn: { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
        cardIn:    { from: { opacity: 0, transform: 'scale(0.95) translateY(8px)' }, to: { opacity: 1, transform: 'scale(1) translateY(0)' } },
        encryptFlicker: {
          '0%':  { opacity: 1 },
          '50%': { opacity: 0.7 },
          '100%':{ opacity: 1 },
        },
      },
      fontFamily: {
        mono: ['"Share Tech Mono"', 'monospace'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { '3xl': '1.5rem', '4xl': '2rem' },
    },
  },
  plugins: [],
}
