import { useRef, useState } from 'react'
import FilePreview from './FilePreview'

const ACCEPTED = ['.pdf', '.docx']
const MAX_MB    = 20
const MAX_FILES = 5   // F-8B: cap to avoid accidental runaway uploads

/**
 * DocumentUploader — Tab 2 (F-8B)
 * Multi-file drag-and-drop + click-to-browse for PDF/DOCX.
 *
 * Props:
 *   files   {File[]}             — currently selected files (from parent state)
 *   onFiles {(File[]) => void}   — called with the new full file list on every change
 *
 * Behaviour:
 *   - Drop zone stays visible at all times so additional files can be added.
 *   - Duplicate filenames are silently ignored.
 *   - Unsupported types and oversized files are rejected with an inline error.
 *   - Each selected file is shown as an independent FilePreview row with its
 *     own Remove button.
 *   - Backward compat: only the first file is sent to /extract in F-8B
 *     (multi-extract loop comes in F-8C).
 */
export default function DocumentUploader({ files, onFiles }) {
  const inputRef              = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError]       = useState('')

  // ── Validate a single File object ────────────────────────────────────────
  function validate(f) {
    const ext = '.' + f.name.split('.').pop().toLowerCase()
    if (!ACCEPTED.includes(ext)) {
      setError('Unsupported format. Please upload PDF or DOCX files only.')
      return false
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`"${f.name}" exceeds the ${MAX_MB} MB limit.`)
      return false
    }
    return true
  }

  // ── Merge new picks into existing list (de-dupe by name) ─────────────────
  function addFiles(incoming) {
    setError('')
    const existingNames = new Set(files.map((f) => f.name))

    const valid = []
    for (const f of incoming) {
      if (!validate(f)) return   // stop on first invalid; error already set
      if (existingNames.has(f.name)) continue   // silent de-dupe
      valid.push(f)
    }
    if (!valid.length) return

    const next = [...files, ...valid]
    if (next.length > MAX_FILES) {
      setError(`You can add at most ${MAX_FILES} files.`)
      return
    }
    onFiles(next)
  }

  // ── Remove one file by index ──────────────────────────────────────────────
  function removeFile(idx) {
    const next = files.filter((_, i) => i !== idx)
    onFiles(next)
    setError('')
  }

  // ── Event handlers ────────────────────────────────────────────────────────
  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    addFiles(Array.from(e.dataTransfer.files))
  }

  function handlePick(e) {
    addFiles(Array.from(e.target.files))
    e.target.value = ''   // reset so re-picking the same file fires onChange
  }

  const atMax = files.length >= MAX_FILES

  return (
    <div className="flex flex-col gap-3">

      {/* ── Selected files list ─────────────────────────────────────────── */}
      {files.length > 0 && (
        <div className="flex flex-col gap-2">
          {files.map((f, idx) => (
            <FilePreview
              key={f.name}
              name={f.name}
              size={f.size}
              onRemove={() => removeFile(idx)}
            />
          ))}
        </div>
      )}

      {/* ── Drop zone — always visible unless at max ──────────────────── */}
      {!atMax && (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className="rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer
            transition-all duration-200 py-10 px-6 text-center"
          style={{
            border:     `1.5px dashed ${dragOver ? 'rgba(0,243,255,0.5)' : 'rgba(255,255,255,0.15)'}`,
            background: dragOver ? 'rgba(0,243,255,0.04)' : 'rgba(255,255,255,0.02)',
            boxShadow:  dragOver ? '0 0 20px rgba(0,243,255,0.08)' : 'none',
          }}
        >
          <div
            className="text-3xl transition-transform duration-200"
            style={{ transform: dragOver ? 'translateY(-4px)' : 'none' }}
          >
            ☁
          </div>
          <div>
            {files.length === 0 ? (
              <p className="text-sm text-white/70 mb-1">Drag & Drop your document here</p>
            ) : (
              <p className="text-sm text-white/70 mb-1">Add another document</p>
            )}
            <p className="text-xs text-white/35">or</p>
          </div>
          <div
            className="btn-liquid px-5 py-2 text-xs text-white/70"
            style={{ borderColor: 'rgba(255,255,255,0.15)' }}
          >
            Browse Files
          </div>
          <p className="text-xs text-white/25">
            PDF · DOCX · max {MAX_MB} MB · up to {MAX_FILES} files
          </p>
        </div>
      )}

      {/* ── Hidden file input — multiple ────────────────────────────────── */}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx"
        multiple
        className="hidden"
        onChange={handlePick}
      />

      {/* ── Inline error ─────────────────────────────────────────────────── */}
      {error && (
        <p className="text-xs text-red-400/70 px-1">{error}</p>
      )}
    </div>
  )
}
