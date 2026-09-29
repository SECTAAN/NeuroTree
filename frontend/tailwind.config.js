/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Cyberpunk Neon Palette ──────────────────────────────────────
        'neon-cyan':    '#00f3ff',
        'neon-blue':    '#0ea5e9',
        'neon-purple':  '#bf00ff',
        'neon-violet':  '#7c3aed',
        'neon-green':   '#00ff9f',
        'neon-pink':    '#ff00aa',
        // ── Circuit Background ──────────────────────────────────────────
        'circuit-bg':   '#020817',   // deep navy-black
        'circuit-card': '#0d1829',   // slightly lighter card bg
        'circuit-line': '#1e3a5f',   // PCB trace colour
      },
      boxShadow: {
        // Neon glow effects — used on nodes and buttons
        'neon-cyan':   '0 0 8px #00f3ff, 0 0 24px #00f3ff55, 0 0 48px #00f3ff22',
        'neon-blue':   '0 0 8px #0ea5e9, 0 0 24px #0ea5e955, 0 0 48px #0ea5e922',
        'neon-purple': '0 0 8px #bf00ff, 0 0 24px #bf00ff55, 0 0 48px #bf00ff22',
        'neon-green':  '0 0 8px #00ff9f, 0 0 24px #00ff9f55, 0 0 48px #00ff9f22',
        'glass':       '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
        'glass-hover': '0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.14)',
      },
      backdropBlur: {
        xs: '2px',
      },
      backgroundImage: {
        // Subtle radial grid for HUD backgrounds
        'circuit-grid': `
          radial-gradient(circle at 50% 50%, #0d1829 0%, #020817 100%)
        `,
        // Iridescent gradient for liquid glass buttons
        'liquid-glass': `linear-gradient(
          135deg,
          rgba(255,255,255,0.12) 0%,
          rgba(100,200,255,0.08) 40%,
          rgba(180,100,255,0.08) 100%
        )`,
      },
      animation: {
        'pulse-slow':    'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'glow-breathe':  'glowBreathe 2.5s ease-in-out infinite',
        'energy-flow':   'energyFlow 1.8s linear infinite',
      },
      keyframes: {
        glowBreathe: {
          '0%, 100%': { opacity: '0.6', filter: 'brightness(0.9)' },
          '50%':      { opacity: '1',   filter: 'brightness(1.3)' },
        },
        energyFlow: {
          '0%':   { strokeDashoffset: '100' },
          '100%': { strokeDashoffset: '0'   },
        },
      },
      fontFamily: {
        hud: ['"Share Tech Mono"', '"Courier New"', 'monospace'],
        ui:  ['"Inter"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
