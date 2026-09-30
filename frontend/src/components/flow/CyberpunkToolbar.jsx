/**
 * CyberpunkToolbar — floating vertical toolbar on the right side of the canvas.
 *
 * Tools (top → bottom):
 *   Theme toggle  — light / dark
 *   Pan (✋)       — hand-drag canvas navigation
 *   Zoom In (+)   — calls reactFlow.zoomIn()
 *   Zoom Out (-)  — calls reactFlow.zoomOut()
 *   Cut (✂)       — wire-cutter: next edge click marks status='cut'
 *   Router (▣)    — attach material hub to an edge
 *   Note  (◉)     — attach personal Wi-Fi note to an edge
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
      className="absolute right-5 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-1.5"
      style={{ pointerEvents: 'all' }}
    >
      <div
        data-toolbar
        className="flex flex-col gap-1 p-1.5 rounded-2xl
          dark:bg-[rgba(16,18,22,0.88)] bg-white/80
          dark:border-white/8 border-black/10
          dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] shadow-[0_4px_20px_rgba(0,0,0,0.12)]"
        style={{
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {/* ── Theme toggle ─────────────────────────────────────────── */}
        <ToolButton
          icon={theme === 'dark' ? '☀' : '◐'}
          label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          active={false}
          onClick={onToggleTheme}
          accentColor="rgba(255,220,100,0.8)"
        />

        {/* ── Divider ──────────────────────────────────────────────── */}
        <div className="mx-2 h-px bg-white/5" />

        {/* ── Pan ──────────────────────────────────────────────────── */}
        <ToolButton
          icon="✋"
          label="Pan — drag canvas (H)"
          active={activeTool === 'pan'}
          onClick={() => onSelectTool('pan')}
        />

        {/* ── Zoom In ──────────────────────────────────────────────── */}
        <ToolButton
          icon={<ZoomIcon sign="+" />}
          label="Zoom in (+)"
          active={false}
          onClick={onZoomIn}
        />

        {/* ── Zoom Out ─────────────────────────────────────────────── */}
        <ToolButton
          icon={<ZoomIcon sign="−" />}
          label="Zoom out (−)"
          active={false}
          onClick={onZoomOut}
        />

        {/* ── Divider ──────────────────────────────────────────────── */}
        <div className="mx-2 h-px bg-white/5" />

        {/* ── Wire Cutter ──────────────────────────────────────────── */}
        <ToolButton
          icon="✂"
          label="Wire cutter — prune path (C)"
          active={activeTool === 'cut'}
          onClick={() => onSelectTool('cut')}
          accentColor="rgba(255,80,80,0.9)"
        />

        {/* ── Router ───────────────────────────────────────────────── */}
        <ToolButton
          icon={<RouterIcon />}
          label="Router — attach material hub (R)"
          active={activeTool === 'router'}
          onClick={() => onSelectTool('router')}
        />

        {/* ── Wi-Fi Note ───────────────────────────────────────────── */}
        <ToolButton
          icon={<WifiIcon />}
          label="Wi-Fi note — annotate path (N)"
          active={activeTool === 'note'}
          onClick={() => onSelectTool('note')}
          accentColor="rgba(191,0,255,0.9)"
        />
      </div>
    </div>
  )
}

// ── ToolButton ────────────────────────────────────────────────────────────────
function ToolButton({ icon, label, active, onClick, accentColor }) {
  const cyan   = 'rgba(0,243,255,0.9)'
  const accent = accentColor ?? cyan

  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      // Inactive colour: slate-500 in light mode, muted white in dark mode.
      // Active colour: always the accent (inline style wins over Tailwind).
      className={[
        'relative w-9 h-9 rounded-xl flex items-center justify-center',
        'transition-all duration-200 select-none',
        !active && 'text-slate-500 dark:text-white/40',
      ].filter(Boolean).join(' ')}
      style={{
        background: active
          ? 'rgba(0,243,255,0.10)'
          : 'transparent',
        border: `1px solid ${active ? accent : 'transparent'}`,
        boxShadow: active
          ? `0 0 12px ${accent.replace('0.9', '0.35')}, inset 0 0 8px ${accent.replace('0.9', '0.08')}`
          : undefined,
        color: active ? accent : undefined,  // inactive color comes from Tailwind class above
        fontSize: typeof icon === 'string' ? 15 : undefined,
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'rgba(128,128,128,0.08)'
          e.currentTarget.style.color      = 'var(--toolbar-icon-hover)'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color      = ''  // revert to Tailwind class
        }
      }}
    >
      {typeof icon === 'string' ? icon : <span className="flex items-center justify-center">{icon}</span>}

      {/* Active indicator dot */}
      {active && (
        <span
          className="absolute -right-0.5 -top-0.5 w-1.5 h-1.5 rounded-full"
          style={{ background: accent, boxShadow: `0 0 6px ${accent}` }}
        />
      )}
    </button>
  )
}

// ── Inline SVG icons (avoids external deps) ───────────────────────────────────
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
      <path d="M2 7 C4.5 4.5 11.5 4.5 14 7"   stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M4 9.5 C5.5 8 10.5 8 12 9.5"   stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M6 12 C6.8 11 9.2 11 10 12"    stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <circle cx="8" cy="13.5" r="1" fill="currentColor" />
    </svg>
  )
}
