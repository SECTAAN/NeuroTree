import { Handle, Position } from '@xyflow/react'
import { useState } from 'react'
import GlowingNodeCard from './GlowingNodeCard'

/**
 * NeonLampNode — knowledge node rendered as a glowing lightbulb SVG.
 *
 * Visual design (spec 10.14, 10.46):
 *   • Shape  : classic incandescent bulb — round glass dome + ribbed metal base
 *   • Mastery: CSS variable --mastery (0–1) drives:
 *       - fill opacity / color of the bulb glass
 *       - SVG filter drop-shadow glow intensity
 *       - outer ambient halo (CSS .lamp-halo)
 *   • States : locked (dim grey), available (faint cyan), mastered (bright warm glow)
 *
 * Rule 1: node stays small (28px wide). GlowingNodeCard opens on click.
 */
export default function NeonLampNode({ data, selected }) {
  const [cardOpen, setCardOpen] = useState(false)

  const rawMastery = (data.mastery_score ?? 0) / 100   // 0–1
  const isLocked   = data.status === 'locked'

  // Visual floor: an unlocked Available node must still glow faintly
  const mastery = isLocked ? 0 : Math.max(rawMastery, 0.18)

  const stateLabel =
    isLocked           ? 'Locked'      :
    rawMastery >= 1    ? 'Mastered'    :
    rawMastery >= 0.65 ? 'Bright'      :
    rawMastery >= 0.4  ? 'In Progress' :
    rawMastery > 0     ? 'Low'         :
                         'Available'

  const stateClass =
    isLocked           ? 'lamp-locked'   :
    rawMastery >= 1    ? 'lamp-mastered' :
    rawMastery >= 0.65 ? 'lamp-bright'   :
    rawMastery >= 0.4  ? 'lamp-medium'   :
                         'lamp-low'

  const handleStyle = {
    width: 6, height: 6,
    borderRadius: '50%',
    border: `1.5px solid ${isLocked ? 'rgba(255,255,255,0.10)' : 'rgba(0,220,240,0.45)'}`,
    background: 'var(--bg-primary, #111315)',
  }

  // ── Colour palette driven by mastery ─────────────────────────────────────
  // Locked → grey  |  low → faint cyan  |  mastered → warm amber-white
  const glassColor = isLocked
    ? 'rgba(120,130,145,0.25)'
    : mastery >= 0.8
      ? `rgba(255,230,130,${0.35 + mastery * 0.45})`   // warm yellow-white at high mastery
      : `rgba(0,220,240,${0.20 + mastery * 0.50})`     // cyan at lower mastery

  const glassHighlight = isLocked
    ? 'rgba(255,255,255,0.06)'
    : mastery >= 0.8
      ? `rgba(255,245,200,${0.4 + mastery * 0.3})`
      : `rgba(180,240,255,${0.25 + mastery * 0.35})`

  const filamentColor = isLocked
    ? 'rgba(255,255,255,0.08)'
    : mastery >= 0.8
      ? `rgba(255,220,80,${0.6 + mastery * 0.4})`
      : `rgba(0,230,255,${0.4 + mastery * 0.5})`

  // drop-shadow glow: cyan for normal, warm amber for mastered
  const shadowColor = mastery >= 0.8
    ? `rgba(255,200,60,${mastery * 0.85})`
    : `rgba(0,220,240,${mastery * 0.9})`

  const glowFilter = isLocked
    ? 'none'
    : `drop-shadow(0 0 ${3 + mastery * 10}px ${shadowColor}) drop-shadow(0 0 ${1 + mastery * 5}px ${shadowColor})`

  const baseStroke = isLocked ? 'rgba(120,130,145,0.35)' : 'rgba(160,200,210,0.5)'

  return (
    <>
      {/*
        Bottom-to-Top layout:
          source handle = TOP  (energy leaves upward)
          target handle = BOTTOM (energy arrives from below)
      */}
      <Handle type="source" position={Position.Top}    style={handleStyle} isConnectable={false} />
      <Handle type="target" position={Position.Bottom} style={handleStyle} isConnectable={false} />

      {/* ── Bulb node body ──────────────────────────────────────────────── */}
      <div
        className={['lamp-node', stateClass].join(' ')}
        style={{ '--mastery': mastery, width: 28, height: 36, borderRadius: 0, background: 'none' }}
        onClick={() => !isLocked && setCardOpen((v) => !v)}
        title={`${data.label} · ${stateLabel}`}
      >
        {/* Ambient halo (CSS class, fades with mastery) */}
        {!isLocked && (
          <div
            className="lamp-halo"
            style={{
              '--mastery': mastery,
              inset: '-10px',
              borderRadius: '50%',
            }}
          />
        )}

        {/* Selected / active ring — outside the SVG */}
        {(selected || cardOpen) && !isLocked && (
          <div
            className="absolute pointer-events-none"
            style={{
              inset: '-6px',
              borderRadius: '50%',
              border: `1.5px solid ${mastery >= 0.8 ? 'rgba(255,210,60,0.75)' : 'rgba(0,220,240,0.75)'}`,
              boxShadow: `0 0 10px ${shadowColor}`,
            }}
          />
        )}

        {/* ── Lightbulb SVG ─────────────────────────────────────────────── */}
        <svg
          width="28"
          height="36"
          viewBox="0 0 28 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ filter: glowFilter, display: 'block' }}
        >
          {/*
            BULB GLASS DOME
            A circle-based path that forms the rounded top of the bulb,
            tapering into the neck above the base.
          */}
          <path
            d="
              M 14 2
              C 6 2 2 8 2 14
              C 2 19.5 5.5 23.5 9 26
              L 9 28
              L 19 28
              L 19 26
              C 22.5 23.5 26 19.5 26 14
              C 26 8 22 2 14 2
              Z
            "
            fill={glassColor}
            stroke={isLocked ? 'rgba(120,130,145,0.3)' : `rgba(0,220,240,${0.15 + mastery * 0.35})`}
            strokeWidth="1"
          />

          {/* Glass specular highlight (top-left glint) */}
          <ellipse
            cx="10"
            cy="9"
            rx="3.5"
            ry="5"
            fill={glassHighlight}
            transform="rotate(-20 10 9)"
          />

          {/* Inner glow fill for high mastery */}
          {!isLocked && mastery > 0.3 && (
            <path
              d="
                M 14 5
                C 8.5 5 5 9.5 5 14
                C 5 18.5 7.5 22 10.5 24.5
                L 10.5 27
                L 17.5 27
                L 17.5 24.5
                C 20.5 22 23 18.5 23 14
                C 23 9.5 19.5 5 14 5
                Z
              "
              fill={mastery >= 0.8
                ? `rgba(255,230,100,${mastery * 0.35})`
                : `rgba(0,210,230,${mastery * 0.25})`}
            />
          )}

          {/*
            FILAMENT — two crossed lines inside the bulb
          */}
          {!isLocked && (
            <g>
              <line x1="11" y1="22" x2="14" y2="17" stroke={filamentColor} strokeWidth="0.9" strokeLinecap="round" />
              <line x1="17" y1="22" x2="14" y2="17" stroke={filamentColor} strokeWidth="0.9" strokeLinecap="round" />
              <line x1="11" y1="22" x2="17" y2="22"  stroke={filamentColor} strokeWidth="0.9" strokeLinecap="round" />
            </g>
          )}

          {/*
            METAL BASE — three ribbed rectangles below the glass
          */}
          <rect x="9"   y="28" width="10" height="2.2" rx="0.5" fill={baseStroke} />
          <rect x="9.5" y="30.5" width="9" height="1.8" rx="0.5" fill={baseStroke} />
          <rect x="10"  y="32.5" width="8" height="1.5" rx="0.5" fill={baseStroke} />

          {/* Stem/contact at the very bottom */}
          <rect x="12.5" y="34" width="3" height="1.5" rx="0.75" fill={baseStroke} />
        </svg>
      </div>

      {/* ── Label below bulb ─────────────────────────────────────────────── */}
      <div
        className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 whitespace-nowrap pointer-events-none"
        style={{
          fontSize: 10,
          color: isLocked ? 'var(--text-node-locked)' : 'var(--text-node-label)',
          fontFamily: '"Inter", sans-serif',
          letterSpacing: '0.02em',
          maxWidth: 90,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          textAlign: 'center',
        }}
      >
        {data.label}
      </div>

      {/* ── Floating GlowingNodeCard ─────────────────────────────────────── */}
      {cardOpen && (
        <div
          className="absolute left-full top-1/2 -translate-y-1/2 ml-4 z-50"
          style={{ width: 240 }}
        >
          <GlowingNodeCard
            node={data}
            onClose={() => setCardOpen(false)}
          />
        </div>
      )}
    </>
  )
}
