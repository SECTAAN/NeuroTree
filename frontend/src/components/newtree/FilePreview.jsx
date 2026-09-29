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
        background: 'rgba(0,243,255,0.04)',
        border: '1px solid rgba(0,243,255,0.2)',
      }}
    >
      {/* File icon */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-mono flex-shrink-0"
        style={{
          background: 'rgba(0,243,255,0.08)',
          border: '1px solid rgba(0,243,255,0.2)',
          color: '#00F3FF',
        }}
      >
        {ext}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/85 truncate">{name}</p>
        <p className="text-xs text-white/35 mt-0.5">{formatBytes(size)}</p>
      </div>

      {/* Status + remove */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span
          className="text-xs"
          style={{ color: '#00FFA3' }}
        >
          ✓ Ready
        </span>
        <button
          onClick={onRemove}
          className="text-xs text-white/30 hover:text-white/60 transition-colors"
        >
          Remove
        </button>
      </div>
    </div>
  )
}
