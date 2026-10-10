/**
 * FilePreview — shows selected file name/size with remove action (10.11.3)
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function FilePreview({ name, size, onRemove }) {
  const ext = name.split('.').pop().toUpperCase()

  return (
    <div
      className="flex items-center gap-4 rounded-2xl px-5 py-4 animate-[cardIn_0.2s_ease_forwards]"
      style={{
        background: 'rgba(53,78,71,0.06)',
        border: '1px solid rgba(53,78,71,0.18)',
      }}
    >
      {/* File type badge */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-semibold flex-shrink-0"
        style={{
          background: 'rgba(53,78,71,0.12)',
          border: '1px solid rgba(78,114,103,0.35)',
          color: 'var(--nt-primary-lt)',
          boxShadow: 'var(--nt-shadow-out-sm)',
        }}
      >
        {ext}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate" style={{ color: 'var(--nt-text)' }}>{name}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--nt-text-3)' }}>{formatBytes(size)}</p>
      </div>

      {/* Status + remove */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="text-xs" style={{ color: 'var(--nt-primary-lt)' }}>
          ✓ Ready
        </span>
        <button
          onClick={onRemove}
          className="text-xs transition-colors"
          style={{ color: 'var(--nt-text-muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--nt-coral)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--nt-text-muted)' }}
        >
          Remove
        </button>
      </div>
    </div>
  )
}
