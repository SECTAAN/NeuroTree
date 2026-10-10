import { useEffect, useState, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { graphApi, quizApi, activeSession } from '../services/api'
import SkillTreeCanvas     from '../components/flow/SkillTreeCanvas'
import QuizModal           from '../components/quiz/QuizModal'
import CollapsibleHeader   from '../components/layout/CollapsibleHeader'
import HamburgerSidebar    from '../components/layout/HamburgerSidebar'

// ── Priority style map for NT-04 recommendation chip — skeuomorphic ──────────
const PRIORITY_STYLE = {
  high:   { color: 'var(--nt-coral)',     border: 'rgba(219,98,113,0.35)' },
  medium: { color: 'var(--nt-primary)',   border: 'rgba(53,78,71,0.30)'   },
  low:    { color: 'var(--nt-text-3)',    border: 'var(--nt-border)'       },
}

// ── NT-04 Recommendation Chip ────────────────────────────────────────────────
function RecommendationChip({ rec, graphNodes, onGoTo, onDismiss }) {
  if (!rec) return null

  const style      = PRIORITY_STYLE[rec.priority] ?? PRIORITY_STYLE.medium
  const targetNode = graphNodes.find((n) => n.id === rec.target_chunk_id)
  const nodeReady  = !!targetNode
  const isLocked   = nodeReady && targetNode.status === 'locked'
  const hasTarget  = !!rec.target_chunk_id && !!rec.target_chunk_title

  const pct = rec.progress_summary?.completion_percentage ?? 0

  return (
    <div
      className="mx-3 mb-1 rounded-2xl flex items-center gap-3 px-4 py-2.5 flex-shrink-0 clay-card"
      style={{ border: `1px solid ${style.border}` }}
    >
      {/* Pulse dot */}
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse"
        style={{ background: style.color }}
      />

      {/* Text block */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] uppercase tracking-widest" style={{ color: 'var(--nt-text-3)' }}>
            AI recommends
          </span>
          {pct > 0 && (
            <span className="text-[10px]" style={{ color: 'var(--nt-text-3)' }}>{pct}% complete</span>
          )}
        </div>
        {hasTarget ? (
          <p className="text-xs font-medium truncate" style={{ color: style.color }}>
            {rec.target_chunk_title}
          </p>
        ) : (
          <p className="text-xs truncate" style={{ color: 'var(--nt-text-3)' }}>
            {rec.reason || 'Review your progress'}
          </p>
        )}
        {rec.reason && hasTarget && (
          <p className="text-[10px] truncate" style={{ color: 'var(--nt-text-3)' }}>{rec.reason}</p>
        )}
      </div>

      {/* Go arrow */}
      {hasTarget && (
        <button
          onClick={nodeReady && !isLocked ? () => onGoTo(targetNode) : undefined}
          title={
            !nodeReady  ? 'Graph is updating…'         :
            isLocked    ? 'Unlock prerequisites first' :
                          `Study "${rec.target_chunk_title}"`
          }
          disabled={!nodeReady || isLocked}
          className="flex-shrink-0 text-xs px-2.5 py-1 rounded-lg transition-all duration-200
            disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            background: (!nodeReady || isLocked) ? 'transparent' : 'rgba(53,78,71,0.08)',
            border:     `1px solid ${(!nodeReady || isLocked) ? 'var(--nt-border)' : style.border}`,
            color:      (!nodeReady || isLocked) ? 'var(--nt-text-3)' : style.color,
          }}
        >
          {isLocked ? '🔒' : 'Go →'}
        </button>
      )}

      {/* Dismiss */}
      <button
        onClick={onDismiss}
        className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center
          text-[10px] transition-colors"
        style={{ color: 'var(--nt-text-3)' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--nt-text)' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--nt-text-3)' }}
        title="Dismiss"
        aria-label="Dismiss recommendation"
      >
        ✕
      </button>
    </div>
  )
}

// ── SkillTree page ────────────────────────────────────────────────────────────
export default function SkillTree() {
  const {
    navigateTo,
    graphData, setGraphData,
    treeName, setTreeName,
    quizOpen, closeQuiz, quizNode,
    updateNodeMastery,
    openQuiz,
    activeSessionId,
  } = useApp()

  const [loading, setLoading]                 = useState(!graphData?.nodes?.length)
  const [error, setError]                     = useState(null)
  const [headerCollapsed, setHeaderCollapsed] = useState(false)
  const [sidebarOpen, setSidebarOpen]         = useState(false)

  // ── NT-04 recommendation state ────────────────────────────────────────────
  const [recommendation, setRecommendation] = useState(null)

  // Fetch graph if empty (direct navigation or page refresh).
  // F-8E.3: wait for activeSessionId before fetching so the request always
  // carries the correct X-Session-ID header after a Ctrl+R refresh.
  useEffect(() => {
    if (!activeSessionId) return
    if (graphData?.nodes?.length) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    graphApi.fetchGraph()
      .then(({ data }) => { if (!cancelled) { setGraphData(data); setLoading(false) } })
      .catch((err)    => { if (!cancelled) { setError(err.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [activeSessionId])

  // F-2 / F-6: Recover tree name from backend if context lost (e.g. page refresh).
  // Use activeSession.id to find the right session when multiple trees exist.
  useEffect(() => {
    if (treeName) return  // already set — nothing to do
    graphApi.fetchSessions()
      .then(({ data }) => {
        const sid = activeSession.id
        const match = sid
          ? (data?.sessions ?? []).find((s) => s.session_id === sid)
          : data?.sessions?.[0]
        if (match?.tree_name) setTreeName(match.tree_name)
      })
      .catch(() => { /* silent — treeName stays empty */ })
  }, [treeName])

  // ── NT-04: fire after mastery update ─────────────────────────────────────
  // P1-5: fetchRecommendation accepts an optional fresh nodes array so the
  // chip renders against up-to-date graph state instead of the stale closure.
  // When freshNodes is provided it is written to graphData before the chip
  // appears — eliminating the race between graph-refresh and recommendation.
  const fetchRecommendation = useCallback((freshNodes) => {
    quizApi.recommend()
      .then(({ data }) => {
        // Only show chip if there is a meaningful recommendation
        if (data?.target_chunk_id || data?.reason) {
          // If we have fresh graph data, apply it before showing the chip so
          // the "Go →" button never renders against a stale node list.
          if (freshNodes) {
            setGraphData((prev) => ({ ...prev, nodes: freshNodes }))
          }
          setRecommendation(data)
        }
      })
      .catch(() => { /* silent — chip simply doesn't appear */ })
  }, [setGraphData])

  /**
   * Called by QuizModal after a successful evaluation (Q2 is_final).
   *
   * P1-5 fix — sequencing:
   *   1. Optimistic mastery patch (immediate visual feedback via updateNodeMastery).
   *   2. Authoritative graph refresh (fetchGraph) — resolves fresh node list.
   *   3. NT-04 recommendation fetch — called with the fresh node list so the
   *      chip never sees stale unlock/lock state.
   *
   * The recommendation is only shown after the graph is confirmed fresh,
   * preventing the chip's "Go →" button from being disabled for a newly-
   * unlocked target node that hasn't yet appeared in the local state.
   */
  function handleMasteryUpdate(nodeId, newScore, unlockedIds = []) {
    // Step 1: optimistic local patch + AppContext fire-and-forget (for edge visuals)
    updateNodeMastery(nodeId, newScore, unlockedIds)
    // Step 2+3: clear stale chip, refresh graph, then fire recommendation
    setRecommendation(null)
    graphApi.fetchGraph()
      .then(({ data }) => {
        setGraphData(data)
        fetchRecommendation(data.nodes)
      })
      .catch(() => {
        // Graph refresh failed — still try the recommendation with current state
        fetchRecommendation()
      })
  }

  // Navigation to recommended node's quiz
  // Raw API-shape nodes from graphData have `title` but not `label`.
  // QuizModal renders node.label — normalise here so the header is correct.
  function handleGoToRecommendation(node) {
    if (!node || node.status === 'locked') return
    setRecommendation(null)
    openQuiz({ ...node, label: node.label ?? node.title })
  }

  const totalNodes    = graphData?.nodes?.length ?? 0
  const unlockedNodes = graphData?.nodes?.filter((n) => n.status !== 'locked').length ?? 0
  const avgMastery    = totalNodes
    ? Math.round(graphData.nodes.reduce((s, n) => s + (n.mastery_score ?? 0), 0) / totalNodes)
    : 0

  return (
    <div className="w-full h-full bg-app flex flex-col">

      {/* ── Top HUD bar ─────────────────────────────────────────────────── */}
      <CollapsibleHeader
        collapsed={headerCollapsed}
        onToggleCollapse={() => setHeaderCollapsed((v) => !v)}
        onMenuOpen={() => setSidebarOpen(true)}
        onBack={() => navigateTo('dashboard')}
        totalNodes={totalNodes}
        unlockedNodes={unlockedNodes}
        avgMastery={avgMastery}
        treeName={treeName || null}
      />

      {/* ── NT-04 Recommendation chip (appears after quiz) ──────────────── */}
      {recommendation && (
        <RecommendationChip
          rec={recommendation}
          graphNodes={graphData?.nodes ?? []}
          onGoTo={handleGoToRecommendation}
          onDismiss={() => setRecommendation(null)}
        />
      )}

      {/* ── Canvas ──────────────────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden rounded-2xl mx-3 mb-3">
        {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-app">
              <div className="glass-3 rounded-2xl px-8 py-6 text-center">
                <div
                  className="w-10 h-10 rounded-full mx-auto mb-4 organic-pulse"
                  style={{ border: '2px solid var(--nt-primary)', borderTopColor: 'var(--nt-coral)' }}
                />
                <p className="text-sm font-medium" style={{ color: 'var(--nt-text-2)' }}>
                  Initialising circuit…
                </p>
              </div>
            </div>
          )}
  
          {error && !loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-app">
              <div className="glass-3 rounded-2xl px-8 py-6 text-center max-w-sm">
                <p className="text-sm mb-2 font-medium" style={{ color: 'var(--nt-coral)' }}>
                  Circuit disconnected
                </p>
                <p className="text-xs mb-4" style={{ color: 'var(--nt-text-3)' }}>{error}</p>
                <p className="text-xs" style={{ color: 'var(--nt-text-3)' }}>
                  Ensure backend is running at{' '}
                  <code style={{ color: 'var(--nt-primary)', fontFamily: 'monospace' }}>localhost:8000</code>
                </p>
              </div>
            </div>
          )}
  
          {!loading && !error && graphData?.nodes?.length === 0 && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-app">
              <div className="glass-3 rounded-2xl px-8 py-6 text-center max-w-sm">
                <p className="text-sm mb-2 font-medium" style={{ color: 'var(--nt-text-2)' }}>
                  Circuit Empty
                </p>
                <p className="text-xs" style={{ color: 'var(--nt-text-3)' }}>
                  Use ingestion to load your first document.
                </p>
              </div>
            </div>
          )}

        <SkillTreeCanvas graphData={graphData} />
      </div>

      {/* ── Hamburger sidebar ───────────────────────────────────────────── */}
      <HamburgerSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* ── Quiz Modal ───────────────────────────────────────────────────── */}
      {quizOpen && quizNode && (
        <QuizModal
          node={quizNode}
          onClose={closeQuiz}
          onMasteryUpdate={handleMasteryUpdate}
        />
      )}
    </div>
  )
}
