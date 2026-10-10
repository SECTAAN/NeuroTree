import { BaseEdge, getSmoothStepPath, EdgeLabelRenderer } from '@xyflow/react'

/**
 * EnergyEdge — electrical cable between knowledge nodes.
 *
 * Edge data model (spec 10.69 / 10.78):
 *   data.status   — 'active' | 'cut' | 'locked'   (default 'active')
 *   data.router   — RouterData object | null
 *   data.note     — NoteData   object | null
 *   data.unlocked — legacy boolean (still respected for backward compat)
 *
 * Markers (EdgeLabelRenderer, pointer-events-auto):
 *   RouterMarker — ▣  shown when data.router is set
 *   WifiMarker   — ))) shown when data.note   is set
 *
 * Both markers call event.stopPropagation() on click so they don't
 * re-trigger the edge click handler (spec 10.79).
 */
export default function EnergyEdge({
  id,
  sourceX, sourceY,
  targetX, targetY,
  sourcePosition, targetPosition,
  data = {},
  markerEnd,
}) {
  // ── Derive visual state ───────────────────────────────────────────────────
  const status = data.status ?? (data.unlocked === false ? 'locked' : 'active')
  const isCut    = status === 'cut'
  const isLocked = status === 'locked'
  const isActive = !isCut && !isLocked

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    borderRadius: 12,
  })

  // ── Locked / cut states share a dim dashed line ───────────────────────────
  if (isLocked) {
    return (
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: 'rgba(53,78,71,0.18)',
          strokeWidth: 1.5,
          strokeDasharray: '4 4',
          fill: 'none',
        }}
      />
    )
  }

  if (isCut) {
    return (
      <g>
        <BaseEdge
          id={id}
          path={edgePath}
          style={{
            stroke: 'rgba(219,98,113,0.28)',
            strokeWidth: 1.5,
            strokeDasharray: '6 6',
            fill: 'none',
          }}
        />
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'none',
            }}
            className="nodrag nopan"
          >
            <span
              className="text-xs font-bold"
              style={{ color: 'rgba(219,98,113,0.70)' }}
            >
              ✂
            </span>
          </div>
        </EdgeLabelRenderer>
      </g>
    )
  }

  // ── Active cable ──────────────────────────────────────────────────────────
  const hasRouter = Boolean(data.router)
  const hasNote   = Boolean(data.note)

  const routerOffset = hasNote ? -14 : 0
  const noteOffset   = hasRouter ? 14 : 0

  return (
    <g>
      {/* Outer glow halo — lime tint to match cable colour */}
      <path
        d={edgePath}
        fill="none"
        stroke="rgba(148, 220, 40, 0.12)"
        strokeWidth={8}
        strokeLinecap="round"
        style={{ filter: 'blur(4px)' }}
      />

      {/* Main cable — lime-tinted with soft neon glow */}
      <path
        d={edgePath}
        fill="none"
        stroke="rgba(148, 220, 40, 0.55)"
        strokeWidth={1.5}
        strokeLinecap="round"
        className="cable-draw"
        style={{
          filter: 'drop-shadow(0 0 2px rgba(148, 220, 40, 0.50))',
        }}
      />

      {/* Animated energy particle — bright neon lime */}
      <path
        d={edgePath}
        fill="none"
        stroke="#a8e63d"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray="10 90"
        style={{
          filter: 'drop-shadow(0 0 4px #a8e63d) drop-shadow(0 0 8px #7ec800)',
          animation: 'energyParticle 1.8s linear infinite',
          animationDelay: '0.65s',
        }}
      />

      {/* ── Edge label markers ─────────────────────────────────────────────── */}
      <EdgeLabelRenderer>

        {/* Router marker — ▣ */}
        {hasRouter && (
          <div
            style={{
              position:  'absolute',
              transform: `translate(-50%, -50%) translate(${labelX + routerOffset}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <RouterMarker
              router={data.router}
              onOpen={(e) => {
                e.stopPropagation()
                data.onOpenRouter?.(data.router)
              }}
            />
          </div>
        )}

        {/* Wi-Fi note marker — ))) */}
        {hasNote && (
          <div
            style={{
              position:  'absolute',
              transform: `translate(-50%, -50%) translate(${labelX + noteOffset}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <WifiMarker
              note={data.note}
              onOpen={(e) => {
                e.stopPropagation()
                data.onOpenNote?.(data.note)
              }}
            />
          </div>
        )}

      </EdgeLabelRenderer>
    </g>
  )
}

// ── RouterMarker ──────────────────────────────────────────────────────────────
function RouterMarker({ router, onOpen }) {
  return (
    <button
      onClick={onOpen}
      title={`Router: ${router?.title ?? 'Material Hub'}`}
      aria-label="Open material router"
      className="flex items-center justify-center rounded-lg transition-all duration-200"
      style={{
        width: 24,
        height: 24,
        background: 'var(--nt-marker-bg, rgba(15,35,30,0.88))',
        border: '1.5px solid rgba(148,220,40,0.70)',
        boxShadow: '0 0 6px rgba(148,220,40,0.30), inset 0 0 4px rgba(0,0,0,0.40)',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(148,220,40,1)'
        e.currentTarget.style.boxShadow   = '0 0 10px rgba(148,220,40,0.55), inset 0 0 4px rgba(0,0,0,0.40)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(148,220,40,0.70)'
        e.currentTarget.style.boxShadow   = '0 0 6px rgba(148,220,40,0.30), inset 0 0 4px rgba(0,0,0,0.40)'
      }}
    >
      <RouterSvg />
    </button>
  )
}

function WifiMarker({ note, onOpen }) {
  return (
    <button
      onClick={onOpen}
      title={note?.content ? `Note: ${note.content.slice(0, 40)}…` : 'Personal note'}
      aria-label="Open personal note"
      className="flex items-center justify-center rounded-lg transition-all duration-200"
      style={{
        width: 24,
        height: 24,
        background: 'var(--nt-marker-bg, rgba(15,35,30,0.88))',
        border: '1.5px solid rgba(219,98,113,0.70)',
        boxShadow: '0 0 6px rgba(219,98,113,0.30), inset 0 0 4px rgba(0,0,0,0.40)',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(219,98,113,1)'
        e.currentTarget.style.boxShadow   = '0 0 10px rgba(219,98,113,0.55), inset 0 0 4px rgba(0,0,0,0.40)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(219,98,113,0.70)'
        e.currentTarget.style.boxShadow   = '0 0 6px rgba(219,98,113,0.30), inset 0 0 4px rgba(0,0,0,0.40)'
      }}
    >
      <WifiSvg />
    </button>
  )
}

function RouterSvg() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="6" width="12" height="7" rx="2" stroke="rgba(148,220,40,0.90)" strokeWidth="1.5" />
      <circle cx="5"  cy="9.5" r="1" fill="rgba(148,220,40,0.90)" />
      <circle cx="8"  cy="9.5" r="1" fill="rgba(148,220,40,0.90)" />
      <circle cx="11" cy="9.5" r="1" fill="rgba(148,220,40,0.90)" />
      <line x1="8" y1="6" x2="8" y2="2.5" stroke="rgba(148,220,40,0.90)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function WifiSvg() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M3 8 C5 6 11 6 13 8"          stroke="rgba(219,98,113,0.90)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M5 10.5 C6.3 9 9.7 9 11 10.5" stroke="rgba(219,98,113,0.90)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <circle cx="8" cy="13" r="1.2" fill="rgba(219,98,113,0.90)" />
    </svg>
  )
}
