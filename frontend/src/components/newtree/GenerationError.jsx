/**
 * GenerationError — shown when API call fails in Step 3 (10.11.14)
 */
export default function GenerationError({ message, onRetry, onBackToSource, onCancel }) {
  return (
    <div className="flex flex-col items-center py-6 animate-[fadeUp_0.3s_ease_forwards]">
      {/* Error icon */}
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-5"
        style={{
          background: 'rgba(219,98,113,0.10)',
          border: '1px solid rgba(219,98,113,0.28)',
          boxShadow: 'var(--nt-shadow-out-sm)',
        }}
      >
        ⚠
      </div>

      <p className="text-sm font-medium mb-2" style={{ color: 'var(--nt-text)' }}>
        Something went wrong while building your tree.
      </p>
      <p className="text-xs text-center mb-1 max-w-xs" style={{ color: 'var(--nt-text-2)' }}>
        {message || 'An unexpected error occurred. Your input has been preserved.'}
      </p>
      <p className="text-xs mb-8" style={{ color: 'var(--nt-text-3)' }}>Please try again.</p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={onRetry}
          className="nt-btn-primary w-full py-2.5 text-sm font-medium"
        >
          Try Again
        </button>
        <button
          onClick={onBackToSource}
          className="nt-btn-secondary w-full py-2.5 text-sm"
          style={{ color: 'var(--nt-text-2)' }}
        >
          ← Back to Knowledge Source
        </button>
        <button
          onClick={onCancel}
          className="text-xs py-1 transition-colors"
          style={{ color: 'var(--nt-text-muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--nt-text-3)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--nt-text-muted)' }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
