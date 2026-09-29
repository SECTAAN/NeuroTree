/**
 * LiquidButton — reusable cyberpunk liquid-glass button.
 *
 * Props:
 *   children   — button label / content
 *   onClick    — click handler
 *   variant    — 'primary' (cyan glow) | 'secondary' (purple glow) | 'ghost'
 *   disabled   — boolean
 *   className  — extra Tailwind classes
 */
export default function LiquidButton({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  className = '',
  type = 'button',
}) {
  const glowMap = {
    primary:   'hover:shadow-neon-cyan  border-white/20 hover:border-neon-cyan/60',
    secondary: 'hover:shadow-neon-purple border-white/20 hover:border-neon-purple/60',
    ghost:     'hover:shadow-neon-blue  border-white/10 hover:border-neon-blue/40',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={[
        'btn-liquid',
        'inline-flex items-center justify-center gap-2',
        'px-6 py-2.5',
        'text-sm font-medium text-white/90',
        'transition-all duration-200',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none',
        glowMap[variant] ?? glowMap.primary,
        className,
      ].join(' ')}
    >
      {children}
    </button>
  )
}
