/**
 * CyberpunkToolbar — floating vertical pill toolbar, right side of canvas.
 * M-19: Skeuomorphic clay pill. All neon accent colours replaced with nt-primary/coral.
 *
 * Props:
 *   activeTool    — from useCanvasTools()
 *   onSelectTool  — from useCanvasTools()
 *   theme         — 'dark' | 'light'
 *   onToggleTheme — from useCanvasTools()
 *   onZoomIn      — () => reactFlow.zoomIn()
 *   onZoomOut     — () => reactFlow.zoomOut()
 */
export default function CyberpunkToolbar({
  activeTool,
  onSelectTool,
  theme,
  onToggleTheme,
  onZoomIn,
  onZoomOut,
}) {
  return (
    <div
      className="absolute right-5 top-1/2 -translate-y-1/2 z-10"
      style={{ pointerEvents: 'all' }}
    >
      {/* ── Pill container — clay surface ────────────────────────────── */}
      <div className="clay-toolbar flex flex-col gap-0.5 p-2 rounded-[2rem]">

        {/* Theme toggle */}
        <ToolButton
          icon={theme === 'dark' ? '☀' : '◐'}
          label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          active={false}
          onClick={onToggleTheme}
          accentColor="var(--nt-coral)"
        />

        {/* Divider */}
        <Divider />

        {/* Pan */}
        <ToolButton
          icon="✋"
          label="Pan — drag canvas (H)"
          active={activeTool === 'pan'}
          onClick={() => onSelectTool('pan')}
          accentColor="var(--nt-primary)"
        />

        {/* Zoom In */}
        <ToolButton
          icon={<ZoomIcon sign="+" />}
          label="Zoom in (+)"
          active={false}
          onClick={onZoomIn}
        />

        {/* Zoom Out */}
        <ToolButton
          icon={<ZoomIcon sign="−" />}
          label="Zoom out (−)"
          active={false}
          onClick={onZoomOut}
        />

        {/* Divider */}
        <Divider />

        {/* Wire Cutter */}
        <ToolButton
          icon="✂"
          label="Wire cutter — prune path (C)"
          active={activeTool === 'cut'}
          onClick={() => onSelectTool('cut')}
          accentColor="var(--nt-coral)"
        />

        {/* Router */}
        <ToolButton
          icon={<RouterIcon />}
          label="Router — attach material hub (R)"
          active={activeTool === 'router'}
          onClick={() => onSelectTool('router')}
          accentColor="var(--nt-primary)"
        />

        {/* Wi-Fi Note */}
        <ToolButton
          icon={<WifiIcon />}
          label="Wi-Fi note — annotate path (N)"
          active={activeTool === 'note'}
          onClick={() => onSelectTool('note')}
          accentColor="var(--nt-primary-lt)"
        />

        {/* Divider */}
        <Divider />

        {/* Grow — progressive branch expansion */}
        <ToolButton
          icon={<GrowIcon />}
          label="Grow — expand knowledge branch (G)"
          active={activeTool === 'grow'}
          onClick={() => onSelectTool('grow')}
          accentColor="var(--nt-primary)"
        />
      </div>
    </div>
  )
}

// ── Divider ───────────────────────────────────────────────────────────────────
function Divider() {
  return (
    <div
      className="mx-2 my-0.5"
      style={{
        height: 1,
        background: 'rgba(0,0,0,0.15)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.06)',
      }}
    />
  )
}

// ── ToolButton ────────────────────────────────────────────────────────────────
/**
 * Inactive  — transparent bg, no shadow, sits flush on the pill.
 * Hover     — tiny lift: outer shadow appears.
 * Active    — "pressed in": inset shadow dominates (concave clay).
 *             Accent colour applied to icon only, not background.
 */
function ToolButton({ icon, label, active, onClick, accentColor }) {
  const accent = accentColor ?? 'var(--nt-primary)'

  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={[
        'relative w-9 h-9 rounded-2xl flex items-center justify-center',
        'transition-all duration-150 select-none focus-visible:outline-none',
        'focus-visible:ring-2',
        active ? 'clay-btn-active' : '',
      ].filter(Boolean).join(' ')}
      style={active
        ? { color: accent, transform: 'scale(1)' }
        : { color: 'var(--nt-text-3)', transform: 'scale(1)' }
      }
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.22)'
        e.currentTarget.style.color     = active ? accent : 'var(--toolbar-icon-hover)'
        if (!active) {
          e.currentTarget.style.background  = 'var(--nt-bg, rgba(255,255,255,0.18))'
          e.currentTarget.style.boxShadow   = '0 3px 10px rgba(0,0,0,0.18), 0 1px 3px rgba(0,0,0,0.12)'
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform   = 'scale(1)'
        e.currentTarget.style.color       = active ? accent : 'var(--nt-text-3)'
        e.currentTarget.style.background  = ''
        e.currentTarget.style.boxShadow   = ''
      }}
    >
      {typeof icon === 'string'
        ? <span style={{ fontSize: 15, lineHeight: 1 }}>{icon}</span>
        : <span className="flex items-center justify-center">{icon}</span>
      }
    </button>
  )
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────
function ZoomIcon({ sign }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <text x="7" y="9.5" textAnchor="middle" fontSize="6" fontWeight="bold" fill="currentColor">{sign}</text>
    </svg>
  )
}

function RouterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="6" width="12" height="7" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="5"  cy="9.5" r="1" fill="currentColor" />
      <circle cx="8"  cy="9.5" r="1" fill="currentColor" />
      <circle cx="11" cy="9.5" r="1" fill="currentColor" />
      <line x1="5" y1="6" x2="5" y2="4"   stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="8" y1="6" x2="8" y2="2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="11" y1="6" x2="11" y2="4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function WifiIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 7 C4.5 4.5 11.5 4.5 14 7"  stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M4 9.5 C5.5 8 10.5 8 12 9.5"  stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M6 12 C6.8 11 9.2 11 10 12"   stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <circle cx="8" cy="13.5" r="1" fill="currentColor" />
    </svg>
  )
}

function GrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      {/* stem */}
      <line x1="8" y1="14" x2="8" y2="7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      {/* left branch */}
      <path d="M8 10 C6 9 4.5 7.5 5 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none" />
      {/* right branch */}
      <path d="M8 8.5 C10 7.5 11.5 6 11 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none" />
      {/* left leaf */}
      <ellipse cx="4.5" cy="4.5" rx="1.5" ry="2" transform="rotate(-30 4.5 4.5)" fill="currentColor" opacity="0.85" />
      {/* right leaf */}
      <ellipse cx="11.5" cy="3.5" rx="1.5" ry="2" transform="rotate(25 11.5 3.5)" fill="currentColor" opacity="0.85" />
      {/* top bud */}
      <circle cx="8" cy="6.5" r="1.2" fill="currentColor" />
    </svg>
  )
}
