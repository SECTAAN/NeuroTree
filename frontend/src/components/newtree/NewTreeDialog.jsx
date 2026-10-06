import { useState, useCallback } from 'react'
import { useApp }                from '../../context/AppContext'
import { graphApi, activeSession } from '../../services/api'
import NewTreeStepper            from './NewTreeStepper'
import InitializationStep        from './InitializationStep'
import KnowledgeSourceStep       from './KnowledgeSourceStep'
import AIProcessingState         from './AIProcessingState'
import GenerationError           from './GenerationError'

const INITIAL_METADATA = { treeName: '', learningGoal: '' }
const INITIAL_SOURCE   = { sourceType: 'text', text: '', files: [], images: [] }

// ── Source validation ────────────────────────────────────────────────────────
function isSourceValid(source) {
  if (source.sourceType === 'text')     return source.text.trim().length > 0
  if (source.sourceType === 'document') return source.files.length > 0
  if (source.sourceType === 'image')    return source.images.length > 0
  return false
}

// ── Extract plain text from source for backend ───────────────────────────────
// F-4: PDF/DOCX files are sent to POST /api/v1/material/extract which returns
// the real plain text (capped at 5 000 chars per file).
// P0-3: Camera images are processed with Tesseract.js (client-side OCR).
//   - Dynamic import so WASM is loaded only when the camera path is used.
//   - Worker is always terminated, even on error.
//   - Output is joined and capped at 5 000 chars to match the per-file cap.
// F-8D: Multiple files are combined before /ingest; the combined payload is
//   capped at INGEST_MAX_CHARS — mirrors backend IngestRequest.max_length.
// F-8E.1: raised from 12 000 to 30 000 (matches backend config.py INGEST_MAX_CHARS).
const OCR_MAX_CHARS    = 5_000
const INGEST_MAX_CHARS = 30_000   // must stay in sync with backend config.py

// ── OCR image preprocessing ──────────────────────────────────────────────────
// Improves Tesseract accuracy on real camera photos (blur, shadow, low contrast).
//
// Steps applied to each image before recognition:
//   1. Scale up   — if the longer edge < OCR_MIN_PX, upscale to OCR_MIN_PX while
//                   preserving aspect ratio.  Tesseract degrades below ~150 DPI;
//                   ~1 500 px on the long edge keeps an A4 page above that floor.
//   2. Grayscale  — draw via a filter so the LSTM model sees a single-channel image.
//   3. Gentle contrast — pixel-level stretch: (v − 128) × 1.15 + 128, clamped.
//                   Factor 1.15 (15% boost) lifts low-contrast camera photos
//                   without over-saturating thin strokes or box borders.
//                   Diagnostic testing confirmed that factor > 1.2 degrades
//                   crisp images (loses boxed-diagram labels) and compresses
//                   blurred images to fewer recognised characters.
//
// Uses only OffscreenCanvas + ImageBitmap — both are available in all modern
// browsers and require zero external dependencies.
// Returns the processed OffscreenCanvas (Tesseract.js loadImage handles it via
// OffscreenCanvas.convertToBlob internally).
const OCR_MIN_PX = 1500   // minimum long-edge pixels before upscaling

async function preprocessImageForOCR(imageFile) {
  // Decode the File into a bitmap — handles JPEG/PNG/WebP uniformly.
  const bitmap = await createImageBitmap(imageFile)
  const { width: srcW, height: srcH } = bitmap

  // 1. Scale: ensure the longer edge is at least OCR_MIN_PX.
  const longEdge = Math.max(srcW, srcH)
  const scale    = longEdge < OCR_MIN_PX ? OCR_MIN_PX / longEdge : 1
  const dstW = Math.round(srcW * scale)
  const dstH = Math.round(srcH * scale)

  const canvas = new OffscreenCanvas(dstW, dstH)
  const ctx    = canvas.getContext('2d')

  // 2. Grayscale: canvas filter applied before drawing so the image data
  //    already comes out single-channel. Avoids a second full-image pass.
  ctx.filter = 'grayscale(1)'
  ctx.drawImage(bitmap, 0, 0, dstW, dstH)
  bitmap.close()   // release GPU memory

  // 3. Gentle contrast enhancement: (v − 128) × 1.15 + 128, clamped.
  //    Lifts faded printed text without blowing out thin strokes.
  const imageData = ctx.getImageData(0, 0, dstW, dstH)
  const d = imageData.data
  const FACTOR = 1.15
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, (d[i] - 128) * FACTOR + 128))
    d[i] = d[i + 1] = d[i + 2] = v   // write to R, G, B (already greyscale; A unchanged)
  }
  ctx.putImageData(imageData, 0, 0)

  return canvas
}

// F-8D: module-level variable used to pass a partial-failure warning from
// resolveSourceText() to handleGenerate() without changing their signatures.
// Reset to '' at the start of every handleGenerate() call.
let _pendingPartialWarning = ''

/**
 * ExtractionResult — per-file result from the /extract API.
 * @typedef {{ file: File, filename: string, text: string, ok: boolean, error?: string }} ExtractionResult
 */

/**
 * extractAllFiles — F-8C: extract every file in source.files[] in parallel.
 *
 * Uses Promise.allSettled so a single failing file does not abort the others.
 * File order is preserved (allSettled returns results in input order).
 * Returns an array of ExtractionResult; callers decide how to combine / handle failures.
 */
async function extractAllFiles(files) {
  const settled = await Promise.allSettled(
    files.map((file) => graphApi.extractFile(file))
  )

  return settled.map((outcome, idx) => {
    const file = files[idx]
    if (outcome.status === 'fulfilled') {
      return {
        file,
        filename: file.name,
        text: outcome.value.data.extracted_text,
        ok: true,
      }
    }
    return {
      file,
      filename: file.name,
      text: '',
      ok: false,
      error: outcome.reason?.message ?? 'Extraction failed',
    }
  })
}

async function resolveSourceText(source) {
  if (source.sourceType === 'text') return source.text.trim()
  if (source.sourceType === 'document') {
    // F-8C+D: extract all files in parallel, then combine into one payload.
    const results = await extractAllFiles(source.files)

    const succeeded = results.filter((r) => r.ok)
    const failed    = results.filter((r) => !r.ok)

    // Req 10: all files failed → throw, do not call /ingest
    if (succeeded.length === 0) {
      throw new Error(
        `Could not extract text from any of your files. ` +
        `First error — "${failed[0].filename}": ${failed[0].error}`
      )
    }

    // Req 11+12: some files failed → continue with successful ones and
    // surface a clear warning in the error message via the partial-failure
    // prefix that rides along with the ingest result in handleGenerate().
    // We store the warning in a local variable and prepend it to any
    // downstream error so the user sees which files were skipped.
    const skippedWarning = failed.length > 0
      ? `Note: ${failed.length} file(s) could not be extracted and were skipped` +
        ` (${failed.map((r) => r.filename).join(', ')}). ` +
        'The tree was built from the remaining material.\n\n'
      : ''

    // Req 2+3: preserve original order; add "=== Material i of N: filename ==="
    // markers so NT-01 can see clean source boundaries.
    const N = succeeded.length
    const sections = succeeded.map((r, i) =>
      `=== Material ${i + 1} of ${N}: ${r.filename} ===\n\n${r.text}`
    )

    // Req 4+5: join and hard-trim to INGEST_MAX_CHARS (30 000, F-8E.1).
    // Client-side cap gives a clear message instead of a backend 422.
    const combined = sections.join('\n\n')
    const trimmed  = combined.length > INGEST_MAX_CHARS
      ? combined.slice(0, INGEST_MAX_CHARS)
      : combined

    if (trimmed.trim().length === 0) {
      throw new Error('No usable text could be extracted from the selected files.')
    }

    // Attach skipped-file warning to the returned string via a module-level
    // side-channel so handleGenerate() can surface it to the user without
    // changing its own signature.  We use a plain closure variable instead
    // of React state because resolveSourceText() is a module-level function.
    _pendingPartialWarning = skippedWarning

    return trimmed
  }
  if (source.sourceType === 'image') {
    // Dynamic import — WASM core only loaded when this branch is reached.
    const { createWorker } = await import('tesseract.js')
    const worker = await createWorker('eng')
    // PSM 11 (SPARSE_TEXT): collects all text regardless of layout.
    // Required for camera photos of TCP/IP diagrams, layer stacks, tables,
    // and other non-prose layouts where PSM 3 (AUTO) silently drops fragments.
    await worker.setParameters({ tessedit_pageseg_mode: '11' })
    const pages = []
    try {
      for (const imageFile of source.images) {
        // Preprocess: grayscale + contrast enhancement before recognition.
        // Raises Tesseract confidence on blurred/shadowed camera photos.
        const processed = await preprocessImageForOCR(imageFile)
        const { data: { text, confidence } } = await worker.recognize(processed)
        // Development-only confidence log — does not affect production behaviour.
        if (confidence < 50) {
          console.warn(
            `[NeuroTree OCR] Low confidence (${confidence.toFixed(0)}%) on "${imageFile.name}". ` +
            'Consider retaking the photo with better lighting.'
          )
        }
        // Normalize: PSM 11 emits a newline per fragment; collapse runs of 3+
        // blank lines so NT-01 receives a clean, readable block of text.
        const trimmed = text.trim().replace(/\n{3,}/g, '\n\n')
        if (trimmed) pages.push(trimmed)
      }
    } finally {
      // Always release the worker, whether OCR succeeded or threw.
      await worker.terminate()
    }
    const combined = pages.join('\n\n').slice(0, OCR_MAX_CHARS)
    if (!combined.trim()) {
      throw new Error(
        'No text could be extracted from the image(s). Please try a clearer photo.'
      )
    }
    return combined
  }
  return ''
}

/**
 * NewTreeDialog — main orchestrator (10.10.1, 10.11.23)
 *
 * State machine:
 *   step 1 → step 2 → step 3 (processing | success | error)
 *
 * Golden Rules enforced:
 *   - Never navigate directly to MapTree on + NewTree click
 *   - Modal stays open during AI processing
 *   - No fake progress percentages
 *   - Input preserved when navigating backward
 *   - Cancel confirmation if data exists
 */
export default function NewTreeDialog({ onClose }) {
  const { navigateTo, setGraphData, setActiveSessionId } = useApp()

  const [step, setStep]                   = useState(1)
  const [metadata, setMetadata]           = useState(INITIAL_METADATA)
  const [source, setSource]               = useState(INITIAL_SOURCE)
  const [processingState, setProcessingState] = useState('idle') // idle | processing | success | error
  const [activeStage, setActiveStage]     = useState(0)
  const [errorMsg, setErrorMsg]           = useState('')
  const [partialWarning, setPartialWarning] = useState('')  // F-8D: skipped-files notice
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const metadataValid = metadata.treeName.trim().length > 0 && metadata.learningGoal.trim().length > 0
  const sourceValid   = isSourceValid(source)
  const isProcessing  = processingState === 'processing'

  // ── Merge partial state updates (preserves other keys) ───────────────────
  const updateMetadata = useCallback((patch) => setMetadata((p) => ({ ...p, ...patch })), [])
  const updateSource   = useCallback((patch) => setSource((p) => ({ ...p, ...patch })), [])

  // ── Close guard ──────────────────────────────────────────────────────────
  function requestClose() {
    if (isProcessing) return  // Rule 9: do not close while processing
    const hasData = metadata.treeName || metadata.learningGoal || source.text || source.files.length || source.images.length
    if (hasData) { setConfirmDiscard(true); return }
    onClose()
  }

  // ── Step 3: generate ─────────────────────────────────────────────────────
  async function handleGenerate() {
    setStep(3)
    setProcessingState('processing')
    setActiveStage(0)
    setErrorMsg('')
    setPartialWarning('')
    _pendingPartialWarning = ''   // F-8D: reset before each run

    // F-6: generate a fresh UUID for each new tree — guarantees independence.
    // This is the session_id that the backend will use for all nodes/edges.
    const newSessionId = crypto.randomUUID()

    // Advance stages in lock-step with real work
    const advance = (n) => setActiveStage(n)

    try {
      advance(0)  // Reading material
      const text = await resolveSourceText(source)
      // F-8D: capture any partial-failure warning set by resolveSourceText()
      if (_pendingPartialWarning) setPartialWarning(_pendingPartialWarning)
      advance(1)  // Extracting

      // F-2: pass tree identity so backend can persist it on the Session row.
      // F-6: pass newSessionId so the backend creates an independent session.
      const { data } = await graphApi.ingest(
        text, metadata.treeName, metadata.learningGoal, newSessionId
      )
      advance(2)  // Identifying prerequisites

      // F-6: resolve and activate the session ID returned by ingest BEFORE
      // calling fetchGraph() so the Axios interceptor sends X-Session-ID on
      // the GET /api/v1/graph request.  setActiveSessionId also syncs React
      // state and sessionStorage, but we must update the mutable ref first.
      const resolvedSessionId = data?.session_id || newSessionId
      activeSession.id = resolvedSessionId          // sync Axios interceptor immediately
      setActiveSessionId(resolvedSessionId)         // sync React state + sessionStorage

      // Fetch the resulting graph — X-Session-ID is now set correctly
      const graphRes = await graphApi.fetchGraph()
      advance(3)  // Building tree

      // P0-5: detect empty graph — do not navigate if no nodes were produced
      const nodes = graphRes.data?.nodes ?? []
      if (nodes.length === 0) {
        throw new Error(
          'The AI could not extract any knowledge from your material. ' +
          'Please try with more detailed or structured content.'
        )
      }

      setGraphData(graphRes.data)
      advance(4)  // Preparing Skill Tree

      setProcessingState('success')

      // Navigate after brief success feedback (Rule: no sudden navigation)
      setTimeout(() => {
        onClose()
        navigateTo('skilltree', { treeName: metadata.treeName, learningGoal: metadata.learningGoal })
      }, 1200)

    } catch (err) {
      setProcessingState('error')
      setErrorMsg(err.message)
    }
  }

  function handleRetry() {
    handleGenerate()
  }

  function handleBackToSource() {
    setProcessingState('idle')
    setActiveStage(0)
    setStep(2)
  }

  // ── Keyboard close ────────────────────────────────────────────────────────
  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) requestClose()
  }

  const showStepper = processingState === 'idle' || processingState === 'error'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(14px)' }}
      onClick={handleBackdropClick}
    >
      {/* ── Main modal ─────────────────────────────────────────────────── */}
      <div
        className="glass-3 rounded-3xl w-full max-w-lg flex flex-col animate-[cardIn_0.25s_ease_forwards]
          max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-7 pt-7 pb-0 flex-shrink-0">
          <div>
            <h1 className="text-base font-semibold text-white/90">Create New Tree</h1>
            <p className="text-xs text-white/35 mt-0.5">Start a new personalized learning journey.</p>
          </div>
          <button
            onClick={requestClose}
            disabled={isProcessing}
            className="w-7 h-7 rounded-xl glass-1 flex items-center justify-center
              text-white/30 hover:text-white/70 text-xs transition-colors
              disabled:opacity-30 disabled:cursor-not-allowed ml-4 flex-shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Stepper */}
        {showStepper && (
          <div className="px-7 pt-6 flex-shrink-0">
            <NewTreeStepper currentStep={step} />
          </div>
        )}

        {/* Step content — scrollable */}
        <div className="flex-1 overflow-y-auto px-7 pb-2">
          {step === 1 && processingState === 'idle' && (
            <InitializationStep metadata={metadata} onChange={updateMetadata} />
          )}
          {step === 2 && processingState === 'idle' && (
            <KnowledgeSourceStep source={source} onChange={updateSource} />
          )}
          {step === 3 && processingState === 'processing' && (
            <AIProcessingState processingState="processing" activeStage={activeStage} />
          )}
          {step === 3 && processingState === 'success' && (
            <>
              <AIProcessingState processingState="success" activeStage={5} />
              {partialWarning && (
                <p className="text-xs mt-3 px-4 py-2 rounded-xl text-center"
                  style={{
                    background: 'rgba(251,191,36,0.07)',
                    border: '1px solid rgba(251,191,36,0.25)',
                    color: 'rgba(251,191,36,0.8)',
                  }}
                >
                  ⚠ {partialWarning.replace(/\n\n$/, '')}
                </p>
              )}
            </>
          )}
          {step === 3 && processingState === 'error' && (
            <GenerationError
              message={errorMsg}
              onRetry={handleRetry}
              onBackToSource={handleBackToSource}
              onCancel={onClose}
            />
          )}
        </div>

        {/* Footer actions */}
        {processingState === 'idle' && (
          <div className="flex items-center justify-between gap-3 px-7 py-5 flex-shrink-0"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            {/* Left: Back / Cancel */}
            <button
              onClick={step === 1 ? requestClose : () => setStep(1)}
              className="btn-liquid px-5 py-2 text-sm text-white/50"
            >
              {step === 1 ? 'Cancel' : '← Back'}
            </button>

            {/* Right: Next / Generate */}
            {step === 1 && (
              <button
                onClick={() => setStep(2)}
                disabled={!metadataValid}
                className="btn-liquid px-6 py-2 text-sm font-medium disabled:opacity-35"
                style={metadataValid ? {
                  borderColor: 'rgba(0,243,255,0.4)',
                  boxShadow:   '0 0 12px rgba(0,243,255,0.12)',
                } : {}}
              >
                Next: Add Source →
              </button>
            )}
            {step === 2 && (
              <button
                onClick={handleGenerate}
                disabled={!sourceValid}
                className="btn-liquid px-6 py-2 text-sm font-medium disabled:opacity-35"
                style={sourceValid ? {
                  borderColor: 'rgba(0,243,255,0.4)',
                  boxShadow:   '0 0 12px rgba(0,243,255,0.12)',
                } : {}}
              >
                Generate Skill Tree ⚡
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Discard confirmation overlay ──────────────────────────────── */}
      {confirmDiscard && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
        >
          <div className="glass-3 rounded-2xl p-7 max-w-sm w-full mx-4 animate-[cardIn_0.2s_ease_forwards]">
            <h3 className="text-sm font-semibold text-white/90 mb-1">Discard this Tree?</h3>
            <p className="text-xs text-white/40 mb-6">Your progress will be lost.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDiscard(false)}
                className="flex-1 btn-liquid py-2.5 text-sm text-white/60"
              >
                Keep Editing
              </button>
              <button
                onClick={onClose}
                className="flex-1 btn-liquid py-2.5 text-sm text-red-400/80"
                style={{ borderColor: 'rgba(239,68,68,0.25)' }}
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
