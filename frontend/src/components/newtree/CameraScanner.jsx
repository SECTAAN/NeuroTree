import { useRef, useState } from 'react'

/**
 * CameraScanner — Tab 3 (10.11.4)
 * Native HTML5 camera/image input for mobile and desktop.
 */
export default function CameraScanner({ images, onImages }) {
  const inputRef = useRef(null)
  const [previews, setPreviews] = useState(images.map((f) => URL.createObjectURL(f)))

  function handleCapture(e) {
    const newFiles = Array.from(e.target.files)
    if (!newFiles.length) return
    const updated = [...images, ...newFiles]
    onImages(updated)
    setPreviews(updated.map((f) => URL.createObjectURL(f)))
    e.target.value = ''
  }

  function remove(idx) {
    const updated = images.filter((_, i) => i !== idx)
    onImages(updated)
    setPreviews(updated.map((f) => URL.createObjectURL(f)))
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Preview grid */}
      {previews.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {previews.map((src, idx) => (
            <div key={idx} className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '4/3' }}>
              <img src={src} alt={`scan-${idx}`} className="w-full h-full object-cover" />
              <button
                onClick={() => remove(idx)}
                className="absolute top-2 right-2 w-6 h-6 rounded-lg flex items-center justify-center
                  text-xs text-white/80 transition-colors"
                style={{ background: 'rgba(17,19,21,0.8)', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add / Scan button */}
      <button
        onClick={() => inputRef.current?.click()}
        className="rounded-2xl flex flex-col items-center justify-center gap-3 py-8 cursor-pointer
          transition-all duration-200"
        style={{
          border: '1.5px dashed rgba(255,255,255,0.15)',
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <span className="text-3xl">📸</span>
        <div className="text-center">
          <p className="text-sm text-white/70 mb-0.5">
            {previews.length > 0 ? 'Scan another page' : 'Scan Document or Whiteboard'}
          </p>
          <p className="text-xs text-white/30">Opens camera on mobile · file picker on desktop</p>
        </div>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handleCapture}
      />

      {previews.length > 0 && (
        <p className="text-xs text-white/35 text-center">
          {previews.length} image{previews.length > 1 ? 's' : ''} ready · tap × to remove
        </p>
      )}
    </div>
  )
}
