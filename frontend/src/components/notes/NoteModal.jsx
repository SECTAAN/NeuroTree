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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-3 pb-3 sm:pb-0 nt-modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && !confirmDelete && onClose()}
    >
      <div
        className="w-full flex flex-col rounded-3xl overflow-hidden glass-3"
        style={{ maxWidth: 460, animation: 'cardIn 0.22s ease forwards' }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between px-5 pt-5 pb-4"
          style={{ borderBottom: '1px solid var(--nt-border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="clay-icon w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            >
              <WifiHeaderSvg />
            </div>
            <div>
              <p
                className="text-[10px] tracking-widest uppercase mb-0.5"
                style={{ color: 'var(--nt-primary)' }}
              >
                {isEditing ? 'Edit Note' : 'Add Knowledge Note'}
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <ConnectionPill label={sourceLabel} color="source" />
                <span className="text-xs" style={{ color: 'var(--nt-text-3)' }}>→</span>
                <ConnectionPill label={targetLabel} color="target" />
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="clay-icon w-7 h-7 rounded-xl flex items-center justify-center
              text-xs transition-colors flex-shrink-0 ml-2 mt-0.5"
            style={{ color: 'var(--nt-text-3)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--nt-text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--nt-text-3)' }}
          >
            ✕
          </button>
        </div>

        {/* Textarea */}
        <div className="px-5 pt-4 pb-3">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
            placeholder="Write your thought about this connection…"
            rows={5}
            className="nt-input w-full px-4 py-3 text-sm resize-none"
            style={{
              lineHeight: 1.7,
              borderColor: text.length > 0 ? 'var(--nt-primary-lt)' : 'var(--nt-border-2)',
              color: 'var(--nt-text)',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--nt-primary)' }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = text.length > 0 ? 'var(--nt-primary-lt)' : 'var(--nt-border-2)' }}
          />

          <div className="flex items-center justify-between mt-2 px-1">
            <div className="flex-1 h-0.5 rounded-full mr-3 overflow-hidden" style={{ background: 'var(--nt-bg-3)' }}>
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{
                  width: `${charRatio * 100}%`,
                  background: charRatio > 0.9 ? 'var(--nt-coral)' : 'var(--nt-primary)',
                }}
              />
            </div>
            <span className="text-[10px]" style={{ color: 'var(--nt-text-3)' }}>
              {text.length}/{MAX_LEN}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex flex-col gap-3">

          {saveError && (
            <div
              className="rounded-2xl px-4 py-3 text-xs flex items-center gap-2"
              style={{
                background: 'rgba(219,98,113,0.07)',
                border: '1px solid rgba(219,98,113,0.25)',
                color: 'var(--nt-coral)',
              }}
            >
              <span style={{ fontSize: 14 }}>⚠</span>
              <span className="flex-1">{saveError}</span>
            </div>
          )}

          {confirmDelete && (
            <div
              className="rounded-2xl px-4 py-3 text-xs flex items-center gap-3"
              style={{
                background: 'rgba(219,98,113,0.07)',
                border: '1px solid rgba(219,98,113,0.25)',
                color: 'var(--nt-coral)',
              }}
            >
              <span className="flex-1">Delete this note permanently?</span>
              <button
                onClick={() => setConfirmDelete(false)}
                className="transition-colors"
                style={{ color: 'var(--nt-text-3)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--nt-text)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--nt-text-3)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="font-medium transition-colors"
                style={{ color: 'var(--nt-coral)' }}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          )}

          <div className="flex gap-2">
            {isEditing && !confirmDelete && (
              <button
                onClick={handleDelete}
                title="Delete note"
                aria-label="Delete note"
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 flex-shrink-0"
                style={{
                  background: 'rgba(219,98,113,0.07)',
                  border: '1px solid rgba(219,98,113,0.20)',
                  color: 'var(--nt-coral)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background  = 'rgba(219,98,113,0.13)'
                  e.currentTarget.style.borderColor = 'rgba(219,98,113,0.35)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background  = 'rgba(219,98,113,0.07)'
                  e.currentTarget.style.borderColor = 'rgba(219,98,113,0.20)'
                }}
              >
                <TrashSvg />
              </button>
            )}

            <button
              onClick={onClose}
              className="flex-1 h-10 rounded-xl text-sm transition-all duration-200 btn-liquid"
              style={{ color: 'var(--nt-text-2)' }}
            >
              Cancel
            </button>

            <button
              onClick={handleSave}
              disabled={!text.trim() || saving}
              className="flex-1 h-10 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-35 disabled:cursor-not-allowed nt-btn-primary"
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
      <path d="M2.5 6.5 C5 4 11 4 13.5 6.5" stroke="var(--nt-primary)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M4.5 9 C6 7.5 10 7.5 11.5 9"   stroke="var(--nt-primary)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <circle cx="8" cy="12.5" r="1.5" fill="var(--nt-primary)" />
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
    source: { bg: 'rgba(53,78,71,0.08)',   border: 'rgba(53,78,71,0.20)',   text: 'var(--nt-primary)'  },
    target: { bg: 'rgba(219,98,113,0.07)', border: 'rgba(219,98,113,0.20)', text: 'var(--nt-coral)'    },
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
