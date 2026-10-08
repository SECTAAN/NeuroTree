import { Handle, Position } from '@xyflow/react'
import { useState } from 'react'

/**
 * MasterLightNode — the final/max-depth knowledge node.
 *
 * Visual design (M-5):
 *   • ~2× NeonLampNode size (56px wide × 72px tall)
 *   • Gold/white glow when master_light_unlocked=true
 *   • Dim grey crown when locked
 *   • "MASTER LIGHT" label below the bulb
 *   • Opens MasterLightModal on click (only when unlocked)
 *
 * Data fields expected in `data`:
 *   label                  — node title
 *   status                 — 'locked' | 'unlocked'
 *   master_light_unlocked  — bool: all prereqs mastered ≥ 70
 *   master_light_mastery   — 0–100 float: ML assessment score (after assessment)
 *   node_type              — 'master_light' (used by SkillTreeCanvas)
 */
export default function MasterLightNode({ data, selected }) {
  const [modalOpen, setModalOpen] = useState(false)

  const isUnlocked = Boolean(data.master_light_unlocked)
  const mlMastery  = (data.master_light_mastery ?? 0) / 100   // 0–1
  const isAssessed = mlMastery > 0

  // ── Colour palette ───────────────────────────────────────────────────────────
  const glassColor = !isUnlocked
    ? 'rgba(120,130,145,0.20)'
    : isAssessed && mlMastery >= 0.7
      ? `rgba(255,220,60,${0.45 + mlMastery * 0.40})`    // gold when mastered
      : isUnlocked
        ? `rgba(255,245,180,${0.35 + mlMastery * 0.35})` // warm white when unlocked
        : 'rgba(120,130,145,0.20)'

  const glassHighlight = !isUnlocked
    ? 'rgba(255,255,255,0.05)'
    : `rgba(255,255,220,${0.4 + mlMastery * 0.4})`

  const filamentColor = !isUnlocked
    ? 'rgba(255,255,255,0.06)'
    : isAssessed && mlMastery >= 0.7
      ? `rgba(255,200,40,${0.7 + mlMastery * 0.3})`
      : `rgba(255,230,120,0.65)`

  const shadowColor = !isUnlocked
    ? 'none'
    : isAssessed && mlMastery >= 0.7
      ? `rgba(255,190,30,${0.7 + mlMastery * 0.3})`
      : 'rgba(255,230,100,0.6)'

  const glowFilter = !isUnlocked
    ? 'none'
    : `drop-shadow(0 0 ${6 + mlMastery * 18}px ${shadowColor}) drop-shadow(0 0 ${3 + mlMastery * 9}px ${shadowColor})`

  const baseStroke = !isUnlocked
    ? 'rgba(120,130,145,0.30)'
    : 'rgba(200,170,60,0.65)'

  const strokeColor = !isUnlocked
    ? 'rgba(120,130,145,0.25)'
    : `rgba(255,210,60,${0.25 + mlMastery * 0.35})`

  const handleStyle = {
    width: 8, height: 8,
    borderRadius: '50%',
    border: `2px solid ${!isUnlocked ? 'rgba(255,255,255,0.08)' : 'rgba(255,210,60,0.5)'}`,
    background: 'var(--bg-primary, #111315)',
  }

  // Crown ray positions (8 rays around the bulb top)
  const rays = Array.from({ length: 8 }, (_, i) => {
    const angle  = (i * 360) / 8 - 90   // start from top
    const rad    = (angle * Math.PI) / 180
    const r1 = 20   // inner radius
    const r2 = 27   // outer radius
    const cx = 28, cy = 18
    return {
      x1: cx + r1 * Math.cos(rad),
      y1: cy + r1 * Math.sin(rad),
      x2: cx + r2 * Math.cos(rad),
      y2: cy + r2 * Math.sin(rad),
    }
  })

  const stateLabel = !isUnlocked
    ? 'Locked'
    : isAssessed && mlMastery >= 0.7
      ? 'Mastered'
      : isAssessed
        ? 'Assessed'
        : 'Unlocked'

  return (
    <>
      <Handle type="source" position={Position.Top}    style={handleStyle} isConnectable={false} />
      <Handle type="target" position={Position.Bottom} style={handleStyle} isConnectable={false} />

      {/* ── Node body ──────────────────────────────────────────────────────── */}
      <div
        onClick={() => isUnlocked && setModalOpen((v) => !v)}
        title={`${data.label} · ${stateLabel}`}
        style={{ cursor: isUnlocked ? 'pointer' : 'default', width: 56, height: 72, background: 'none', position: 'relative' }}
      >
        {/* Ambient halo — larger than NeonLamp */}
        {isUnlocked && (
          <div
            style={{
              position: 'absolute',
              inset: -18,
              borderRadius: '50%',
              background: isAssessed && mlMastery >= 0.7
                ? `radial-gradient(circle, rgba(255,200,30,${0.12 + mlMastery * 0.15}) 0%, transparent 70%)`
                : 'radial-gradient(circle, rgba(255,230,80,0.08) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Selected ring */}
        {(selected || modalOpen) && isUnlocked && (
          <div
            style={{
              position: 'absolute',
              inset: -8,
              borderRadius: '50%',
              border: `2px solid ${isAssessed && mlMastery >= 0.7 ? 'rgba(255,200,30,0.85)' : 'rgba(255,230,80,0.7)'}`,
              boxShadow: `0 0 16px ${shadowColor}`,
              pointerEvents: 'none',
            }}
          />
        )}

        {/* ── Master Light SVG ─────────────────────────────────────────────── */}
        <svg
          width="56"
          height="72"
          viewBox="0 0 56 72"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ filter: glowFilter, display: 'block' }}
        >
          {/* Crown rays — 8 short rays radiating from the bulb top */}
          {isUnlocked && rays.map((r, i) => (
            <line
              key={i}
              x1={r.x1} y1={r.y1}
              x2={r.x2} y2={r.y2}
              stroke={isAssessed && mlMastery >= 0.7
                ? `rgba(255,200,30,${0.5 + mlMastery * 0.4})`
                : 'rgba(255,220,80,0.4)'}
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          ))}

          {/* Bulb glass dome — 2× scale of NeonLampNode */}
          <path
            d="
              M 28 6
              C 14 6 6 16 6 28
              C 6 38 12 46 19 51
              L 19 55
              L 37 55
              L 37 51
              C 44 46 50 38 50 28
              C 50 16 42 6 28 6
              Z
            "
            fill={glassColor}
            stroke={strokeColor}
            strokeWidth="1.5"
          />

          {/* Glass specular highlight */}
          <ellipse
            cx="20"
            cy="18"
            rx="7"
            ry="10"
            fill={glassHighlight}
            transform="rotate(-20 20 18)"
          />

          {/* Inner glow fill for unlocked state */}
          {isUnlocked && (
            <path
              d="
                M 28 10
                C 17 10 10 19 10 28
                C 10 37 15 44 21 49
                L 21 54
                L 35 54
                L 35 49
                C 41 44 46 37 46 28
                C 46 19 39 10 28 10
                Z
              "
              fill={isAssessed && mlMastery >= 0.7
                ? `rgba(255,210,60,${mlMastery * 0.28})`
                : 'rgba(255,230,100,0.12)'}
            />
          )}

          {/* Filament — larger crossed lines */}
          {isUnlocked && (
            <g>
              <line x1="22" y1="48" x2="28" y2="36" stroke={filamentColor} strokeWidth="1.4" strokeLinecap="round" />
              <line x1="34" y1="48" x2="28" y2="36" stroke={filamentColor} strokeWidth="1.4" strokeLinecap="round" />
              <line x1="22" y1="48" x2="34" y2="48"  stroke={filamentColor} strokeWidth="1.4" strokeLinecap="round" />
            </g>
          )}

          {/* Star/diamond icon at filament apex for mastered state */}
          {isUnlocked && isAssessed && mlMastery >= 0.7 && (
            <polygon
              points="28,30 30,34 28,38 26,34"
              fill={`rgba(255,200,30,${0.7 + mlMastery * 0.3})`}
            />
          )}

          {/* Metal base — 3 ribbed rectangles */}
          <rect x="19" y="55" width="18" height="4"   rx="1" fill={baseStroke} />
          <rect x="20" y="59.5" width="16" height="3.5" rx="1" fill={baseStroke} />
          <rect x="21" y="63.5" width="14" height="3"   rx="1" fill={baseStroke} />

          {/* Stem contact */}
          <rect x="24" y="67" width="8" height="3" rx="1.5" fill={baseStroke} />
        </svg>
      </div>

      {/* ── Labels ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: 6,
          textAlign: 'center',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {/* MASTER LIGHT badge */}
        <div
          style={{
            fontSize: 8,
            fontFamily: '"Inter", sans-serif',
            letterSpacing: '0.12em',
            fontWeight: 700,
            textTransform: 'uppercase',
            color: !isUnlocked
              ? 'rgba(255,255,255,0.2)'
              : isAssessed && mlMastery >= 0.7
                ? 'rgba(255,200,30,0.9)'
                : 'rgba(255,220,80,0.6)',
            marginBottom: 2,
          }}
        >
          ✦ Master Light
        </div>
        {/* Node label */}
        <div
          style={{
            fontSize: 10,
            color: !isUnlocked ? 'var(--text-node-locked)' : 'var(--text-node-label)',
            fontFamily: '"Inter", sans-serif',
            letterSpacing: '0.02em',
            maxWidth: 110,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {data.label}
        </div>
        {/* Mastery score if assessed */}
        {isUnlocked && isAssessed && (
          <div
            style={{
              fontSize: 9,
              marginTop: 2,
              color: mlMastery >= 0.7 ? 'rgba(255,200,30,0.8)' : 'rgba(255,220,80,0.5)',
              fontFamily: 'monospace',
            }}
          >
            {(mlMastery * 100).toFixed(0)}%
          </div>
        )}
      </div>

      {/* ── MasterLightModal (lazy import to avoid circular dep) ────────────── */}
      {modalOpen && isUnlocked && (
        <MasterLightModalLazy
          node={data}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}

// Lazy wrapper — avoids circular import; MasterLightModal imports masterLightApi
// which is in the same services tree. Using a dynamic require at render time.
function MasterLightModalLazy({ node, onClose }) {
  const [Comp, setComp] = useState(null)
  if (!Comp) {
    import('../quiz/MasterLightModal').then((m) => setComp(() => m.default))
    return null
  }
  return <Comp node={node} onClose={onClose} />
}
