import { useApp } from '../../context/AppContext'

/**
 * GlowingNodeCard — floating detail card with rotating glowing border (10.20).
 * Appears on node click. Uses pure CSS @property animation (Aceternity-style).
 */
export default function GlowingNodeCard({ node, onClose }) {
  const { openQuiz } = useApp()

  const mastery    = node.mastery_score ?? 0
  const isLocked   = node.status === 'locked'

  const masteryColor =
    mastery >= 80 ? '#00FFA3' :
    mastery >= 60 ? '#00F3FF' :
    mastery >= 40 ? '#4D7CFE' :
                    'rgba(255,255,255,0.3)'

  return (
    <div
      className="glowing-card glass-3 rounded-2xl p-5 animate-[cardIn_0.25s_ease_forwards]"
      style={{ '--mastery': mastery / 100 }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 w-6 h-6 rounded-lg glass-1
          text-white/30 hover:text-white/70 text-xs transition-colors flex items-center justify-center"
      >
        ✕
      </button>

      {/* Title */}
      <h3 className="text-sm font-semibold text-white/90 pr-6 mb-1 leading-tight">
        {node.label}
      </h3>

      {/* Status chip */}
      <span
        className="inline-block text-xs px-2 py-0.5 rounded-full mb-3"
        style={{
          background: isLocked ? 'rgba(255,255,255,0.06)' : 'rgba(0,243,255,0.08)',
          color: isLocked ? 'rgba(255,255,255,0.3)' : masteryColor,
          border: `1px solid ${isLocked ? 'rgba(255,255,255,0.08)' : 'rgba(0,243,255,0.2)'}`,
        }}
      >
        {isLocked ? '🔒 Locked' : mastery >= 100 ? '🌟 Mastered' : mastery >= 70 ? '⚡ In Progress' : '💡 Available'}
      </span>

      {/* Mastery bar */}
      {!isLocked && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-white/40 mb-1.5">
            <span>Mastery</span>
            <span style={{ color: masteryColor }}>{mastery.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${mastery}%`,
                background: `linear-gradient(90deg, ${masteryColor}, rgba(77,124,254,0.6))`,
                boxShadow: `0 0 8px ${masteryColor}44`,
              }}
            />
          </div>
        </div>
      )}

      {/* CTA buttons */}
      {!isLocked && (
        <div className="flex gap-2">
          <button
            className="flex-1 btn-liquid py-2 text-xs text-white/60"
            onClick={onClose}
          >
            Review
          </button>
          <button
            className="flex-1 btn-liquid py-2 text-xs font-medium"
            style={{ borderColor: 'rgba(0,243,255,0.35)', boxShadow: '0 0 10px rgba(0,243,255,0.1)' }}
            onClick={() => { openQuiz(node); onClose() }}
          >
            Start Quiz ⚡
          </button>
        </div>
      )}
    </div>
  )
}
