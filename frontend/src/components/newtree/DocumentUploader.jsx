import { useRef, useState } from 'react'
import FilePreview from './FilePreview'

const ACCEPTED = ['.pdf', '.docx']
const MAX_MB    = 20
const MAX_FILES = 5

/**
 * DocumentUploader — Tab 2 (F-8B)
 * Multi-file drag-and-drop + click-to-browse for PDF/DOCX.
 */
export default function DocumentUploader({ files, onFiles }) {
  const inputRef              = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError]       = useState('')

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

  function addFiles(incoming) {
    setError('')
    const existingNames = new Set(files.map((f) => f.name))
    const valid = []
    for (const f of incoming) {
      if (!validate(f)) return
      if (existingNames.has(f.name)) continue
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

  function removeFile(idx) {
    const next = files.filter((_, i) => i !== idx)
    onFiles(next)
    setError('')
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    addFiles(Array.from(e.dataTransfer.files))
  }

  function handlePick(e) {
    addFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  const atMax = files.length >= MAX_FILES

  return (
    <div className="flex flex-col gap-3">

      {/* Selected files list */}
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

      {/* Drop zone */}
      {!atMax && (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className="rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer
            transition-all duration-200 py-10 px-6 text-center"
          style={{
            background:  dragOver ? 'rgba(53,78,71,0.08)'  : 'var(--nt-bg-2)',
            border:      `1.5px dashed ${dragOver ? 'rgba(78,114,103,0.65)' : 'var(--nt-border-2)'}`,
            boxShadow:   dragOver ? 'var(--nt-shadow-in)' : 'none',
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
              <p className="text-sm mb-1" style={{ color: 'var(--nt-text-2)' }}>
                Drag & Drop your document here
              </p>
            ) : (
              <p className="text-sm mb-1" style={{ color: 'var(--nt-text-2)' }}>
                Add another document
              </p>
            )}
            <p className="text-xs" style={{ color: 'var(--nt-text-3)' }}>or</p>
          </div>
          <div className="nt-btn-secondary px-5 py-2 text-xs" style={{ fontSize: 12 }}>
            Browse Files
          </div>
          <p className="text-xs" style={{ color: 'var(--nt-text-muted)' }}>
            PDF · DOCX · max {MAX_MB} MB · up to {MAX_FILES} files
          </p>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx"
        multiple
        className="hidden"
        onChange={handlePick}
      />

      {/* Inline error */}
      {error && (
        <p className="text-xs px-1 nt-notice-coral p-2 rounded-lg">{error}</p>
      )}
    </div>
  )
}
