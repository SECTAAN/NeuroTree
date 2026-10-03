import { useState, useCallback } from 'react'
import { useApp }                from '../../context/AppContext'
import { graphApi }              from '../../services/api'
import NewTreeStepper            from './NewTreeStepper'
import InitializationStep        from './InitializationStep'
import KnowledgeSourceStep       from './KnowledgeSourceStep'
import AIProcessingState         from './AIProcessingState'
import GenerationError           from './GenerationError'

const INITIAL_METADATA = { treeName: '', learningGoal: '' }
const INITIAL_SOURCE   = { sourceType: 'text', text: '', file: null, images: [] }

// ── Source validation ────────────────────────────────────────────────────────
function isSourceValid(source) {
  if (source.sourceType === 'text')     return source.text.trim().length > 0
  if (source.sourceType === 'document') return source.file !== null
  if (source.sourceType === 'image')    return source.images.length > 0
  return false
}

// ── Extract plain text from source for backend ───────────────────────────────
// F-4: PDF/DOCX files are sent to POST /api/v1/material/extract which returns
// the real plain text (capped at 5 000 chars).
// Camera/OCR remains a placeholder until a future phase.
async function resolveSourceText(source) {
  if (source.sourceType === 'text') return source.text.trim()
  if (source.sourceType === 'document') {
    const { data } = await graphApi.extractFile(source.file)
    return data.extracted_text
  }
  if (source.sourceType === 'image') return `[Camera scan: ${source.images.length} image(s)]`
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
  const { navigateTo, setGraphData } = useApp()

  const [step, setStep]                   = useState(1)
  const [metadata, setMetadata]           = useState(INITIAL_METADATA)
  const [source, setSource]               = useState(INITIAL_SOURCE)
  const [processingState, setProcessingState] = useState('idle') // idle | processing | success | error
  const [activeStage, setActiveStage]     = useState(0)
  const [errorMsg, setErrorMsg]           = useState('')
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
    const hasData = metadata.treeName || metadata.learningGoal || source.text || source.file || source.images.length
    if (hasData) { setConfirmDiscard(true); return }
    onClose()
  }

  // ── Step 3: generate ─────────────────────────────────────────────────────
  async function handleGenerate() {
    setStep(3)
    setProcessingState('processing')
    setActiveStage(0)
    setErrorMsg('')

    // Advance stages in lock-step with real work
    const advance = (n) => setActiveStage(n)

    try {
      advance(0)  // Reading material
      const text = await resolveSourceText(source)
      advance(1)  // Extracting

      // F-2: pass tree identity so backend can persist it on the Session row
      const { data } = await graphApi.ingest(text, metadata.treeName, metadata.learningGoal)
      advance(2)  // Identifying prerequisites

      // Fetch the resulting graph
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
            <AIProcessingState processingState="success" activeStage={5} />
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
