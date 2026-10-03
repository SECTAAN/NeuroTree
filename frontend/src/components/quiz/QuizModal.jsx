import { useState, useEffect, useRef } from 'react'
import { quizApi } from '../../services/api'

/**
 * QuizModal — glassmorphism Level-3 modal for answering essay questions.
 *
 * Steps:
 *   loading   → fetching question from backend
 *   question  → user types answer and submits
 *   result    → AI score + mastery bar
 *   error     → generic circuit error
 *   cooldown  → HTTP 429 rate-limit: specific message + timed re-enable button
 */
export default function QuizModal({ node, onClose, onMasteryUpdate }) {
  // step: 'loading' | 'question' | 'result' | 'error' | 'cooldown'
  const [step, setStep]           = useState('loading')
  const [question, setQuestion]   = useState('')
  const [answer, setAnswer]       = useState('')
  const [result, setResult]       = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [errMsg, setErrMsg]       = useState('')

  // Cooldown timer (seconds remaining until retry button re-enables)
  const [cooldown, setCooldown]   = useState(0)
  const timerRef                  = useRef(null)

  // ── Start / clear countdown ───────────────────────────────────────────────
  function startCooldown(seconds) {
    setCooldown(seconds)
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  useEffect(() => () => clearInterval(timerRef.current), [])

  // ── Load question on mount ────────────────────────────────────────────────
  useEffect(() => {
    const nodeId = node?.id
    console.log('[QuizModal] Payload quiz node_id:', nodeId, '| full node data:', node)
    if (!nodeId) {
      setErrMsg(`node_id is undefined. Received node: ${JSON.stringify(node)}`)
      setStep('error')
      return
    }
    quizApi.generate(nodeId)
      .then(({ data }) => { setQuestion(data.question); setStep('question') })
      .catch((e) => {
        if (e.isRateLimit) {
          startCooldown(e.retryAfter ?? 30)
          setStep('cooldown')
        } else {
          setErrMsg(e.message)
          setStep('error')
        }
      })
  }, [node?.id])

  // ── Submit answer ─────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!answer.trim() || submitting) return
    setSubmitting(true)
    const nodeId = node?.id
    console.log('[QuizModal] Payload evaluate node_id:', nodeId, '| answer:', answer.trim().slice(0, 40))
    try {
      const { data } = await quizApi.evaluate(nodeId, answer.trim())
      setResult(data)
      onMasteryUpdate(nodeId, data.new_mastery_score, data.unlocked_new_nodes ?? [])
      setStep('result')
    } catch (e) {
      if (e.isRateLimit) {
        startCooldown(e.retryAfter ?? 30)
        setStep('cooldown')
      } else {
        setErrMsg(e.message)
        setStep('error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Retry from cooldown — go back to loading (re-fetch question)
  function handleRetryAfterCooldown() {
    if (cooldown > 0) return
    setStep('loading')
    const nodeId = node?.id
    quizApi.generate(nodeId)
      .then(({ data }) => { setQuestion(data.question); setStep('question') })
      .catch((e) => {
        if (e.isRateLimit) { startCooldown(e.retryAfter ?? 30); setStep('cooldown') }
        else               { setErrMsg(e.message); setStep('error') }
      })
  }

  const masteryColor =
    result?.new_mastery_score >= 70 ? '#00FFA3' :
    result?.new_mastery_score >= 60 ? '#00F3FF' :
    result?.new_mastery_score >= 40 ? '#4D7CFE' :
                                      'rgba(255,255,255,0.4)'

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

        {/* Node label */}
        <p className="text-xs text-white/35 tracking-widest uppercase mb-1">Quiz · {node.label}</p>

        {/* ── Loading ─────────────────────────────────────────────────── */}
        {step === 'loading' && (
          <div className="py-10 text-center">
            <div className="text-2xl mb-3 animate-pulse">⚡</div>
            <p className="text-sm text-white/40 font-mono tracking-widest">GENERATING QUESTION…</p>
          </div>
        )}

        {/* ── Question ────────────────────────────────────────────────── */}
        {step === 'question' && (
          <>
            <h2 className="text-base font-medium text-white/90 mt-3 mb-6 leading-relaxed">
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

        {/* ── Result ──────────────────────────────────────────────────── */}
        {step === 'result' && result && (
          <>
            <div className="mt-3 mb-5 flex items-center gap-3">
              <div
                className="text-2xl font-bold font-mono"
                style={{ color: masteryColor, textShadow: `0 0 12px ${masteryColor}66` }}
              >
                {result.ai_score}
              </div>
              <div>
                <p className="text-xs text-white/35">AI Score</p>
                <p className="text-sm font-medium" style={{ color: masteryColor }}>
                  {result.mastery_level}
                </p>
              </div>
            </div>

            {/* Feedback */}
            <div className="glass-1 rounded-2xl p-4 mb-5">
              <p className="text-sm text-white/75 leading-relaxed">{result.feedback}</p>
            </div>

            {/* New mastery bar */}
            <div className="mb-5">
              <div className="flex justify-between text-xs text-white/40 mb-1.5">
                <span>New Mastery</span>
                <span style={{ color: masteryColor }}>{result.new_mastery_score.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${result.new_mastery_score}%`,
                    background: `linear-gradient(90deg, ${masteryColor}, rgba(77,124,254,0.5))`,
                    boxShadow: `0 0 8px ${masteryColor}55`,
                  }}
                />
              </div>
            </div>

            {/* Unlocked nodes notification */}
            {result.unlocked_new_nodes?.length > 0 && (
              <div
                className="rounded-2xl p-3 mb-5 text-xs flex items-center gap-2"
                style={{
                  background: 'rgba(0,243,255,0.06)',
                  border: '1px solid rgba(0,243,255,0.2)',
                  color: '#00F3FF',
                }}
              >
                ⚡ {result.unlocked_new_nodes.length} new node{result.unlocked_new_nodes.length > 1 ? 's' : ''} unlocked!
              </div>
            )}

            <button onClick={onClose} className="w-full btn-liquid py-2.5 text-sm">
              Continue Learning
            </button>
          </>
        )}

        {/* ── Cooldown (HTTP 429) ──────────────────────────────────────── */}
        {step === 'cooldown' && (
          <div className="py-8 text-center">
            {/* Animated cooldown ring */}
            <div className="relative w-16 h-16 mx-auto mb-5">
              <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
                <circle
                  cx="32" cy="32" r="26"
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="4"
                />
                <circle
                  cx="32" cy="32" r="26"
                  fill="none"
                  stroke="rgba(0,243,255,0.5)"
                  strokeWidth="4"
                  strokeLinecap="round"
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

            <p
              className="text-sm font-medium mb-2"
              style={{ color: 'rgba(0,243,255,0.8)' }}
            >
              Sirkuit AI sedang cooldown
            </p>
            <p className="text-xs text-white/35 mb-6 leading-relaxed max-w-xs mx-auto">
              Terlalu banyak permintaan. Harap tunggu beberapa saat sebelum mencoba lagi.
            </p>

            {/* Retry button — disabled while countdown is running */}
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

        {/* ── Generic Error ────────────────────────────────────────────── */}
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
