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
    mastery >= 70 ? 'var(--nt-primary)'     :
    mastery >  0  ? 'var(--nt-primary-lt)'  :
                    'var(--nt-text-3)'

  return (
    <div
      className="glowing-card glass-3 rounded-2xl p-5 animate-[cardIn_0.25s_ease_forwards]"
      style={{ '--mastery': mastery / 100 }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 w-6 h-6 rounded-lg glass-1
          text-xs transition-colors flex items-center justify-center"
        style={{ color: 'var(--nt-text-3)' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--nt-text)' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--nt-text-3)' }}
      >
        ✕
      </button>

      {/* Title */}
      <h3 className="text-sm font-semibold pr-6 mb-1 leading-tight" style={{ color: 'var(--nt-text)' }}>
        {node.label}
      </h3>

      {/* Status chip */}
      <span
        className="inline-block text-xs px-2 py-0.5 rounded-full mb-3"
        style={{
          background: isLocked ? 'var(--nt-bg-3)' : 'rgba(53,78,71,0.10)',
          color:      isLocked ? 'var(--nt-text-3)' : masteryColor,
          border:     `1px solid ${isLocked ? 'var(--nt-border)' : 'rgba(53,78,71,0.25)'}`,
        }}
      >
        {isLocked ? '🔒 Locked' : mastery >= 100 ? '🌟 Mastered' : mastery >= 70 ? '🔓 Bright' : '💡 Available'}
      </span>

      {/* Mastery bar */}
      {!isLocked && (
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--nt-text-3)' }}>
            <span>Mastery</span>
            <span style={{ color: masteryColor }}>{mastery.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--nt-bg-3)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${mastery}%`,
                background: `linear-gradient(90deg, ${masteryColor}, var(--nt-coral))`,
              }}
            />
          </div>
        </div>
      )}

      {/* CTA buttons */}
      {!isLocked && (
        <div className="flex gap-2">
          <button
            className="flex-1 nt-btn-secondary py-2 text-xs"
            onClick={onClose}
          >
            Review
          </button>
          <button
            className="flex-1 nt-btn-primary py-2 text-xs font-medium"
            onClick={() => { openQuiz(node); onClose() }}
          >
            Start Quiz →
          </button>
        </div>
      )}
    </div>
  )
}
