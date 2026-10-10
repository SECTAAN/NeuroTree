import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { careerApi } from '../services/api'
import HamburgerSidebar from '../components/layout/HamburgerSidebar'

/**
 * CareerMap — M-15: two-panel Career Pathway UX with evidence-based auto-recommendation.
 *
 * Panel A — AUTO RECOMMENDATION (top, loads on mount)
 *   Step 1: GET /api/v1/career/suggest — derives candidate career names from the
 *           session's actual node titles using a rule-based domain mapper.
 *           This ensures a real career title (e.g. "Network Engineer") is used,
 *           NOT a user's learning intention (e.g. "paham", "belajar jaringan").
 *   Step 2: POST /api/v1/career/pathway — runs NT-05 with the top suggested career.
 *   If no active session: shows a "no tree loaded" prompt (no API calls made).
 *   If session has no nodes yet: shows a graceful empty state.
 *
 * Panel B — CUSTOM DREAM JOB (bottom, always visible)
 *   User types their own goal and submits.
 *   Result appears below Panel A; Panel A is never replaced.
 *   Repeated submissions replace only the custom result.
 */

export default function CareerMap() {
  const { navigateTo, activeSessionId } = useApp()

  // ── Panel A — auto recommendation ─────────────────────────────────────────
  // status: 'no-session' | 'loading' | 'result' | 'error'
  const [autoStatus,     setAutoStatus]     = useState('loading')
  const [autoResult,     setAutoResult]     = useState(null)
  const [autoError,      setAutoError]      = useState('')
  const [autoGoal,       setAutoGoal]       = useState('')
  // suggestSource: 'domain_match' | 'fallback' — shown as context in Panel A header
  const [suggestSource,  setSuggestSource]  = useState(null)
  // suggestedCareers: full list from /suggest for "also relevant" display
  const [suggestedCareers, setSuggestedCareers] = useState([])

  // ── Panel B — custom goal ──────────────────────────────────────────────────
  // status: 'idle' | 'loading' | 'result' | 'error'
  const [customGoal,   setCustomGoal]   = useState('')
  const [customStatus, setCustomStatus] = useState('idle')
  const [customResult, setCustomResult] = useState(null)
  const [customError,  setCustomError]  = useState('')

  const [sidebarOpen, setSidebarOpen] = useState(false)

  // ── Fire auto-recommendation on mount (or when session changes) ────────────
  // Step 1: call /career/suggest to get a real career name from node titles.
  // Step 2: call /career/pathway with that career name.
  // learningGoal and treeName are intentionally NOT used here — they express
  // learning intentions, not career titles.
  useEffect(() => {
    if (!activeSessionId) {
      setAutoStatus('no-session')
      return
    }

    let cancelled = false
    setAutoStatus('loading')
    setAutoResult(null)
    setAutoError('')
    setAutoGoal('')
    setSuggestSource(null)
    setSuggestedCareers([])

    careerApi.suggest()
      .then(({ data: suggestData }) => {
        if (cancelled) return

        const careers = suggestData.careers ?? []
        setSuggestedCareers(careers)
        setSuggestSource(suggestData.source ?? 'fallback')

        // No nodes yet — show graceful empty state without calling pathway()
        if (suggestData.node_count === 0) {
          setAutoResult({ _empty: true })
          setAutoStatus('result')
          return
        }

        const topCareer = careers[0]
        setAutoGoal(topCareer)

        return careerApi.pathway(topCareer)
          .then(({ data: pathData }) => {
            if (!cancelled) {
              setAutoResult(pathData)
              setAutoStatus('result')
            }
          })
      })
      .catch((err) => {
        if (!cancelled) {
          setAutoError(err.message || 'NT-05 gagal memuat rekomendasi otomatis.')
          setAutoStatus('error')
        }
      })

    return () => { cancelled = true }
  }, [activeSessionId])

  // ── Custom goal submission ────────────────────────────────────────────────
  async function handleCustomSubmit(e) {
    e.preventDefault()
    const trimmed = customGoal.trim()
    if (!trimmed || customStatus === 'loading') return

    setCustomStatus('loading')
    setCustomError('')

    try {
      const { data } = await careerApi.pathway(trimmed)
      setCustomResult(data)
      setCustomStatus('result')
    } catch (err) {
      setCustomError(err.message || 'NT-05 gagal. Coba lagi.')
      setCustomStatus('error')
    }
  }

  function handleAutoRetry() {
    if (!activeSessionId) return
    setAutoStatus('loading')
    setAutoResult(null)
    setAutoError('')

    careerApi.suggest()
      .then(({ data: suggestData }) => {
        const careers = suggestData.careers ?? []
        setSuggestedCareers(careers)
        setSuggestSource(suggestData.source ?? 'fallback')
        if (suggestData.node_count === 0) {
          setAutoResult({ _empty: true })
          setAutoStatus('result')
          return
        }
        const topCareer = careers[0]
        setAutoGoal(topCareer)
        return careerApi.pathway(topCareer)
          .then(({ data: pathData }) => { setAutoResult(pathData); setAutoStatus('result') })
      })
      .catch((err) => { setAutoError(err.message || 'NT-05 gagal.'); setAutoStatus('error') })
  }

  function handleCustomReset() {
    setCustomStatus('idle')
    setCustomResult(null)
    setCustomError('')
    setCustomGoal('')
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
        <div className="max-w-lg mx-auto flex flex-col gap-8">

          {/* ══════════════════════════════════════════════════════════════
              PANEL A — AUTO RECOMMENDATION
          ══════════════════════════════════════════════════════════════ */}
          <section>
            {/* Panel A header */}
            <div className="flex items-center gap-2 mb-3">
              <span
                className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] flex-shrink-0"
                style={{
                  background: 'rgba(0,243,255,0.10)',
                  border: '1px solid rgba(0,243,255,0.25)',
                  color: 'rgba(0,243,255,0.85)',
                }}
              >
                ⚡
              </span>
              <p className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 dark:text-slate-500">
                NeuroTree Recommendation
              </p>
            </div>

            {/* A — no session */}
            {autoStatus === 'no-session' && (
              <div
                className="clay-card rounded-2xl px-5 py-8 text-center"
                style={{ borderColor: 'rgba(255,255,255,0.08)' }}
              >
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">No active tree</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
                  Open or create a tree first, then come back for a personalised recommendation.
                </p>
                <button
                  onClick={() => navigateTo('dashboard')}
                  className="clay-card px-5 py-2 rounded-xl text-xs
                    text-cyan-600 dark:text-cyan-400
                    hover:-translate-y-0.5 transition-transform duration-200"
                >
                  Go to Dashboard →
                </button>
              </div>
            )}

            {/* A — loading */}
            {autoStatus === 'loading' && (
              <div
                className="clay-card rounded-2xl px-6 py-8 text-center"
                style={{ borderColor: 'rgba(0,243,255,0.12)' }}
              >
                <div className="text-xl mb-3 animate-pulse">🗺️</div>
                <p className="text-sm font-mono tracking-widest text-slate-500 dark:text-slate-400">
                  ANALYSING YOUR TREE…
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {autoGoal
                    ? <>NT-05 is running for &ldquo;{autoGoal}&rdquo;</>
                    : 'Identifying career matches from your skill tree…'}
                </p>
              </div>
            )}

            {/* A — error */}
            {autoStatus === 'error' && (
              <div
                className="clay-card rounded-2xl px-5 py-6 text-center"
                style={{ borderColor: 'rgba(255,80,80,0.20)' }}
              >
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Recommendation failed</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">{autoError}</p>
                <button
                  onClick={handleAutoRetry}
                  className="clay-card px-5 py-2 rounded-xl text-xs
                    text-cyan-600 dark:text-cyan-400
                    hover:-translate-y-0.5 transition-transform duration-200"
                >
                  Retry ↺
                </button>
              </div>
            )}

            {/* A — result (empty-tree sentinel) */}
            {autoStatus === 'result' && autoResult?._empty && (
              <div
                className="clay-card rounded-2xl px-5 py-8 text-center"
                style={{ borderColor: 'rgba(255,255,255,0.08)' }}
              >
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">No knowledge nodes yet</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
                  Complete at least one quiz to see a personalised career recommendation.
                </p>
                <button
                  onClick={() => navigateTo('skilltree')}
                  className="clay-card px-5 py-2 rounded-xl text-xs
                    text-cyan-600 dark:text-cyan-400
                    hover:-translate-y-0.5 transition-transform duration-200"
                >
                  Go to Skill Tree →
                </button>
              </div>
            )}

            {/* A — result (full pathway) */}
            {autoStatus === 'result' && autoResult && !autoResult._empty && (
              <>
                {/* "Also relevant" careers — shown when /suggest returned multiple options */}
                {suggestedCareers.length > 1 && (
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0">
                      {suggestSource === 'fallback' ? 'Generic suggestion — also try:' : 'Also relevant:'}
                    </span>
                    {suggestedCareers.slice(1, 4).map((c) => (
                      <button
                        key={c}
                        onClick={() => {
                          setAutoGoal(c)
                          setAutoStatus('loading')
                          setAutoResult(null)
                          careerApi.pathway(c)
                            .then(({ data }) => { setAutoResult(data); setAutoStatus('result') })
                            .catch((err) => { setAutoError(err.message || 'NT-05 gagal.'); setAutoStatus('error') })
                        }}
                        className="text-[10px] px-2 py-0.5 rounded-full transition-colors"
                        style={{
                          background: 'rgba(0,243,255,0.07)',
                          border: '1px solid rgba(0,243,255,0.18)',
                          color: 'rgba(0,243,255,0.70)',
                        }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
                <PathwayResult result={autoResult} />
              </>
            )}
          </section>

          {/* ══════════════════════════════════════════════════════════════
              PANEL B — CUSTOM DREAM JOB
          ══════════════════════════════════════════════════════════════ */}
          <section>
            {/* Panel B header */}
            <div className="flex items-center gap-2 mb-3">
              <span
                className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] flex-shrink-0"
                style={{
                  background: 'rgba(191,0,255,0.08)',
                  border: '1px solid rgba(191,0,255,0.22)',
                  color: 'rgba(191,0,255,0.85)',
                }}
              >
                ◈
              </span>
              <p className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 dark:text-slate-500">
                Custom Dream Job
              </p>
            </div>

            {/* Custom input form — always visible */}
            <div
              className="clay-card rounded-2xl p-5 flex flex-col gap-4"
              style={{ borderColor: 'rgba(191,0,255,0.15)' }}
            >
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Want a pathway toward a specific role? Enter it below — this runs a separate analysis
                and appears beneath the NeuroTree recommendation.
              </p>

              <form onSubmit={handleCustomSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={customGoal}
                  onChange={(e) => setCustomGoal(e.target.value)}
                  placeholder="e.g. Network Engineer, AI Engineer, Data Scientist…"
                  maxLength={200}
                  disabled={customStatus === 'loading'}
                  className="flex-1 rounded-xl px-3 py-2 text-sm min-w-0
                    bg-white/60 dark:bg-black/20
                    border border-slate-200 dark:border-white/10
                    text-slate-800 dark:text-slate-100
                    placeholder-slate-400 dark:placeholder-slate-600
                    focus:outline-none focus:ring-2 focus:ring-purple-400/30
                    disabled:opacity-50 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!customGoal.trim() || customStatus === 'loading'}
                  className="clay-card flex-shrink-0 rounded-xl px-4 py-2 text-sm font-medium
                    text-purple-600 dark:text-purple-400
                    disabled:opacity-40 disabled:cursor-not-allowed
                    hover:-translate-y-0.5 active:translate-y-0
                    transition-all duration-200 whitespace-nowrap"
                  style={{ borderColor: 'rgba(191,0,255,0.25)' }}
                >
                  {customStatus === 'loading' ? '…' : 'Analyse ⚡'}
                </button>
              </form>
            </div>

            {/* B — loading */}
            {customStatus === 'loading' && (
              <div className="mt-4 clay-card rounded-2xl px-6 py-6 text-center"
                style={{ borderColor: 'rgba(191,0,255,0.12)' }}>
                <div className="text-lg mb-2 animate-pulse">🔭</div>
                <p className="text-xs font-mono tracking-widest text-slate-400 dark:text-slate-500">
                  ANALYSING CUSTOM GOAL…
                </p>
              </div>
            )}

            {/* B — error */}
            {customStatus === 'error' && (
              <div className="mt-4 clay-card rounded-2xl px-5 py-5 text-center"
                style={{ borderColor: 'rgba(255,80,80,0.18)' }}>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Custom analysis failed</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">{customError}</p>
                <button
                  onClick={handleCustomReset}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  Clear ✕
                </button>
              </div>
            )}

            {/* B — result */}
            {customStatus === 'result' && customResult && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    Custom result — {customResult.career_goal}
                  </p>
                  <button
                    onClick={handleCustomReset}
                    className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    Clear ✕
                  </button>
                </div>
                <PathwayResult result={customResult} accentOverride="purple" />
              </div>
            )}
          </section>

        </div>
      </main>

      <HamburgerSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </div>
  )
}

// ── PathwayResult ─────────────────────────────────────────────────────────────
// Renders one full NT-05 result — used by both Panel A and Panel B.
// accentOverride lets Panel B use purple tones for visual distinction.
function PathwayResult({ result, accentOverride }) {
  const isPurple = accentOverride === 'purple'

  const pathAccent = isPurple
    ? { bg: 'rgba(191,0,255,0.12)', border: 'rgba(191,0,255,0.25)', text: 'rgba(191,0,255,0.85)' }
    : { bg: 'rgba(0,243,255,0.12)', border: 'rgba(0,243,255,0.25)', text: 'rgba(0,243,255,0.85)' }

  // tree_career_match:
  //   -1.0 = career not in reference database (unknown)
  //    0.0 = known career, tree has zero relevant nodes (domain mismatch)
  //    0–1 = partial-to-full match
  //    1.0 = default for LIVE / full match
  const treeMatch   = result.tree_career_match ?? 1.0
  const hasNodes    = (result.profile_summary?.total ?? 0) > 0
  const isUnknown   = treeMatch === -1 && hasNodes
  const isMismatch  = treeMatch === 0  && hasNodes

  return (
    <div className="flex flex-col gap-4">

      {/* Header row: goal + estimated days */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs tracking-widest uppercase text-slate-400 dark:text-slate-500">
            Career Goal
          </p>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 leading-snug">
            {result.career_goal}
          </h2>
        </div>
        {result.estimated_completion_days > 0 && (
          <span
            className="text-xs px-3 py-1 rounded-full flex-shrink-0"
            style={{
              background: pathAccent.bg,
              border: `1px solid ${pathAccent.border}`,
              color: pathAccent.text,
            }}
          >
            ~{result.estimated_completion_days}d
          </span>
        )}
      </div>

      {/* Tree–career mismatch notice (known career, wrong domain) */}
      {isMismatch && (
        <div
          className="rounded-xl px-4 py-3 text-xs leading-relaxed"
          style={{
            background: 'rgba(251,191,36,0.10)',
            border: '1px solid rgba(251,191,36,0.30)',
            color: 'rgba(180,130,0,0.90)',
          }}
        >
          ⚠️ Your active learning tree covers a different domain. The list below shows what{' '}
          <strong>{result.career_goal}</strong> typically requires — upload relevant material
          to get a personalised analysis.
        </div>
      )}

      {/* Unknown career notice (career not in reference database) */}
      {isUnknown && (
        <div
          className="rounded-xl px-4 py-3 text-xs leading-relaxed"
          style={{
            background: 'rgba(148,163,184,0.10)',
            border: '1px solid rgba(148,163,184,0.30)',
            color: 'rgba(71,85,105,0.90)',
          }}
        >
          ℹ️ <strong>{result.career_goal}</strong> is not in our career reference database.
          The path below shows your unmastered tree topics — upload relevant material and
          switch to Live mode for a full personalised analysis.
        </div>
      )}

      {/* Profile summary pills */}
      {result.profile_summary && result.profile_summary.total > 0 && (
        <div className="flex gap-2 flex-wrap text-xs">
          <Pill color="green"  label={`${result.profile_summary.mastered} mastered`} />
          <Pill color="yellow" label={`${result.profile_summary.weak} weak`} />
          <Pill color="red"    label={`${result.profile_summary.missing} missing`} />
          <Pill color="gray"   label={`${result.profile_summary.total} total`} />
        </div>
      )}

      {/* Empty profile note — session has nodes but all unstarted */}
      {result.profile_summary?.total === 0 && (
        <p className="text-xs text-slate-400 dark:text-slate-500 italic">
          No knowledge nodes found in this session. Start learning to see a personalised gap analysis.
        </p>
      )}

      {/* Strong concepts */}
      {result.strong_concepts?.length > 0 && (
        <Section title="✅ Strong Concepts" accent="green">
          <TagList tags={result.strong_concepts} color="green" />
        </Section>
      )}

      {/* Weak concepts — only shown when tree is relevant to career (not mismatch/unknown) */}
      {!isMismatch && !isUnknown && result.weak_concepts?.length > 0 && (
        <Section title="⚠️ Weak Concepts" accent="yellow">
          <TagList tags={result.weak_concepts} color="yellow" />
        </Section>
      )}

      {/* Knowledge gaps — labelled differently on mismatch; hidden on unknown career */}
      {!isUnknown && result.knowledge_gaps?.length > 0 && (
        <Section
          title={isMismatch ? `📋 Required Skills for ${result.career_goal}` : '🔴 Knowledge Gaps'}
          accent="red"
        >
          <TagList tags={result.knowledge_gaps} color="red" />
        </Section>
      )}

      {/* Recommended path */}
      {result.recommended_path?.length > 0 && (
        <Section title="📍 Recommended Learning Path" accent={isPurple ? 'purple' : 'cyan'}>
          <ol className="flex flex-col gap-2.5 mt-1">
            {result.recommended_path.map((s) => (
              <li key={s.step} className="flex gap-3 items-start">
                <span
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={pathAccent}
                >
                  {s.step}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-snug">
                    {s.chunk_title}
                  </p>
                  {s.reason && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{s.reason}</p>
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
  )
}

// ── Section ───────────────────────────────────────────────────────────────────
function Section({ title, accent, children }) {
  const borderColor = {
    green:  'rgba(0,210,122,0.25)',
    yellow: 'rgba(255,190,50,0.25)',
    red:    'rgba(255,80,80,0.20)',
    cyan:   'rgba(0,243,255,0.25)',
    blue:   'rgba(77,124,254,0.25)',
    purple: 'rgba(191,0,255,0.22)',
  }[accent] ?? 'rgba(255,255,255,0.10)'

  return (
    <div className="clay-card rounded-2xl p-4" style={{ borderColor }}>
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-widest">
        {title}
      </p>
      {children}
    </div>
  )
}

// ── TagList ───────────────────────────────────────────────────────────────────
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

// ── Pill ──────────────────────────────────────────────────────────────────────
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
