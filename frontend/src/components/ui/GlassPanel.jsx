/**
 * GlassPanel — frosted-glass container for content cards, modals, and sidebars.
 *
 * Props:
 *   children   — panel content
 *   className  — extra Tailwind / custom classes
 *   glow       — 'cyan' | 'purple' | 'blue' | 'none'  (border glow accent)
 *   as         — HTML element to render (default 'div')
 */
export default function GlassPanel({
  children,
  className = '',
  glow = 'none',
  as: Tag = 'div',
}) {
  const glowBorderMap = {
    cyan:   'border-neon-cyan',
    purple: 'border-neon-purple',
    blue:   'border-neon-blue',
    none:   'border-white/10',
  }

  return (
    <Tag
      className={[
        'glass-panel',
        'border',
        glowBorderMap[glow] ?? 'border-white/10',
        className,
      ].join(' ')}
    >
      {children}
    </Tag>
  )
}
