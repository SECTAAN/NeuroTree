import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { careerApi } from '../services/api'
import HamburgerSidebar from '../components/layout/HamburgerSidebar'

/**
 * CareerMap — F-3: wired to POST /api/v1/career/pathway (NT-05).
 *
 * States:
 *   idle       → career goal input form
 *   loading    → spinner while NT-05 runs
 *   result     → gap analysis + recommended path
 *   error      → error message with retry
 */
export default function CareerMap() {
  const { navigateTo } = useApp()

  const [goal, setGoal]           = useState('')
  const [step, setStep]           = useState('idle')   // idle | loading | result | error
  const [result, setResult]       = useState(null)
  const [errMsg, setErrMsg]       = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = goal.trim()
    if (!trimmed) return
    setStep('loading')
    setErrMsg('')
    try {
      const { data } = await careerApi.pathway(trimmed)
      setResult(data)
      setStep('result')
    } catch (err) {
      setErrMsg(err.message || 'NT-05 gagal. Coba lagi.')
      setStep('error')
    }
  }

  function handleReset() {
    setStep('idle')
    setResult(null)
    setErrMsg('')
  }

  return (
    <div className="w-full h-full bg-app flex flex-col overflow-hidden">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header
        className="clay-header mx-3 mt-3 mb-2 rounded-2xl flex-shrink-0
          flex items-center justify-between px-4 gap-3"
        style={{ height: 56 }}
      >
        <div className="flex items-center gap-3">
          {/* Hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="clay-icon w-7 h-7 rounded-lg flex flex-col items-center justify-center gap-[4px]
              transition-colors hover:opacity-80"
            aria-label="Open menu"
          >
            <span className="block w-3.5 h-px rounded-full bg-slate-500 dark:bg-slate-400" />
            <span className="block w-3.5 h-px rounded-full bg-slate-500 dark:bg-slate-400" />
            <span className="block w-3.5 h-px rounded-full bg-slate-500 dark:bg-slate-400" />
          </button>

          <button
            onClick={() => navigateTo('dashboard')}
            className="text-xs text-slate-500 dark:text-slate-400
              hover:text-slate-800 dark:hover:text-slate-200
              transition-colors flex items-center gap-1"
          >
            ← Dashboard
          </button>
        </div>

        <span
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'rgba(0,243,255,0.7)' }}
        >
          Career Map
        </span>

        {/* Back to skill tree */}
        <button
          onClick={() => navigateTo('skilltree')}
          className="text-xs text-slate-500 dark:text-slate-400
            hover:text-slate-800 dark:hover:text-slate-200
            transition-colors flex items-center gap-1"
        >
          Skill Tree →
        </button>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto px-4 py-5">

        {/* ── IDLE: goal input ─────────────────────────────────────────── */}
        {step === 'idle' && (
          <div className="max-w-lg mx-auto">
            <div className="mb-6">
              <p className="text-xs tracking-widest uppercase text-slate-400 dark:text-slate-500 mb-1">
                Knowledge Gap Analysis
              </p>
              <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
                Where do you want to go?
              </h1>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                Enter your target career goal and AI will analyse your current knowledge to find gaps and build a learning path.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="clay-card rounded-3xl p-6 flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">
                  Career goal
                </label>
                <input
                  type="text"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="e.g. Network Engineer, AI Engineer, Data Scientist…"
                  maxLength={200}
                  required
                  className="w-full rounded-xl px-4 py-2.5 text-sm
                    bg-white/60 dark:bg-black/20
                    border border-slate-200 dark:border-white/10
                    text-slate-800 dark:text-slate-100
                    placeholder-slate-400 dark:placeholder-slate-600
                    focus:outline-none focus:ring-2 focus:ring-cyan-400/40
                    transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={!goal.trim()}
                className="clay-card w-full rounded-xl py-2.5 text-sm font-medium
                  text-cyan-600 dark:text-cyan-400
                  disabled:opacity-40 disabled:cursor-not-allowed
                  hover:-translate-y-0.5 active:translate-y-0
                  transition-all duration-200"
                style={{ borderColor: 'rgba(0,243,255,0.25)' }}
              >
                Analyse Career Gap ⚡
              </button>
            </form>
          </div>
        )}

        {/* ── LOADING ──────────────────────────────────────────────────── */}
        {step === 'loading' && (
          <div className="flex items-center justify-center h-48">
            <div className="glass-3 rounded-2xl px-10 py-8 text-center">
              <div className="text-2xl mb-3 animate-pulse">🗺️</div>
              <p className="text-sm font-mono tracking-widest text-white/60">
                ANALYSING KNOWLEDGE GAP…
              </p>
              <p className="text-xs text-white/30 mt-1">NT-05 is running</p>
            </div>
          </div>
        )}

        {/* ── ERROR ────────────────────────────────────────────────────── */}
        {step === 'error' && (
          <div className="max-w-lg mx-auto">
            <div className="glass-3 rounded-2xl px-6 py-8 text-center">
              <p className="text-white/60 text-sm mb-1">Analysis failed</p>
              <p className="text-white/30 text-xs mb-5">{errMsg}</p>
              <button
                onClick={handleReset}
                className="clay-card px-6 py-2 rounded-xl text-xs
                  text-cyan-600 dark:text-cyan-400
                  hover:-translate-y-0.5 transition-transform duration-200"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* ── RESULT ───────────────────────────────────────────────────── */}
        {step === 'result' && result && (
          <div className="max-w-lg mx-auto flex flex-col gap-5">

            {/* Header row */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs tracking-widest uppercase text-slate-400 dark:text-slate-500">
                  Career Goal
                </p>
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                  {result.career_goal}
                </h2>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {result.estimated_completion_days > 0 && (
                  <span
                    className="text-xs px-3 py-1 rounded-full"
                    style={{
                      background: 'rgba(0,243,255,0.08)',
                      border: '1px solid rgba(0,243,255,0.20)',
                      color: 'rgba(0,243,255,0.75)',
                    }}
                  >
                    ~{result.estimated_completion_days}d
                  </span>
                )}
                <button
                  onClick={handleReset}
                  className="text-xs px-3 py-1 rounded-full
                    text-slate-500 dark:text-slate-400
                    hover:text-slate-700 dark:hover:text-slate-200
                    border border-slate-200 dark:border-white/10
                    transition-colors"
                >
                  ↩ Reset
                </button>
              </div>
            </div>

            {/* Profile summary pills */}
            {result.profile_summary && (
              <div className="flex gap-2 flex-wrap text-xs">
                <Pill color="green"  label={`${result.profile_summary.mastered} mastered`} />
                <Pill color="yellow" label={`${result.profile_summary.weak} weak`} />
                <Pill color="red"    label={`${result.profile_summary.missing} missing`} />
                <Pill color="gray"   label={`${result.profile_summary.total} total`} />
              </div>
            )}

            {/* Strong concepts */}
            {result.strong_concepts?.length > 0 && (
              <Section title="✅ Strong Concepts" accent="green">
                <TagList tags={result.strong_concepts} color="green" />
              </Section>
            )}

            {/* Weak concepts */}
            {result.weak_concepts?.length > 0 && (
              <Section title="⚠️ Weak Concepts" accent="yellow">
                <TagList tags={result.weak_concepts} color="yellow" />
              </Section>
            )}

            {/* Knowledge gaps */}
            {result.knowledge_gaps?.length > 0 && (
              <Section title="🔴 Knowledge Gaps" accent="red">
                <TagList tags={result.knowledge_gaps} color="red" />
              </Section>
            )}

            {/* Recommended path */}
            {result.recommended_path?.length > 0 && (
              <Section title="📍 Recommended Learning Path" accent="cyan">
                <ol className="flex flex-col gap-2.5 mt-1">
                  {result.recommended_path.map((step) => (
                    <li key={step.step} className="flex gap-3 items-start">
                      <span
                        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center
                          text-[10px] font-bold"
                        style={{
                          background: 'rgba(0,243,255,0.12)',
                          border: '1px solid rgba(0,243,255,0.25)',
                          color: 'rgba(0,243,255,0.85)',
                        }}
                      >
                        {step.step}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-snug">
                          {step.chunk_title}
                        </p>
                        {step.reason && (
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            {step.reason}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </Section>
            )}

            {/* Reasoning */}
            {result.reasoning && (
              <Section title="💡 AI Reasoning" accent="blue">
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  {result.reasoning}
                </p>
              </Section>
            )}

          </div>
        )}
      </main>

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <HamburgerSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </div>
  )
}

// ── Small helper components ────────────────────────────────────────────────────

function Section({ title, accent, children }) {
  const borderColor = {
    green: 'rgba(0,210,122,0.25)',
    yellow: 'rgba(255,190,50,0.25)',
    red: 'rgba(255,80,80,0.20)',
    cyan: 'rgba(0,243,255,0.25)',
    blue: 'rgba(77,124,254,0.25)',
  }[accent] ?? 'rgba(255,255,255,0.10)'

  return (
    <div
      className="clay-card rounded-2xl p-4"
      style={{ borderColor }}
    >
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-widest">
        {title}
      </p>
      {children}
    </div>
  )
}

function TagList({ tags, color }) {
  const palette = {
    green:  { bg: 'rgba(0,210,122,0.10)', border: 'rgba(0,210,122,0.25)', text: 'rgba(0,210,122,0.90)' },
    yellow: { bg: 'rgba(255,190,50,0.10)', border: 'rgba(255,190,50,0.25)', text: 'rgba(220,160,30,0.95)' },
    red:    { bg: 'rgba(255,80,80,0.08)',  border: 'rgba(255,80,80,0.22)',  text: 'rgba(240,80,80,0.90)' },
  }[color] ?? { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)', text: 'rgba(255,255,255,0.65)' }

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag, i) => (
        <span
          key={i}
          className="text-xs px-2.5 py-1 rounded-full"
          style={{ background: palette.bg, border: `1px solid ${palette.border}`, color: palette.text }}
        >
          {tag}
        </span>
      ))}
    </div>
  )
}

function Pill({ color, label }) {
  const palette = {
    green:  { bg: 'rgba(0,210,122,0.10)', text: 'rgba(0,210,122,0.85)' },
    yellow: { bg: 'rgba(255,190,50,0.10)', text: 'rgba(220,160,30,0.90)' },
    red:    { bg: 'rgba(255,80,80,0.08)',  text: 'rgba(240,80,80,0.85)' },
    gray:   { bg: 'rgba(255,255,255,0.06)', text: 'rgba(255,255,255,0.45)' },
  }[color] ?? { bg: 'rgba(255,255,255,0.06)', text: 'rgba(255,255,255,0.45)' }

  return (
    <span
      className="px-2.5 py-1 rounded-full font-medium"
      style={{ background: palette.bg, color: palette.text }}
    >
      {label}
    </span>
  )
}
