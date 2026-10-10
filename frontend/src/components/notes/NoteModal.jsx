import { useState, useEffect, useRef } from 'react'

/**
 * NoteModal — P2 Personal Knowledge Note (spec 10.72–10.75).
 *
 * Opens when:
 *   A) User activates Note tool and clicks an edge (new note)
 *   B) User clicks an existing WifiMarker (edit existing note)
 *
 * Props:
 *   context   — { edgeId, sourceNodeId, targetNodeId, sourceLabel?, targetLabel?, note? }
 *   onSave    — (edgeId, content) => void
 *   onDelete  — (edgeId) => void   — removes note from edge
 *   onClose   — () => void
 */
export default function NoteModal({ context, onSave, onDelete, onClose }) {
  const [text, setText]       = useState(context.note?.content ?? '')
  const [saving, setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const textareaRef = useRef(null)
  const MAX_LEN = 500

  // _saveError is injected by SkillTreeCanvas when the backend PATCH fails.
  const saveError = context._saveError ?? null

  const isEditing   = Boolean(context.note?.content)
  const sourceLabel = context.sourceLabel ?? context.sourceNodeId ?? '?'
  const targetLabel = context.targetLabel ?? context.targetNodeId ?? '?'

  // Auto-focus textarea
  useEffect(() => { textareaRef.current?.focus() }, [])

  // Close on Escape — but only if not in confirm-delete sub-state
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (confirmDelete) { setConfirmDelete(false); return }
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, confirmDelete])

  function handleSave() {
    if (!text.trim() || saving) return
    setSaving(true)
    // onSave is async — it persists to the backend then updates local state.
    // If the backend rejects, onSave sets _saveError on the context and returns
    // without closing the modal, so setSaving(false) keeps the button usable.
    Promise.resolve(onSave(context.edgeId, text.trim())).finally(() => {
      setSaving(false)
    })
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    setTimeout(() => {
      onDelete(context.edgeId)
      setDeleting(false)
    }, 120)
  }

  const charRatio   = text.length / MAX_LEN
  const charColor   =
    charRatio > 0.9 ? 'rgba(255,80,80,0.7)'  :
    charRatio > 0.7 ? 'rgba(255,160,30,0.6)' :
                      'rgba(255,255,255,0.2)'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-3 pb-3 sm:pb-0"
      style={{ background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(14px)' }}
      onClick={(e) => e.target === e.currentTarget && !confirmDelete && onClose()}
    >
      <div
        className="w-full flex flex-col rounded-3xl overflow-hidden"
        style={{
          maxWidth: 460,
          background: 'rgba(15,17,21,0.97)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border: '1px solid rgba(191,0,255,0.18)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(191,0,255,0.08)',
          animation: 'cardIn 0.22s ease forwards',
        }}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div
          className="flex items-start justify-between px-5 pt-5 pb-4"
          style={{ borderBottom: '1px solid rgba(191,0,255,0.12)' }}
        >
          <div className="flex items-center gap-3">
            {/* Wi-Fi icon */}
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'rgba(191,0,255,0.08)',
                border: '1px solid rgba(191,0,255,0.25)',
                boxShadow: '0 0 16px rgba(191,0,255,0.12)',
              }}
            >
              <WifiHeaderSvg />
            </div>
            <div>
              <p
                className="text-[10px] tracking-widest uppercase mb-0.5"
                style={{ color: 'rgba(191,0,255,0.7)' }}
              >
                {isEditing ? 'Edit Note' : 'Add Knowledge Note'}
              </p>
              {/* Connection breadcrumb */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <ConnectionPill label={sourceLabel} color="source" />
                <span className="text-white/20 text-xs">→</span>
                <ConnectionPill label={targetLabel} color="target" />
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 rounded-xl glass-1 flex items-center justify-center text-white/30
              hover:text-white/70 text-xs transition-colors flex-shrink-0 ml-2 mt-0.5"
          >
            ✕
          </button>
        </div>

        {/* ── Textarea ────────────────────────────────────────────────────── */}
        <div className="px-5 pt-4 pb-3">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
            placeholder="Write your thought about this connection…"
            rows={5}
            className="w-full rounded-2xl px-4 py-3 text-sm outline-none resize-none
              placeholder:text-white/20 transition-colors"
            style={{
              background:   'rgba(255,255,255,0.04)',
              border:       `1px solid ${text.length > 0 ? 'rgba(191,0,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
              color:        'rgba(240,242,245,0.85)',
              lineHeight:   1.7,
              fontFamily:   '"Inter", system-ui, sans-serif',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(191,0,255,0.5)' }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = text.length > 0 ? 'rgba(191,0,255,0.3)' : 'rgba(255,255,255,0.08)' }}
          />

          {/* Char counter + progress micro-bar */}
          <div className="flex items-center justify-between mt-2 px-1">
            <div className="flex-1 h-0.5 rounded-full bg-white/5 mr-3 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{
                  width: `${charRatio * 100}%`,
                  background: charRatio > 0.9
                    ? 'rgba(255,80,80,0.6)'
                    : 'rgba(191,0,255,0.5)',
                }}
              />
            </div>
            <span className="text-[10px] font-mono" style={{ color: charColor }}>
              {text.length}/{MAX_LEN}
            </span>
          </div>
        </div>

        {/* ── Footer actions ───────────────────────────────────────────────── */}
        <div className="px-5 pb-5 flex flex-col gap-3">

          {/* API error banner — shown when backend save/delete failed */}
          {saveError && (
            <div
              className="rounded-2xl px-4 py-3 text-xs flex items-center gap-2"
              style={{
                background: 'rgba(255,80,80,0.07)',
                border: '1px solid rgba(255,80,80,0.2)',
                color: 'rgba(255,120,120,0.9)',
              }}
            >
              <span style={{ fontSize: 14 }}>⚠</span>
              <span className="flex-1">{saveError}</span>
            </div>
          )}

          {/* Confirm-delete banner */}
          {confirmDelete && (
            <div
              className="rounded-2xl px-4 py-3 text-xs flex items-center gap-3"
              style={{
                background: 'rgba(255,80,80,0.07)',
                border: '1px solid rgba(255,80,80,0.2)',
                color: 'rgba(255,120,120,0.9)',
              }}
            >
              <span className="flex-1">Delete this note permanently?</span>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-white/40 hover:text-white/70 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="font-medium transition-colors"
                style={{ color: 'rgba(255,80,80,0.9)' }}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          )}

          {/* Primary actions */}
          <div className="flex gap-2">
            {/* Delete button — only shown for existing notes */}
            {isEditing && !confirmDelete && (
              <button
                onClick={handleDelete}
                title="Delete note"
                aria-label="Delete note"
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 flex-shrink-0"
                style={{
                  background: 'rgba(255,80,80,0.06)',
                  border: '1px solid rgba(255,80,80,0.15)',
                  color: 'rgba(255,100,100,0.6)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,80,80,0.12)'
                  e.currentTarget.style.color      = 'rgba(255,100,100,0.9)'
                  e.currentTarget.style.borderColor = 'rgba(255,80,80,0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,80,80,0.06)'
                  e.currentTarget.style.color      = 'rgba(255,100,100,0.6)'
                  e.currentTarget.style.borderColor = 'rgba(255,80,80,0.15)'
                }}
              >
                <TrashSvg />
              </button>
            )}

            <button
              onClick={onClose}
              className="flex-1 h-10 rounded-xl text-sm transition-all duration-200"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(240,242,245,0.4)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(240,242,245,0.7)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(240,242,245,0.4)' }}
            >
              Cancel
            </button>

            <button
              onClick={handleSave}
              disabled={!text.trim() || saving}
              className="flex-1 h-10 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-35 disabled:cursor-not-allowed"
              style={{
                background: text.trim()
                  ? 'linear-gradient(135deg, rgba(191,0,255,0.2), rgba(130,0,200,0.15))'
                  : 'rgba(255,255,255,0.03)',
                border: `1px solid ${text.trim() ? 'rgba(191,0,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
                color: text.trim() ? 'rgba(220,130,255,0.95)' : 'rgba(255,255,255,0.2)',
                boxShadow: text.trim() ? '0 0 18px rgba(191,0,255,0.15)' : undefined,
              }}
            >
              {saving ? 'Saving…' : isEditing ? 'Update ◉' : 'Save ◉'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────
function WifiHeaderSvg() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2.5 6.5 C5 4 11 4 13.5 6.5" stroke="rgba(191,0,255,0.85)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M4.5 9 C6 7.5 10 7.5 11.5 9"   stroke="rgba(191,0,255,0.85)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <circle cx="8" cy="12.5" r="1.5" fill="rgba(191,0,255,0.85)" />
    </svg>
  )
}

function TrashSvg() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M2 4h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M6 7v5M10 7v5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M3 4l1 9a1 1 0 001 1h6a1 1 0 001-1l1-9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function ConnectionPill({ label, color }) {
  const styles = {
    source: { bg: 'rgba(191,0,255,0.07)', border: 'rgba(191,0,255,0.2)', text: 'rgba(220,130,255,0.85)' },
    target: { bg: 'rgba(77,124,254,0.07)', border: 'rgba(77,124,254,0.2)', text: 'rgba(130,160,255,0.85)' },
  }[color]
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full max-w-[120px] truncate"
      title={label}
      style={{ background: styles.bg, border: `1px solid ${styles.border}`, color: styles.text }}
    >
      {label}
    </span>
  )
}
