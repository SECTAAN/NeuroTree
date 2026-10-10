import { useState, useEffect, useRef } from 'react'
import { quizApi } from '../../services/api'

/**
 * QuizModal — F-7C: 3-question quiz session.
 * Full palette: --nt-primary, --nt-coral, --nt-text, skeuomorphic surface.
 */

const TOTAL_QUESTIONS = 3

export default function QuizModal({ node, onClose, onMasteryUpdate }) {
  const [questionIndex, setQuestionIndex] = useState(0)
  const [step, setStep]             = useState('loading')
  const [question, setQuestion]     = useState('')
  const [answer, setAnswer]         = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errMsg, setErrMsg]         = useState('')
  const [interimData, setInterimData]   = useState(null)
  const [finalResult, setFinalResult]   = useState(null)
  const [cooldown, setCooldown] = useState(0)
  const timerRef                = useRef(null)
  const masteryFiredRef         = useRef(false)

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
    quizApi.generate(nodeId)
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
      const { data } = await quizApi.evaluate(nodeId, answer.trim(), qi)
      if (data.is_final) {
        setFinalResult(data)
        setStep('result')
        if (!masteryFiredRef.current) {
          masteryFiredRef.current = true
          onMasteryUpdate(nodeId, data.new_mastery_score, data.unlocked_new_nodes ?? [])
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

  // Mastery color — use palette tokens
  const masteryScore = finalResult?.new_mastery_score ?? 0
  const masteryIsDone = masteryScore >= 70
  const masteryColor = masteryIsDone ? 'var(--nt-primary)' :
                       masteryScore > 0 ? 'var(--nt-coral)' :
                       'var(--nt-text-3)'

  const interimScore = interimData?.ai_score ?? 0
  const interimColor = interimScore >= 70 ? 'var(--nt-primary)' :
                       interimScore > 0  ? 'var(--nt-coral)' :
                       'var(--nt-text-3)'

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
                background: isDone   ? 'var(--nt-primary)'
                          : isActive ? 'var(--nt-coral)'
                          :            'var(--nt-bg-3)',
                boxShadow: isActive ? '0 0 4px rgba(219,98,113,0.35)' : undefined,
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
      <div className="glass-3 rounded-3xl p-7 w-full max-w-lg animate-[cardIn_0.25s_ease_forwards] relative">

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-xl nt-card flex items-center justify-center text-xs transition-colors"
          style={{ color: 'var(--nt-text-3)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--nt-coral)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--nt-text-3)' }}
        >
          ✕
        </button>

        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <p className="nt-section-label">Quiz · {node.label}</p>
          {step !== 'error' && step !== 'cooldown' && (
            <p className="text-xs font-mono" style={{ color: 'var(--nt-text-3)' }}>
              {displayQuestionNumber}/{TOTAL_QUESTIONS}
            </p>
          )}
        </div>

        {step !== 'error' && step !== 'cooldown' && <ProgressDots />}

        {/* ── Loading ─────────────────────────────────────────────────────── */}
        {step === 'loading' && (
          <div className="py-10 text-center">
            <div className="nt-spinner mx-auto mb-4" />
            <p className="text-sm" style={{ color: 'var(--nt-text-3)' }}>Generating question…</p>
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
              style={{ caretColor: 'var(--nt-coral)' }}
            />
            <div className="flex justify-between items-center mb-5">
              <span className="text-xs" style={{ color: 'var(--nt-text-muted)' }}>{answer.length}/1000</span>
            </div>
            <button
              onClick={handleSubmit}
              disabled={!answer.trim() || submitting}
              className="nt-btn-primary w-full py-3 text-sm font-medium"
            >
              {submitting ? 'Evaluating…' : 'Submit Answer →'}
            </button>
          </>
        )}

        {/* ── Interim (Q0/Q1 feedback) ─────────────────────────────────────── */}
        {step === 'interim' && interimData && (
          <>
            <div className="mt-2 mb-4 flex items-center gap-3">
              <div className="text-2xl font-bold font-mono" style={{ color: interimColor }}>
                {interimData.ai_score}
              </div>
              <div>
                <p className="nt-section-label">Score · Question {questionIndex - 1 + 1}</p>
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
              Mastery updates after all {TOTAL_QUESTIONS} questions — keep going!
            </p>

            <button onClick={handleNextQuestion} className="nt-btn-primary w-full py-3 text-sm font-medium">
              Next Question →
            </button>
          </>
        )}

        {/* ── Final Result ─────────────────────────────────────────────────── */}
        {step === 'result' && finalResult && (
          <>
            <p className="nt-section-label mb-3 mt-1">Session Complete</p>

            <div className="mb-4 flex items-center gap-3">
              <div className="text-2xl font-bold font-mono" style={{ color: masteryColor }}>
                {finalResult.ai_score}
              </div>
              <div>
                <p className="nt-section-label">Final Score</p>
                <p className="text-sm font-medium" style={{ color: masteryColor }}>
                  {finalResult.mastery_level}
                </p>
              </div>
            </div>

            <div className="nt-card p-4 mb-5">
              <p className="text-sm leading-relaxed" style={{ color: 'var(--nt-text-2)' }}>
                {finalResult.feedback}
              </p>
            </div>

            {/* Mastery bar */}
            <div className="mb-5">
              <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--nt-text-3)' }}>
                <span>New Mastery</span>
                <span style={{ color: masteryColor }}>{finalResult.new_mastery_score.toFixed(1)}%</span>
              </div>
              <div className="nt-track h-2 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${finalResult.new_mastery_score}%`,
                    background: masteryIsDone
                      ? 'linear-gradient(90deg, var(--nt-primary), var(--nt-primary-lt))'
                      : 'linear-gradient(90deg, var(--nt-coral), var(--nt-coral-lt))',
                  }}
                />
              </div>
            </div>

            {/* Unlocked nodes */}
            {finalResult.unlocked_new_nodes?.length > 0 && (
              <div className="nt-notice-primary rounded-xl px-4 py-3 mb-5 text-xs flex items-center gap-2">
                ✦ {finalResult.unlocked_new_nodes.length} new node{finalResult.unlocked_new_nodes.length > 1 ? 's' : ''} unlocked!
              </div>
            )}

            <button onClick={onClose} className="nt-btn-primary w-full py-2.5 text-sm">
              Continue Learning
            </button>
          </>
        )}

        {/* ── Cooldown ─────────────────────────────────────────────────────── */}
        {step === 'cooldown' && (
          <div className="py-8 text-center">
            <div className="relative w-16 h-16 mx-auto mb-5">
              <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
                <circle cx="32" cy="32" r="26" fill="none"
                  stroke="var(--nt-border-2)" strokeWidth="4" />
                <circle cx="32" cy="32" r="26" fill="none"
                  stroke="var(--nt-coral)" strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 26}`}
                  strokeDashoffset={`${2 * Math.PI * 26 * (cooldown / 30)}`}
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <span
                className="absolute inset-0 flex items-center justify-center text-sm font-mono font-semibold"
                style={{ color: cooldown > 0 ? 'var(--nt-coral)' : 'var(--nt-primary-lt)' }}
              >
                {cooldown > 0 ? `${cooldown}s` : '✓'}
              </span>
            </div>
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--nt-text)' }}>
              Sirkuit AI sedang cooldown
            </p>
            <p className="text-xs mb-6 leading-relaxed max-w-xs mx-auto" style={{ color: 'var(--nt-text-3)' }}>
              Terlalu banyak permintaan. Harap tunggu beberapa saat sebelum mencoba lagi.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleRetryAfterCooldown}
                disabled={cooldown > 0}
                className="nt-btn-primary px-6 py-2.5 text-sm font-medium disabled:opacity-35 disabled:cursor-not-allowed"
              >
                {cooldown > 0 ? `Tunggu ${cooldown}s…` : 'Coba Lagi →'}
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
