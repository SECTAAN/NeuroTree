import { Handle, Position } from '@xyflow/react'
import { useState } from 'react'
import GlowingNodeCard from './GlowingNodeCard'

/**
 * NeonLampNode — small glowing lamp node per Rule 1 (10.14).
 * Node body is a 44×44 circle with CSS-variable-driven mastery glow.
 * GlowingNodeCard floats beside it on click.
 */
export default function NeonLampNode({ data, selected }) {
  const [cardOpen, setCardOpen] = useState(false)

  const rawMastery = (data.mastery_score ?? 0) / 100   // 0–1 from DB score
  const isLocked   = data.status === 'locked'

  // Bug fix: an unlocked node with mastery 0 is "Available" — it must still glow.
  // We give it a visual floor of 0.18 so the lamp is visibly lit.
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
                         'lamp-low'      // covers both mastery > 0 and Available (floor)

  const handleStyle = {
    width: 6, height: 6,
    borderRadius: '50%',
    border: `1.5px solid ${isLocked ? 'rgba(255,255,255,0.1)' : 'rgba(0,243,255,0.4)'}`,
    background: '#111315',
  }

  return (
    <>
      {/*
        Layout is Bottom-to-Top: root sits at the bottom, branches grow upward.
        → energy LEAVES  a node going UP   → source handle on TOP
        → energy ARRIVES at a node from below → target handle on BOTTOM
      */}
      <Handle type="source" position={Position.Top}    style={handleStyle} isConnectable={false} />
      <Handle type="target" position={Position.Bottom} style={handleStyle} isConnectable={false} />

      {/* ── Lamp node body — 20px circuit dot (Rule 1) ─────────────────── */}
      <div
        className={['lamp-node', stateClass].join(' ')}
        style={{ '--mastery': mastery, width: 20, height: 20 }}
        onClick={() => !isLocked && setCardOpen((v) => !v)}
        title={`${data.label} · ${stateLabel}`}
      >
        {/* Outer halo — always rendered for unlocked nodes */}
        {!isLocked && <div className="lamp-halo" style={{ '--mastery': mastery }} />}

        {/* Core circle */}
        <div className={`lamp-core${isLocked ? ' locked' : ''}`} style={{ '--mastery': mastery }} />

        {/* Selected ring */}
        {(selected || cardOpen) && !isLocked && (
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              border: '2px solid rgba(0,243,255,0.8)',
              boxShadow: '0 0 12px rgba(0,243,255,0.4)',
              animation: 'none',
            }}
          />
        )}
      </div>

      {/* ── Label below lamp ────────────────────────────────────────────── */}
      <div
        className="absolute top-full left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap pointer-events-none"
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

      {/* ── Floating GlowingNodeCard ────────────────────────────────────── */}
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
