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
          stroke: 'rgba(255,255,255,0.10)',
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
        {/* Dim dashed cable */}
        <BaseEdge
          id={id}
          path={edgePath}
          style={{
            stroke: 'rgba(255,80,80,0.25)',
            strokeWidth: 1.5,
            strokeDasharray: '6 6',
            fill: 'none',
          }}
        />
        {/* Cut marker at centre */}
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
              style={{
                color: 'rgba(255,80,80,0.6)',
                textShadow: '0 0 6px rgba(255,80,80,0.4)',
              }}
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

  // If both markers exist, offset them slightly so they don't overlap
  const routerOffset = hasNote ? -14 : 0
  const noteOffset   = hasRouter ? 14 : 0

  return (
    <g>
      {/* Glow halo */}
      <path
        d={edgePath}
        fill="none"
        stroke="rgba(0,243,255,0.15)"
        strokeWidth={6}
        strokeLinecap="round"
        style={{ filter: 'blur(4px)' }}
      />

      {/* Main cable */}
      <path
        d={edgePath}
        fill="none"
        stroke="rgba(0,243,255,0.6)"
        strokeWidth={1.5}
        strokeLinecap="round"
      />

      {/* Animated energy particle */}
      <path
        d={edgePath}
        fill="none"
        stroke="#00F3FF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray="12 80"
        style={{
          filter: 'drop-shadow(0 0 4px #00F3FF)',
          animation: 'energyParticle 1.8s linear infinite',
        }}
      />

      <style>{`
        @keyframes energyParticle {
          0%   { stroke-dashoffset: 100; }
          100% { stroke-dashoffset: -100; }
        }
      `}</style>

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
        width: 22,
        height: 22,
        background: 'rgba(16,18,22,0.92)',
        border: '1px solid rgba(0,243,255,0.5)',
        boxShadow: '0 0 10px rgba(0,243,255,0.3), 0 0 20px rgba(0,243,255,0.12)',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 0 16px rgba(0,243,255,0.6), 0 0 32px rgba(0,243,255,0.2)'
        e.currentTarget.style.borderColor = 'rgba(0,243,255,0.9)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 0 10px rgba(0,243,255,0.3), 0 0 20px rgba(0,243,255,0.12)'
        e.currentTarget.style.borderColor = 'rgba(0,243,255,0.5)'
      }}
    >
      <RouterSvg />
    </button>
  )
}

// ── WifiMarker ────────────────────────────────────────────────────────────────
function WifiMarker({ note, onOpen }) {
  return (
    <button
      onClick={onOpen}
      title={note?.content ? `Note: ${note.content.slice(0, 40)}…` : 'Personal note'}
      aria-label="Open personal note"
      className="flex items-center justify-center rounded-lg transition-all duration-200"
      style={{
        width: 22,
        height: 22,
        background: 'rgba(16,18,22,0.92)',
        border: '1px solid rgba(191,0,255,0.5)',
        boxShadow: '0 0 10px rgba(191,0,255,0.3), 0 0 20px rgba(191,0,255,0.12)',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 0 16px rgba(191,0,255,0.6), 0 0 32px rgba(191,0,255,0.2)'
        e.currentTarget.style.borderColor = 'rgba(191,0,255,0.9)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 0 10px rgba(191,0,255,0.3), 0 0 20px rgba(191,0,255,0.12)'
        e.currentTarget.style.borderColor = 'rgba(191,0,255,0.5)'
      }}
    >
      <WifiSvg />
    </button>
  )
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────
function RouterSvg() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="6" width="12" height="7" rx="2" stroke="rgba(0,243,255,0.9)" strokeWidth="1.5" />
      <circle cx="5"  cy="9.5" r="1" fill="rgba(0,243,255,0.9)" />
      <circle cx="8"  cy="9.5" r="1" fill="rgba(0,243,255,0.9)" />
      <circle cx="11" cy="9.5" r="1" fill="rgba(0,243,255,0.9)" />
      <line x1="8" y1="6" x2="8" y2="2.5" stroke="rgba(0,243,255,0.9)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function WifiSvg() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M3 8 C5 6 11 6 13 8"      stroke="rgba(191,0,255,0.9)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M5 10.5 C6.3 9 9.7 9 11 10.5" stroke="rgba(191,0,255,0.9)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <circle cx="8" cy="13" r="1.2" fill="rgba(191,0,255,0.9)" />
    </svg>
  )
}
