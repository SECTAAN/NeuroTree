import { useState, useEffect, useRef } from 'react'
import { quizApi } from '../../services/api'

/**
 * QuizModal — F-7C: 3-question quiz session.
 *
 * Session flow (question_index 0 → 1 → 2):
 *   loading  → fetching first question from backend (question_index resets to 0)
 *   question → user types answer and submits
 *   interim  → Q0/Q1 response received (is_final=false):
 *              show brief per-question feedback, then load next question
 *   result   → Q2 response received (is_final=true):
 *              show committed mastery + unlock result
 *   error    → generic circuit error
 *   cooldown → HTTP 429 rate-limit: specific message + timed re-enable button
 *
 * Rules:
 *   - onMasteryUpdate is called ONLY when is_final=true (after Q2).
 *   - Mastery bar and lamp are NOT updated on Q0/Q1 responses.
 *   - Closing the modal before Q2 leaves quiz_session_scores intact on the
 *     backend; the next open always sends question_index=0 which resets them.
 *   - Duplicate submission is blocked while `submitting` is true.
 */

const TOTAL_QUESTIONS = 3

export default function QuizModal({ node, onClose, onMasteryUpdate }) {
  // ── Session state ──────────────────────────────────────────────────────────
  // questionIndex: which question we are currently answering (0 | 1 | 2).
  // Always starts at 0 when the modal mounts or restarts.
  const [questionIndex, setQuestionIndex] = useState(0)

  // step: 'loading' | 'question' | 'interim' | 'result' | 'error' | 'cooldown'
  const [step, setStep]             = useState('loading')
  const [question, setQuestion]     = useState('')
  const [answer, setAnswer]         = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errMsg, setErrMsg]         = useState('')

  // interimData: { ai_score, feedback } — displayed while loading next question
  const [interimData, setInterimData]   = useState(null)
  // finalResult: full Q2 response — mastery committed
  const [finalResult, setFinalResult]   = useState(null)

  // Cooldown timer
  const [cooldown, setCooldown] = useState(0)
  const timerRef                = useRef(null)

  // Guard: prevent double-fire of onMasteryUpdate if re-render races
  const masteryFiredRef = useRef(false)

  // ── Helpers ────────────────────────────────────────────────────────────────
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

  // ── Load a question from the backend ──────────────────────────────────────
  // Called on mount (for Q0) and after each interim result (for Q1, Q2).
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

  // ── Mount: always start fresh at Q0 ───────────────────────────────────────
  useEffect(() => {
    const nodeId = node?.id
    console.log('[QuizModal] Starting session for node_id:', nodeId)
    if (!nodeId) {
      setErrMsg(`node_id is undefined. Received node: ${JSON.stringify(node)}`)
      setStep('error')
      return
    }
    // Reset full session state (handles re-open after early close)
    setQuestionIndex(0)
    setInterimData(null)
    setFinalResult(null)
    masteryFiredRef.current = false
    loadQuestion(nodeId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id])

  // ── Submit answer ──────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!answer.trim() || submitting) return
    setSubmitting(true)
    const nodeId = node?.id
    const qi     = questionIndex
    console.log('[QuizModal] evaluate node_id:', nodeId, '| qi:', qi, '| answer:', answer.trim().slice(0, 40))
    try {
      const { data } = await quizApi.evaluate(nodeId, answer.trim(), qi)

      if (data.is_final) {
        // ── Q2: session complete — show committed mastery ────────────────
        setFinalResult(data)
        setStep('result')
        if (!masteryFiredRef.current) {
          masteryFiredRef.current = true
          onMasteryUpdate(nodeId, data.new_mastery_score, data.unlocked_new_nodes ?? [])
        }
      } else {
        // ── Q0 / Q1: show interim feedback, then load next question ──────
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

  // ── Advance from interim → next question ───────────────────────────────────
  function handleNextQuestion() {
    const nodeId = node?.id
    setInterimData(null)
    loadQuestion(nodeId)
  }

  // ── Retry from cooldown ────────────────────────────────────────────────────
  function handleRetryAfterCooldown() {
    if (cooldown > 0) return
    loadQuestion(node?.id)
  }

  // ── Derived display values ─────────────────────────────────────────────────
  // Progress label uses the index of the question being answered (1-based).
  // During 'interim' we have just submitted questionIndex-1 (already incremented).
  const displayQuestionNumber =
    step === 'interim' ? questionIndex      // already incremented post-submit
    : step === 'result' ? TOTAL_QUESTIONS   // session complete
    : questionIndex + 1                     // currently answering

  const masteryColor =
    finalResult?.new_mastery_score >= 70 ? '#00FFA3' :
    finalResult?.new_mastery_score >   0 ? '#00F3FF' :
                                           'rgba(255,255,255,0.4)'

  // Per-question feedback color (interim — not final mastery)
  const interimScoreColor =
    (interimData?.ai_score ?? 0) >= 70 ? '#00FFA3' :
    (interimData?.ai_score ?? 0) >  0  ? '#00F3FF' :
                                         'rgba(255,255,255,0.4)'

  // ── Progress bar (3 segments) ──────────────────────────────────────────────
  function ProgressDots() {
    return (
      <div className="flex items-center gap-1.5 mb-4">
        {Array.from({ length: TOTAL_QUESTIONS }).map((_, i) => {
          // A segment is 'done' if we are past it; 'active' if current; 'pending' otherwise
          const isDone   = i < (step === 'result' ? TOTAL_QUESTIONS : questionIndex)
          const isActive = i === questionIndex && step !== 'result' && step !== 'interim'
          return (
            <div
              key={i}
              className="h-1 flex-1 rounded-full transition-all duration-500"
              style={{
                background: isDone   ? '#00FFA3'
                          : isActive ? 'rgba(0,243,255,0.7)'
                          :            'rgba(255,255,255,0.1)',
                boxShadow: isActive ? '0 0 6px rgba(0,243,255,0.4)' : undefined,
              }}
            />
          )
        })}
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(12px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="glass-3 rounded-3xl p-7 w-full max-w-lg animate-[cardIn_0.25s_ease_forwards] relative">

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-xl glass-1 text-white/30
            hover:text-white/70 text-xs transition-colors flex items-center justify-center"
        >
          ✕
        </button>

        {/* Node label + session progress counter */}
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-white/35 tracking-widest uppercase">Quiz · {node.label}</p>
          {step !== 'error' && step !== 'cooldown' && (
            <p className="text-xs text-white/30 font-mono">
              {displayQuestionNumber}/{TOTAL_QUESTIONS}
            </p>
          )}
        </div>

        {/* Progress segments (hidden on error/cooldown) */}
        {step !== 'error' && step !== 'cooldown' && <ProgressDots />}

        {/* ── Loading ───────────────────────────────────────────────────── */}
        {step === 'loading' && (
          <div className="py-10 text-center">
            <div className="text-2xl mb-3 animate-pulse">⚡</div>
            <p className="text-sm text-white/40 font-mono tracking-widest">GENERATING QUESTION…</p>
          </div>
        )}

        {/* ── Question ──────────────────────────────────────────────────── */}
        {step === 'question' && (
          <>
            <h2 className="text-base font-medium text-white/90 mt-2 mb-6 leading-relaxed">
              {question}
            </h2>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Tuliskan jawabanmu di sini…"
              rows={4}
              maxLength={1000}
              className="w-full rounded-2xl px-4 py-3 text-sm text-white/85 outline-none resize-none
                bg-white/5 border border-white/10 focus:border-accent-cyan
                placeholder:text-white/20 transition-colors mb-2"
            />
            <div className="flex justify-between items-center mb-5">
              <span className="text-xs text-white/20">{answer.length}/1000</span>
            </div>
            <button
              onClick={handleSubmit}
              disabled={!answer.trim() || submitting}
              className="w-full btn-liquid py-3 text-sm font-medium disabled:opacity-40"
              style={{
                borderColor: answer.trim() ? 'rgba(0,243,255,0.4)' : undefined,
                boxShadow:   answer.trim() ? '0 0 14px rgba(0,243,255,0.15)' : undefined,
              }}
            >
              {submitting ? 'Evaluating…' : 'Submit Answer ⚡'}
            </button>
          </>
        )}

        {/* ── Interim (Q0 / Q1 feedback — mastery NOT yet committed) ────── */}
        {step === 'interim' && interimData && (
          <>
            {/* Per-question score badge */}
            <div className="mt-2 mb-4 flex items-center gap-3">
              <div
                className="text-2xl font-bold font-mono"
                style={{ color: interimScoreColor, textShadow: `0 0 12px ${interimScoreColor}66` }}
              >
                {interimData.ai_score}
              </div>
              <div>
                <p className="text-xs text-white/35">Score · Question {questionIndex - 1 + 1}</p>
                <p className="text-xs text-white/50">
                  {questionIndex} of {TOTAL_QUESTIONS} answered
                </p>
              </div>
            </div>

            {/* Brief feedback */}
            <div className="glass-1 rounded-2xl p-4 mb-5">
              <p className="text-sm text-white/75 leading-relaxed">{interimData.feedback}</p>
            </div>

            {/* Note: mastery not updated until all 3 questions are answered */}
            <p className="text-xs text-white/25 text-center mb-5">
              Mastery updates after all {TOTAL_QUESTIONS} questions — keep going!
            </p>

            <button
              onClick={handleNextQuestion}
              className="w-full btn-liquid py-3 text-sm font-medium"
              style={{
                borderColor: 'rgba(0,243,255,0.4)',
                boxShadow:   '0 0 14px rgba(0,243,255,0.15)',
              }}
            >
              Next Question →
            </button>
          </>
        )}

        {/* ── Final Result (Q2 — mastery committed) ─────────────────────── */}
        {step === 'result' && finalResult && (
          <>
            {/* Session complete label */}
            <p className="text-xs text-white/40 tracking-widest uppercase mb-3 mt-1">
              Session Complete
            </p>

            {/* Last question's raw score */}
            <div className="mb-4 flex items-center gap-3">
              <div
                className="text-2xl font-bold font-mono"
                style={{ color: masteryColor, textShadow: `0 0 12px ${masteryColor}66` }}
              >
                {finalResult.ai_score}
              </div>
              <div>
                <p className="text-xs text-white/35">Final Score</p>
                <p className="text-sm font-medium" style={{ color: masteryColor }}>
                  {finalResult.mastery_level}
                </p>
              </div>
            </div>

            {/* Last question's feedback */}
            <div className="glass-1 rounded-2xl p-4 mb-5">
              <p className="text-sm text-white/75 leading-relaxed">{finalResult.feedback}</p>
            </div>

            {/* Committed mastery bar */}
            <div className="mb-5">
              <div className="flex justify-between text-xs text-white/40 mb-1.5">
                <span>New Mastery</span>
                <span style={{ color: masteryColor }}>{finalResult.new_mastery_score.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${finalResult.new_mastery_score}%`,
                    background: `linear-gradient(90deg, ${masteryColor}, rgba(77,124,254,0.5))`,
                    boxShadow: `0 0 8px ${masteryColor}55`,
                  }}
                />
              </div>
            </div>

            {/* Unlocked nodes notification */}
            {finalResult.unlocked_new_nodes?.length > 0 && (
              <div
                className="rounded-2xl p-3 mb-5 text-xs flex items-center gap-2"
                style={{
                  background: 'rgba(0,243,255,0.06)',
                  border: '1px solid rgba(0,243,255,0.2)',
                  color: '#00F3FF',
                }}
              >
                ⚡ {finalResult.unlocked_new_nodes.length} new node{finalResult.unlocked_new_nodes.length > 1 ? 's' : ''} unlocked!
              </div>
            )}

            <button onClick={onClose} className="w-full btn-liquid py-2.5 text-sm">
              Continue Learning
            </button>
          </>
        )}

        {/* ── Cooldown (HTTP 429) ────────────────────────────────────────── */}
        {step === 'cooldown' && (
          <div className="py-8 text-center">
            <div className="relative w-16 h-16 mx-auto mb-5">
              <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
                <circle cx="32" cy="32" r="26" fill="none"
                  stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
                <circle cx="32" cy="32" r="26" fill="none"
                  stroke="rgba(0,243,255,0.5)" strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 26}`}
                  strokeDashoffset={`${2 * Math.PI * 26 * (cooldown / 30)}`}
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <span
                className="absolute inset-0 flex items-center justify-center text-sm font-mono font-semibold"
                style={{ color: cooldown > 0 ? 'rgba(0,243,255,0.8)' : 'rgba(0,255,163,0.8)' }}
              >
                {cooldown > 0 ? `${cooldown}s` : '✓'}
              </span>
            </div>
            <p className="text-sm font-medium mb-2" style={{ color: 'rgba(0,243,255,0.8)' }}>
              Sirkuit AI sedang cooldown
            </p>
            <p className="text-xs text-white/35 mb-6 leading-relaxed max-w-xs mx-auto">
              Terlalu banyak permintaan. Harap tunggu beberapa saat sebelum mencoba lagi.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleRetryAfterCooldown}
                disabled={cooldown > 0}
                className="btn-liquid px-6 py-2.5 text-sm font-medium disabled:opacity-35 disabled:cursor-not-allowed transition-all duration-300"
                style={{
                  borderColor: cooldown === 0 ? 'rgba(0,243,255,0.5)' : undefined,
                  boxShadow:   cooldown === 0 ? '0 0 14px rgba(0,243,255,0.2)' : undefined,
                }}
              >
                {cooldown > 0 ? `Tunggu ${cooldown}s…` : 'Coba Lagi ⚡'}
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2.5 text-sm text-white/35 hover:text-white/60 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        )}

        {/* ── Generic Error ──────────────────────────────────────────────── */}
        {step === 'error' && (
          <div className="py-8 text-center">
            <p className="text-white/50 text-sm mb-2">Sirkuit AI terputus</p>
            <p className="text-white/25 text-xs mb-6">{errMsg}</p>
            <button onClick={onClose} className="btn-liquid px-6 py-2 text-sm">Close</button>
          </div>
        )}

      </div>
    </div>
  )
}
