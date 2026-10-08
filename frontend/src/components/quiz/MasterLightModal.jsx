import { useState, useEffect, useRef } from 'react'
import { masterLightApi } from '../../services/api'

/**
 * MasterLightModal — M-5: 3-question Master Light assessment.
 *
 * Session flow (question_index 0 → 1 → 2):
 *   loading  → fetching question from /master-light/generate
 *   question → user types answer and submits
 *   interim  → Q0/Q1 feedback (is_final=false): show score, load next question
 *   result   → Q2 (is_final=true): show committed master_light_mastery
 *   error    → generic error
 *   cooldown → HTTP 429 rate-limit
 *
 * Rules (M-5 spec):
 *   - Only opens when master_light_unlocked=true (enforced by MasterLightNode).
 *   - master_light_mastery is committed only on Q2 (is_final=true).
 *   - Does NOT alter normal knowledge-node quiz behavior.
 *   - onMasteryUpdate is called with (nodeId, master_light_mastery) on is_final.
 */

const TOTAL_QUESTIONS = 3

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
    if (!nodeId) {
      setErrMsg(`node_id is undefined. Received node: ${JSON.stringify(node)}`)
      setStep('error')
      return
    }
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

  const mlMastery   = finalResult?.master_light_mastery ?? 0
  const masteryColor =
    mlMastery >= 70 ? '#FFD700' :
    mlMastery >  0  ? '#FFE87A' :
                      'rgba(255,255,255,0.4)'

  const interimScoreColor =
    (interimData?.ai_score ?? 0) >= 70 ? '#FFD700' :
    (interimData?.ai_score ?? 0) >  0  ? '#FFE87A' :
                                         'rgba(255,255,255,0.4)'

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
                background: isDone   ? '#FFD700'
                          : isActive ? 'rgba(255,215,0,0.6)'
                          :            'rgba(255,255,255,0.1)',
                boxShadow: isActive ? '0 0 6px rgba(255,215,0,0.4)' : undefined,
              }}
            />
          )
        })}
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(14px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="glass-3 rounded-3xl p-7 w-full max-w-lg relative animate-[cardIn_0.25s_ease_forwards]"
        style={{
          border: '1px solid rgba(255,210,40,0.25)',
          boxShadow: '0 0 40px rgba(255,190,30,0.10)',
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-xl glass-1 text-white/30
            hover:text-white/70 text-xs transition-colors flex items-center justify-center"
        >
          ✕
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span style={{ color: 'rgba(255,210,40,0.8)', fontSize: 14 }}>✦</span>
          <p className="text-xs tracking-widest uppercase" style={{ color: 'rgba(255,210,40,0.7)' }}>
            Master Light · {node.label}
          </p>
        </div>

        {step !== 'error' && step !== 'cooldown' && (
          <div className="flex justify-end mb-1">
            <p className="text-xs text-white/30 font-mono">
              {displayQuestionNumber}/{TOTAL_QUESTIONS}
            </p>
          </div>
        )}

        {step !== 'error' && step !== 'cooldown' && <ProgressDots />}

        {/* ── Loading ─────────────────────────────────────────────────────── */}
        {step === 'loading' && (
          <div className="py-10 text-center">
            <div className="text-2xl mb-3 animate-pulse">✦</div>
            <p className="text-sm text-white/40 font-mono tracking-widest">
              GENERATING MASTER QUESTION…
            </p>
          </div>
        )}

        {/* ── Question ────────────────────────────────────────────────────── */}
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
                bg-white/5 border border-white/10 focus:border-yellow-400/40
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
                borderColor: answer.trim() ? 'rgba(255,210,40,0.45)' : undefined,
                boxShadow:   answer.trim() ? '0 0 14px rgba(255,210,40,0.15)' : undefined,
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
              <div
                className="text-2xl font-bold font-mono"
                style={{ color: interimScoreColor, textShadow: `0 0 12px ${interimScoreColor}66` }}
              >
                {interimData.ai_score}
              </div>
              <div>
                <p className="text-xs text-white/35">Score · Question {questionIndex}</p>
                <p className="text-xs text-white/50">
                  {questionIndex} of {TOTAL_QUESTIONS} answered
                </p>
              </div>
            </div>

            <div className="glass-1 rounded-2xl p-4 mb-5">
              <p className="text-sm text-white/75 leading-relaxed">{interimData.feedback}</p>
            </div>

            <p className="text-xs text-white/25 text-center mb-5">
              Master Light mastery updates after all {TOTAL_QUESTIONS} questions — keep going!
            </p>

            <button
              onClick={handleNextQuestion}
              className="w-full btn-liquid py-3 text-sm font-medium"
              style={{
                borderColor: 'rgba(255,210,40,0.45)',
                boxShadow:   '0 0 14px rgba(255,210,40,0.12)',
              }}
            >
              Next Question →
            </button>
          </>
        )}

        {/* ── Final Result ─────────────────────────────────────────────────── */}
        {step === 'result' && finalResult && (
          <>
            <p className="text-xs text-white/40 tracking-widest uppercase mb-3 mt-1">
              Master Light Assessment Complete
            </p>

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
                  {mlMastery >= 70 ? '✦ Mastered' : 'Keep Practicing'}
                </p>
              </div>
            </div>

            <div className="glass-1 rounded-2xl p-4 mb-5">
              <p className="text-sm text-white/75 leading-relaxed">{finalResult.feedback}</p>
            </div>

            {/* Master Light mastery bar */}
            <div className="mb-5">
              <div className="flex justify-between text-xs text-white/40 mb-1.5">
                <span>Master Light Mastery</span>
                <span style={{ color: masteryColor }}>{mlMastery.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${mlMastery}%`,
                    background: `linear-gradient(90deg, #FFD700, rgba(255,180,30,0.6))`,
                    boxShadow: `0 0 8px rgba(255,210,40,0.5)`,
                  }}
                />
              </div>
            </div>

            <button onClick={onClose} className="w-full btn-liquid py-2.5 text-sm"
              style={{ borderColor: 'rgba(255,210,40,0.35)' }}
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
                <circle cx="32" cy="32" r="26" fill="none"
                  stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
                <circle cx="32" cy="32" r="26" fill="none"
                  stroke="rgba(255,210,40,0.5)" strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 26}`}
                  strokeDashoffset={`${2 * Math.PI * 26 * (cooldown / 30)}`}
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <span
                className="absolute inset-0 flex items-center justify-center text-sm font-mono font-semibold"
                style={{ color: cooldown > 0 ? 'rgba(255,210,40,0.8)' : 'rgba(255,215,0,0.9)' }}
              >
                {cooldown > 0 ? `${cooldown}s` : '✓'}
              </span>
            </div>
            <p className="text-sm font-medium mb-2" style={{ color: 'rgba(255,210,40,0.8)' }}>
              Sirkuit AI sedang cooldown
            </p>
            <p className="text-xs text-white/35 mb-6 leading-relaxed max-w-xs mx-auto">
              Terlalu banyak permintaan. Harap tunggu sebelum mencoba lagi.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleRetryAfterCooldown}
                disabled={cooldown > 0}
                className="btn-liquid px-6 py-2.5 text-sm font-medium disabled:opacity-35 disabled:cursor-not-allowed"
                style={{
                  borderColor: cooldown === 0 ? 'rgba(255,210,40,0.5)' : undefined,
                  boxShadow:   cooldown === 0 ? '0 0 14px rgba(255,210,40,0.2)' : undefined,
                }}
              >
                {cooldown > 0 ? `Tunggu ${cooldown}s…` : 'Coba Lagi ✦'}
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

        {/* ── Generic Error ─────────────────────────────────────────────────── */}
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
