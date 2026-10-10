import { useState, useEffect, useRef } from 'react'
import { masterLightApi } from '../../services/api'

/**
 * MasterLightModal — M-5: 3-question Master Light assessment.
 * Gold accent kept (warm gold #d4a017 / #e8c547) — distinct from quiz palette.
 * All neon/white replaced with --nt-* tokens or explicit gold values.
 */

const TOTAL_QUESTIONS = 3

// Gold accent values — Master Light stays gold in both themes
const GOLD       = '#d4a017'
const GOLD_LT    = '#e8c547'
const GOLD_ALPHA = 'rgba(212,160,23,0.50)'

export default function MasterLightModal({ node, onClose, onMasteryUpdate }) {
  const [questionIndex, setQuestionIndex] = useState(0)
  const [step, setStep]             = useState('loading')
  const [question, setQuestion]     = useState('')
  const [answer, setAnswer]         = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errMsg, setErrMsg]         = useState('')
  const [interimData, setInterimData] = useState(null)
  const [finalResult, setFinalResult] = useState(null)
  const [cooldown, setCooldown]     = useState(0)
  const timerRef                    = useRef(null)
  const masteryFiredRef             = useRef(false)

  function startCooldown(seconds) {
    setCooldown(seconds)
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  useEffect(() => () => clearInterval(timerRef.current), [])

  function loadQuestion(nodeId) {
    setStep('loading')
    setAnswer('')
    masterLightApi.generate(nodeId)
      .then(({ data }) => { setQuestion(data.question); setStep('question') })
      .catch((e) => {
        if (e.isRateLimit) { startCooldown(e.retryAfter ?? 30); setStep('cooldown') }
        else               { setErrMsg(e.message); setStep('error') }
      })
  }

  useEffect(() => {
    const nodeId = node?.id
    if (!nodeId) { setErrMsg(`node_id is undefined.`); setStep('error'); return }
    setQuestionIndex(0)
    setInterimData(null)
    setFinalResult(null)
    masteryFiredRef.current = false
    loadQuestion(nodeId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id])

  async function handleSubmit() {
    if (!answer.trim() || submitting) return
    setSubmitting(true)
    const nodeId = node?.id
    const qi     = questionIndex
    try {
      const { data } = await masterLightApi.evaluate(nodeId, answer.trim(), qi)
      if (data.is_final) {
        setFinalResult(data)
        setStep('result')
        if (!masteryFiredRef.current) {
          masteryFiredRef.current = true
          onMasteryUpdate?.(nodeId, data.master_light_mastery)
        }
      } else {
        setInterimData({ ai_score: data.ai_score, feedback: data.feedback })
        setQuestionIndex(qi + 1)
        setStep('interim')
      }
    } catch (e) {
      if (e.isRateLimit) { startCooldown(e.retryAfter ?? 30); setStep('cooldown') }
      else               { setErrMsg(e.message); setStep('error') }
    } finally {
      setSubmitting(false)
    }
  }

  function handleNextQuestion() {
    setInterimData(null)
    loadQuestion(node?.id)
  }

  function handleRetryAfterCooldown() {
    if (cooldown > 0) return
    loadQuestion(node?.id)
  }

  const displayQuestionNumber =
    step === 'interim' ? questionIndex
    : step === 'result' ? TOTAL_QUESTIONS
    : questionIndex + 1

  const mlMastery    = finalResult?.master_light_mastery ?? 0
  const masteryColor = mlMastery >= 70 ? GOLD : mlMastery > 0 ? GOLD_LT : 'var(--nt-text-3)'
  const interimColor = (interimData?.ai_score ?? 0) >= 70 ? GOLD :
                       (interimData?.ai_score ?? 0) >  0  ? GOLD_LT : 'var(--nt-text-3)'

  function ProgressDots() {
    return (
      <div className="flex items-center gap-1.5 mb-4">
        {Array.from({ length: TOTAL_QUESTIONS }).map((_, i) => {
          const isDone   = i < (step === 'result' ? TOTAL_QUESTIONS : questionIndex)
          const isActive = i === questionIndex && step !== 'result' && step !== 'interim'
          return (
            <div
              key={i}
              className="h-1 flex-1 rounded-full transition-all duration-500"
              style={{
                background: isDone   ? GOLD : isActive ? GOLD_ALPHA : 'var(--nt-bg-3)',
              }}
            />
          )
        })}
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 nt-modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="glass-3 rounded-3xl p-7 w-full max-w-lg relative animate-[cardIn_0.25s_ease_forwards]"
        style={{
          border: `1px solid rgba(212,160,23,0.22)`,
          boxShadow: 'var(--nt-shadow-out)',
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-xl nt-card flex items-center justify-center text-xs transition-colors"
          style={{ color: 'var(--nt-text-3)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = GOLD }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--nt-text-3)' }}
        >
          ✕
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span style={{ color: GOLD, fontSize: 14 }}>✦</span>
          <p className="nt-section-label" style={{ color: GOLD }}>
            Master Light · {node.label}
          </p>
        </div>

        {step !== 'error' && step !== 'cooldown' && (
          <div className="flex justify-end mb-1">
            <p className="text-xs font-mono" style={{ color: 'var(--nt-text-3)' }}>
              {displayQuestionNumber}/{TOTAL_QUESTIONS}
            </p>
          </div>
        )}

        {step !== 'error' && step !== 'cooldown' && <ProgressDots />}

        {/* ── Loading ─────────────────────────────────────────────────────── */}
        {step === 'loading' && (
          <div className="py-10 text-center">
            <div className="nt-spinner mx-auto mb-4" style={{ borderTopColor: GOLD }} />
            <p className="text-sm" style={{ color: 'var(--nt-text-3)' }}>
              Generating Master question…
            </p>
          </div>
        )}

        {/* ── Question ────────────────────────────────────────────────────── */}
        {step === 'question' && (
          <>
            <h2 className="text-base font-medium mt-2 mb-6 leading-relaxed" style={{ color: 'var(--nt-text)' }}>
              {question}
            </h2>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Tuliskan jawabanmu di sini…"
              rows={4}
              maxLength={1000}
              className="nt-input w-full rounded-2xl px-4 py-3 text-sm resize-none mb-2"
              style={{ caretColor: GOLD, borderColor: `rgba(212,160,23,0.20)` }}
            />
            <div className="flex justify-between items-center mb-5">
              <span className="text-xs" style={{ color: 'var(--nt-text-muted)' }}>{answer.length}/1000</span>
            </div>
            <button
              onClick={handleSubmit}
              disabled={!answer.trim() || submitting}
              className="w-full py-3 text-sm font-medium rounded-[50px] disabled:opacity-40 transition-all"
              style={{
                background: GOLD,
                color: '#fff',
                boxShadow: answer.trim()
                  ? `3px 3px 8px rgba(0,0,0,0.28), -1px -1px 4px rgba(255,255,255,0.12),
                     inset 1px 1px 2px rgba(255,255,255,0.18), inset -1px -1px 2px rgba(0,0,0,0.18)`
                  : 'none',
              }}
            >
              {submitting ? 'Evaluating…' : 'Submit Answer ✦'}
            </button>
          </>
        )}

        {/* ── Interim ─────────────────────────────────────────────────────── */}
        {step === 'interim' && interimData && (
          <>
            <div className="mt-2 mb-4 flex items-center gap-3">
              <div className="text-2xl font-bold font-mono" style={{ color: interimColor }}>
                {interimData.ai_score}
              </div>
              <div>
                <p className="nt-section-label">Score · Question {questionIndex}</p>
                <p className="text-xs" style={{ color: 'var(--nt-text-2)' }}>
                  {questionIndex} of {TOTAL_QUESTIONS} answered
                </p>
              </div>
            </div>

            <div className="nt-card p-4 mb-5">
              <p className="text-sm leading-relaxed" style={{ color: 'var(--nt-text-2)' }}>
                {interimData.feedback}
              </p>
            </div>

            <p className="text-xs text-center mb-5" style={{ color: 'var(--nt-text-3)' }}>
              Master Light mastery updates after all {TOTAL_QUESTIONS} questions — keep going!
            </p>

            <button
              onClick={handleNextQuestion}
              className="w-full py-3 text-sm font-medium rounded-[50px] transition-all"
              style={{
                background: 'rgba(212,160,23,0.12)',
                border: `1px solid rgba(212,160,23,0.35)`,
                color: GOLD,
              }}
            >
              Next Question →
            </button>
          </>
        )}

        {/* ── Final Result ─────────────────────────────────────────────────── */}
        {step === 'result' && finalResult && (
          <>
            <p className="nt-section-label mb-3 mt-1">Master Light Assessment Complete</p>

            <div className="mb-4 flex items-center gap-3">
              <div className="text-2xl font-bold font-mono" style={{ color: masteryColor }}>
                {finalResult.ai_score}
              </div>
              <div>
                <p className="nt-section-label">Final Score</p>
                <p className="text-sm font-medium" style={{ color: masteryColor }}>
                  {mlMastery >= 70 ? '✦ Mastered' : 'Keep Practicing'}
                </p>
              </div>
            </div>

            <div className="nt-card p-4 mb-5">
              <p className="text-sm leading-relaxed" style={{ color: 'var(--nt-text-2)' }}>
                {finalResult.feedback}
              </p>
            </div>

            {/* Master Light mastery bar */}
            <div className="mb-5">
              <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--nt-text-3)' }}>
                <span>Master Light Mastery</span>
                <span style={{ color: masteryColor }}>{mlMastery.toFixed(1)}%</span>
              </div>
              <div className="nt-track h-2 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${mlMastery}%`,
                    background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LT})`,
                  }}
                />
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2.5 text-sm rounded-[50px] transition-all"
              style={{
                background: 'rgba(212,160,23,0.10)',
                border: `1px solid rgba(212,160,23,0.30)`,
                color: GOLD,
              }}
            >
              Continue Learning ✦
            </button>
          </>
        )}

        {/* ── Cooldown ─────────────────────────────────────────────────────── */}
        {step === 'cooldown' && (
          <div className="py-8 text-center">
            <div className="relative w-16 h-16 mx-auto mb-5">
              <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
                <circle cx="32" cy="32" r="26" fill="none" stroke="var(--nt-border-2)" strokeWidth="4" />
                <circle cx="32" cy="32" r="26" fill="none"
                  stroke={GOLD_ALPHA} strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 26}`}
                  strokeDashoffset={`${2 * Math.PI * 26 * (cooldown / 30)}`}
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <span
                className="absolute inset-0 flex items-center justify-center text-sm font-mono font-semibold"
                style={{ color: cooldown > 0 ? GOLD : GOLD_LT }}
              >
                {cooldown > 0 ? `${cooldown}s` : '✓'}
              </span>
            </div>
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--nt-text)' }}>
              Sirkuit AI sedang cooldown
            </p>
            <p className="text-xs mb-6 leading-relaxed max-w-xs mx-auto" style={{ color: 'var(--nt-text-3)' }}>
              Terlalu banyak permintaan. Harap tunggu sebelum mencoba lagi.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleRetryAfterCooldown}
                disabled={cooldown > 0}
                className="px-6 py-2.5 text-sm font-medium rounded-[50px] disabled:opacity-35 disabled:cursor-not-allowed transition-all"
                style={{
                  background: cooldown === 0 ? 'rgba(212,160,23,0.12)' : 'transparent',
                  border: `1px solid ${cooldown === 0 ? `rgba(212,160,23,0.40)` : 'var(--nt-border)'}`,
                  color: cooldown === 0 ? GOLD : 'var(--nt-text-3)',
                }}
              >
                {cooldown > 0 ? `Tunggu ${cooldown}s…` : 'Coba Lagi ✦'}
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2.5 text-sm transition-colors"
                style={{ color: 'var(--nt-text-3)' }}
              >
                Tutup
              </button>
            </div>
          </div>
        )}

        {/* ── Generic Error ─────────────────────────────────────────────────── */}
        {step === 'error' && (
          <div className="py-8 text-center">
            <p className="text-sm mb-2" style={{ color: 'var(--nt-text-2)' }}>Terjadi kesalahan</p>
            <p className="text-xs mb-6" style={{ color: 'var(--nt-text-3)' }}>{errMsg}</p>
            <button onClick={onClose} className="nt-btn-secondary px-6 py-2 text-sm">Close</button>
          </div>
        )}
      </div>
    </div>
  )
}
