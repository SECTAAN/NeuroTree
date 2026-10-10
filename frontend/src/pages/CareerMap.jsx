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
            <span className="block w-3.5 h-px rounded-full" style={{ background: 'var(--nt-text-3)' }} />
            <span className="block w-3.5 h-px rounded-full" style={{ background: 'var(--nt-text-3)' }} />
            <span className="block w-3.5 h-px rounded-full" style={{ background: 'var(--nt-text-3)' }} />
          </button>

          <button
            onClick={() => navigateTo('dashboard')}
            className="text-xs transition-colors flex items-center gap-1"
            style={{ color: 'var(--nt-text-3)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--nt-text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--nt-text-3)' }}
          >
            ← Dashboard
          </button>
        </div>

        <span className="nt-section-label" style={{ color: 'var(--nt-primary-lt)' }}>
          Career Map
        </span>

        <button
          onClick={() => navigateTo('skilltree')}
          className="text-xs transition-colors flex items-center gap-1"
          style={{ color: 'var(--nt-text-3)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--nt-text)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--nt-text-3)' }}
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
                  background: 'rgba(53,78,71,0.10)',
                  border: '1px solid rgba(53,78,71,0.25)',
                  color: 'var(--nt-primary-lt)',
                  boxShadow: 'var(--nt-shadow-out-sm)',
                }}
              >
                ⚡
              </span>
              <p className="nt-section-label">NeuroTree Recommendation</p>
            </div>

            {/* A — no session */}
            {autoStatus === 'no-session' && (
              <div className="clay-card rounded-2xl px-5 py-8 text-center">
                <p className="text-sm mb-1" style={{ color: 'var(--nt-text-2)' }}>No active tree</p>
                <p className="text-xs mb-4" style={{ color: 'var(--nt-text-3)' }}>
                  Open or create a tree first, then come back for a personalised recommendation.
                </p>
                <button
                  onClick={() => navigateTo('dashboard')}
                  className="nt-btn-secondary px-5 py-2 text-xs hover:-translate-y-0.5 transition-transform duration-200"
                >
                  Go to Dashboard →
                </button>
              </div>
            )}

            {/* A — loading */}
            {autoStatus === 'loading' && (
              <div className="clay-card rounded-2xl px-6 py-8 text-center">
                <div className="nt-spinner mx-auto mb-4" />
                <p className="text-sm" style={{ color: 'var(--nt-text-2)' }}>
                  {autoGoal
                    ? <>Analysing for &ldquo;{autoGoal}&rdquo;…</>
                    : 'Identifying career matches…'}
                </p>
              </div>
            )}

            {/* A — error */}
            {autoStatus === 'error' && (
              <div
                className="clay-card rounded-2xl px-5 py-6 text-center"
                style={{ borderLeft: '3px solid var(--nt-coral)' }}
              >
                <p className="text-sm mb-1" style={{ color: 'var(--nt-text-2)' }}>Recommendation failed</p>
                <p className="text-xs mb-4" style={{ color: 'var(--nt-text-3)' }}>{autoError}</p>
                <button onClick={handleAutoRetry} className="nt-btn-secondary px-5 py-2 text-xs">
                  Retry ↺
                </button>
              </div>
            )}

            {/* A — result (empty-tree sentinel) */}
            {autoStatus === 'result' && autoResult?._empty && (
              <div className="clay-card rounded-2xl px-5 py-8 text-center">
                <p className="text-sm mb-1" style={{ color: 'var(--nt-text-2)' }}>No knowledge nodes yet</p>
                <p className="text-xs mb-4" style={{ color: 'var(--nt-text-3)' }}>
                  Complete at least one quiz to see a personalised career recommendation.
                </p>
                <button
                  onClick={() => navigateTo('skilltree')}
                  className="nt-btn-secondary px-5 py-2 text-xs hover:-translate-y-0.5 transition-transform duration-200"
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
                    <span className="nt-section-label flex-shrink-0">
                      {suggestSource === 'fallback' ? 'Generic — also try:' : 'Also relevant:'}
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
                        className="nt-chip"
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
                  background: 'rgba(219,98,113,0.10)',
                  border: '1px solid rgba(219,98,113,0.28)',
                  color: 'var(--nt-coral)',
                  boxShadow: 'var(--nt-shadow-out-sm)',
                }}
              >
                ◈
              </span>
              <p className="nt-section-label">Custom Dream Job</p>
            </div>

            {/* Custom input form */}
            <div className="clay-card rounded-2xl p-5 flex flex-col gap-4">
              <p className="text-xs" style={{ color: 'var(--nt-text-3)' }}>
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
                  className="nt-input flex-1 rounded-xl px-3 py-2 text-sm min-w-0 disabled:opacity-50"
                  style={{ caretColor: 'var(--nt-coral)' }}
                />
                <button
                  type="submit"
                  disabled={!customGoal.trim() || customStatus === 'loading'}
                  className="nt-btn-coral flex-shrink-0 rounded-xl px-4 py-2 text-sm font-medium
                    disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {customStatus === 'loading' ? '…' : 'Analyse ⚡'}
                </button>
              </form>
            </div>

            {/* B — loading */}
            {customStatus === 'loading' && (
              <div className="mt-4 clay-card rounded-2xl px-6 py-6 text-center">
                <div className="nt-spinner mx-auto mb-3" />
                <p className="text-xs" style={{ color: 'var(--nt-text-3)' }}>Analysing custom goal…</p>
              </div>
            )}

            {/* B — error */}
            {customStatus === 'error' && (
              <div className="mt-4 clay-card rounded-2xl px-5 py-5 text-center"
                style={{ borderLeft: '3px solid var(--nt-coral)' }}>
                <p className="text-sm mb-1" style={{ color: 'var(--nt-text-2)' }}>Custom analysis failed</p>
                <p className="text-xs mb-3" style={{ color: 'var(--nt-text-3)' }}>{customError}</p>
                <button
                  onClick={handleCustomReset}
                  className="text-xs transition-colors"
                  style={{ color: 'var(--nt-text-3)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--nt-coral)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--nt-text-3)' }}
                >
                  Clear ✕
                </button>
              </div>
            )}

            {/* B — result */}
            {customStatus === 'result' && customResult && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="nt-section-label">Custom — {customResult.career_goal}</p>
                  <button
                    onClick={handleCustomReset}
                    className="text-[10px] transition-colors"
                    style={{ color: 'var(--nt-text-3)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--nt-coral)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--nt-text-3)' }}
                  >
                    Clear ✕
                  </button>
                </div>
                <PathwayResult result={customResult} accentOverride="coral" />
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
function PathwayResult({ result, accentOverride }) {
  const isCoral = accentOverride === 'coral' || accentOverride === 'purple'

  const treeMatch   = result.tree_career_match ?? 1.0
  const hasNodes    = (result.profile_summary?.total ?? 0) > 0
  const isUnknown   = treeMatch === -1 && hasNodes
  const isMismatch  = treeMatch === 0  && hasNodes

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="nt-section-label">Career Goal</p>
          <h2 className="text-base font-semibold leading-snug mt-0.5" style={{ color: 'var(--nt-text)' }}>
            {result.career_goal}
          </h2>
        </div>
        {result.estimated_completion_days > 0 && (
          <span
            className="text-xs px-3 py-1 rounded-full flex-shrink-0"
            style={{
              background: isCoral ? 'rgba(219,98,113,0.10)' : 'rgba(53,78,71,0.10)',
              border: isCoral ? '1px solid rgba(219,98,113,0.28)' : '1px solid rgba(53,78,71,0.25)',
              color: isCoral ? 'var(--nt-coral)' : 'var(--nt-primary-lt)',
            }}
          >
            ~{result.estimated_completion_days}d
          </span>
        )}
      </div>

      {/* Mismatch notice */}
      {isMismatch && (
        <div className="nt-notice-amber px-4 py-3 text-xs leading-relaxed">
          ⚠️ Your active learning tree covers a different domain. The list below shows what{' '}
          <strong>{result.career_goal}</strong> typically requires — upload relevant material
          to get a personalised analysis.
        </div>
      )}

      {/* Unknown career notice */}
      {isUnknown && (
        <div className="nt-notice-gray px-4 py-3 text-xs leading-relaxed">
          ℹ️ <strong>{result.career_goal}</strong> is not in our career reference database.
          The path below shows your unmastered tree topics — upload relevant material and
          switch to Live mode for a full personalised analysis.
        </div>
      )}

      {/* Profile summary pills */}
      {result.profile_summary && result.profile_summary.total > 0 && (
        <div className="flex gap-2 flex-wrap text-xs">
          <Pill color="primary" label={`${result.profile_summary.mastered} mastered`} />
          <Pill color="coral"   label={`${result.profile_summary.weak} weak`} />
          <Pill color="gray"    label={`${result.profile_summary.missing} missing`} />
          <Pill color="muted"   label={`${result.profile_summary.total} total`} />
        </div>
      )}

      {result.profile_summary?.total === 0 && (
        <p className="text-xs italic" style={{ color: 'var(--nt-text-3)' }}>
          No knowledge nodes found. Start learning to see a personalised gap analysis.
        </p>
      )}

      {/* Strong concepts */}
      {result.strong_concepts?.length > 0 && (
        <CareerSection title="✅ Strong Concepts" accent="primary">
          <TagList tags={result.strong_concepts} color="primary" />
        </CareerSection>
      )}

      {/* Weak concepts */}
      {!isMismatch && !isUnknown && result.weak_concepts?.length > 0 && (
        <CareerSection title="⚠️ Weak Concepts" accent="coral">
          <TagList tags={result.weak_concepts} color="coral" />
        </CareerSection>
      )}

      {/* Knowledge gaps */}
      {!isUnknown && result.knowledge_gaps?.length > 0 && (
        <CareerSection
          title={isMismatch ? `📋 Required Skills for ${result.career_goal}` : '🔴 Knowledge Gaps'}
          accent="coral"
        >
          <TagList tags={result.knowledge_gaps} color="coral" />
        </CareerSection>
      )}

      {/* Recommended path */}
      {result.recommended_path?.length > 0 && (
        <CareerSection title="📍 Recommended Learning Path" accent={isCoral ? 'coral' : 'primary'}>
          <ol className="flex flex-col gap-2.5 mt-1">
            {result.recommended_path.map((s) => (
              <li key={s.step} className="flex gap-3 items-start">
                <span
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{
                    background: isCoral ? 'rgba(219,98,113,0.12)' : 'rgba(53,78,71,0.10)',
                    border: isCoral ? '1px solid rgba(219,98,113,0.30)' : '1px solid rgba(53,78,71,0.22)',
                    color: isCoral ? 'var(--nt-coral)' : 'var(--nt-primary-lt)',
                  }}
                >
                  {s.step}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug" style={{ color: 'var(--nt-text)' }}>
                    {s.chunk_title}
                  </p>
                  {s.reason && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--nt-text-3)' }}>{s.reason}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </CareerSection>
      )}

      {/* Reasoning */}
      {result.reasoning && (
        <CareerSection title="💡 AI Reasoning" accent="muted">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--nt-text-2)' }}>
            {result.reasoning}
          </p>
        </CareerSection>
      )}
    </div>
  )
}

// ── CareerSection ─────────────────────────────────────────────────────────────
function CareerSection({ title, accent, children }) {
  const borderColor = {
    primary: 'rgba(53,78,71,0.22)',
    coral:   'rgba(219,98,113,0.22)',
    muted:   'var(--nt-border)',
  }[accent] ?? 'var(--nt-border)'

  return (
    <div className="clay-card rounded-2xl p-4" style={{ borderLeft: `3px solid ${borderColor}` }}>
      <p className="nt-section-label mb-3">{title}</p>
      {children}
    </div>
  )
}

// ── TagList ───────────────────────────────────────────────────────────────────
function TagList({ tags, color }) {
  const style = {
    primary: { background: 'rgba(53,78,71,0.08)',   border: '1px solid rgba(53,78,71,0.22)',   color: 'var(--nt-primary-lt)' },
    coral:   { background: 'rgba(219,98,113,0.08)', border: '1px solid rgba(219,98,113,0.22)', color: 'var(--nt-coral)'      },
  }[color] ?? { background: 'var(--nt-bg-2)', border: '1px solid var(--nt-border)', color: 'var(--nt-text-3)' }

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag, i) => (
        <span key={i} className="text-xs px-2.5 py-1 rounded-full" style={style}>{tag}</span>
      ))}
    </div>
  )
}

// ── Pill ──────────────────────────────────────────────────────────────────────
function Pill({ color, label }) {
  const style = {
    primary: { background: 'rgba(53,78,71,0.10)',   color: 'var(--nt-primary-lt)' },
    coral:   { background: 'rgba(219,98,113,0.08)', color: 'var(--nt-coral)'      },
    gray:    { background: 'rgba(219,98,113,0.08)', color: 'var(--nt-coral)'      },
    muted:   { background: 'var(--nt-bg-2)',        color: 'var(--nt-text-3)'     },
  }[color] ?? { background: 'var(--nt-bg-2)', color: 'var(--nt-text-3)' }

  return (
    <span className="px-2.5 py-1 rounded-full font-medium text-xs" style={style}>{label}</span>
  )
}
