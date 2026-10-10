/**
 * GlassPanel — organic glass container for content cards, modals, and sidebars.
 *
 * Props:
 *   children   — panel content
 *   className  — extra Tailwind / custom classes
 *   glow       — 'primary' | 'coral' | 'gold' | 'none'  (border accent)
 *   as         — HTML element to render (default 'div')
 */
export default function GlassPanel({
  children,
  className = '',
  glow = 'none',
  as: Tag = 'div',
}) {
  const glowBorderMap = {
    primary: 'border-nt-primary/40',
    coral:   'border-nt-coral/40',
    gold:    'border-yellow-600/40',
    // Legacy aliases kept so old callers don't break
    cyan:    'border-nt-primary/40',
    purple:  'border-nt-coral/40',
    blue:    'border-nt-primary/30',
    none:    'border-nt-border',
  }

  return (
    <Tag
      className={[
        'nt-panel',
        'border',
        glowBorderMap[glow] ?? 'border-nt-border',
        className,
      ].join(' ')}
    >
      {children}
    </Tag>
  )
}
