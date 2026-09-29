import { BaseEdge, getSmoothStepPath } from '@xyflow/react'

/**
 * EnergyEdge — electrical cable between nodes (10.17, 10.18).
 *
 * Unlocked: animated cyan dash with moving energy particle.
 * Locked:   dim dashed line, no animation.
 */
export default function EnergyEdge({
  id,
  sourceX, sourceY,
  targetX, targetY,
  sourcePosition, targetPosition,
  data = {},
}) {
  const isUnlocked = data.unlocked !== false   // default: render as unlocked

  const [edgePath] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    borderRadius: 12,
  })

  if (!isUnlocked) {
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

  // Total length estimate for dash animation (arbitrary — CSS handles repeating)
  return (
    <g>
      {/* Base cable glow layer */}
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

      {/* Animated energy particle dash */}
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

      {/* Inline keyframe injection */}
      <style>{`
        @keyframes energyParticle {
          0%   { stroke-dashoffset: 100; }
          100% { stroke-dashoffset: -100; }
        }
      `}</style>
    </g>
  )
}
