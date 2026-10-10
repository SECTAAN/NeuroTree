/**
 * LiquidButton — reusable organic tactile button.
 *
 * Props:
 *   children   — button label / content
 *   onClick    — click handler
 *   variant    — 'primary' (green) | 'secondary' (coral) | 'ghost'
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
  const variantMap = {
    primary:   'nt-btn-primary',
    secondary: 'nt-btn-secondary',
    ghost:     'nt-btn-ghost',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={[
        variantMap[variant] ?? 'nt-btn-primary',
        'inline-flex items-center justify-center gap-2',
        'px-6 py-2.5',
        'text-sm font-medium',
        'transition-all duration-200',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  )
}
