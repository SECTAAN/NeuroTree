import { useRef, useState } from 'react'
import FilePreview from './FilePreview'

const ACCEPTED = ['.pdf', '.docx']
const MAX_MB    = 20

/**
 * DocumentUploader — Tab 2 (10.11.3)
 * Drag-and-drop + click-to-browse for PDF/DOCX.
 */
export default function DocumentUploader({ file, onFile }) {
  const inputRef    = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError]       = useState('')

  function validate(f) {
    const ext = '.' + f.name.split('.').pop().toLowerCase()
    if (!ACCEPTED.includes(ext)) {
      setError(`Unsupported format. Please upload a PDF or DOCX file.`)
      return false
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`File too large. Maximum size is ${MAX_MB} MB.`)
      return false
    }
    setError('')
    return true
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f && validate(f)) onFile(f)
  }

  function handlePick(e) {
    const f = e.target.files[0]
    if (f && validate(f)) onFile(f)
    e.target.value = ''
  }

  if (file) {
    return (
      <FilePreview
        name={file.name}
        size={file.size}
        onRemove={() => onFile(null)}
      />
    )
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className="rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer
          transition-all duration-200 py-10 px-6 text-center"
        style={{
          border: `1.5px dashed ${dragOver ? 'rgba(0,243,255,0.5)' : 'rgba(255,255,255,0.15)'}`,
          background: dragOver ? 'rgba(0,243,255,0.04)' : 'rgba(255,255,255,0.02)',
          boxShadow: dragOver ? '0 0 20px rgba(0,243,255,0.08)' : 'none',
        }}
      >
        <div
          className="text-3xl transition-transform duration-200"
          style={{ transform: dragOver ? 'translateY(-4px)' : 'none' }}
        >
          ☁
        </div>
        <div>
          <p className="text-sm text-white/70 mb-1">Drag & Drop your document here</p>
          <p className="text-xs text-white/35">or</p>
        </div>
        <div
          className="btn-liquid px-5 py-2 text-xs text-white/70"
          style={{ borderColor: 'rgba(255,255,255,0.15)' }}
        >
          Browse Files
        </div>
        <p className="text-xs text-white/25">PDF · DOCX · max {MAX_MB} MB</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        onChange={handlePick}
      />

      {error && (
        <p className="text-xs text-red-400/70 mt-2 px-1">{error}</p>
      )}
    </div>
  )
}
