/**
 * GenerationError — shown when API call fails in Step 3 (10.11.14)
 */
export default function GenerationError({ message, onRetry, onBackToSource, onCancel }) {
  return (
    <div className="flex flex-col items-center py-6 animate-[fadeUp_0.3s_ease_forwards]">
      <div className="text-3xl mb-4">⚠</div>

      <p className="text-sm font-medium text-white/75 mb-2">
        Something went wrong while building your tree.
      </p>
      <p className="text-xs text-white/35 text-center mb-1 max-w-xs">
        {message || 'An unexpected error occurred. Your input has been preserved.'}
      </p>
      <p className="text-xs text-white/25 mb-8">Please try again.</p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={onRetry}
          className="w-full btn-liquid py-2.5 text-sm font-medium"
          style={{ borderColor: 'rgba(0,243,255,0.3)', boxShadow: '0 0 10px rgba(0,243,255,0.1)' }}
        >
          Try Again
        </button>
        <button
          onClick={onBackToSource}
          className="w-full btn-liquid py-2.5 text-sm text-white/60"
        >
          ← Back to Knowledge Source
        </button>
        <button
          onClick={onCancel}
          className="text-xs text-white/25 hover:text-white/50 transition-colors py-1"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
