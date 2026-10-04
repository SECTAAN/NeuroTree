import { useEffect, useState, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { graphApi, quizApi, activeSession } from '../services/api'
import SkillTreeCanvas     from '../components/flow/SkillTreeCanvas'
import QuizModal           from '../components/quiz/QuizModal'
import CollapsibleHeader   from '../components/layout/CollapsibleHeader'
import HamburgerSidebar    from '../components/layout/HamburgerSidebar'

// ── Priority colour map for NT-04 recommendation chip ────────────────────────
const PRIORITY_STYLE = {
  high:   { border: 'rgba(0,243,255,0.35)',  text: 'rgba(0,243,255,0.90)',  glow: 'rgba(0,243,255,0.12)' },
  medium: { border: 'rgba(77,124,254,0.35)', text: 'rgba(77,124,254,0.90)', glow: 'rgba(77,124,254,0.10)' },
  low:    { border: 'rgba(148,163,184,0.25)', text: 'rgba(148,163,184,0.70)', glow: 'transparent' },
}

// ── NT-04 Recommendation Chip ────────────────────────────────────────────────
function RecommendationChip({ rec, graphNodes, onGoTo, onDismiss }) {
  if (!rec) return null

  const style      = PRIORITY_STYLE[rec.priority] ?? PRIORITY_STYLE.medium
  const targetNode = graphNodes.find((n) => n.id === rec.target_chunk_id)
  const nodeReady  = !!targetNode                          // P1-5: node must exist in graph
  const isLocked   = nodeReady && targetNode.status === 'locked'
  const hasTarget  = !!rec.target_chunk_id && !!rec.target_chunk_title

  const pct = rec.progress_summary?.completion_percentage ?? 0

  return (
    <div
      className="mx-3 mb-1 rounded-2xl flex items-center gap-3 px-4 py-2.5 flex-shrink-0"
      style={{
        background:   `rgba(15,17,20,0.55)`,
        backdropFilter: 'blur(12px)',
        border:       `1px solid ${style.border}`,
        boxShadow:    `0 0 16px ${style.glow}`,
      }}
    >
      {/* Pulse dot */}
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse"
        style={{ background: style.text }}
      />

      {/* Text block */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] text-white/40 uppercase tracking-widest">AI recommends</span>
          {pct > 0 && (
            <span className="text-[10px] text-white/25">{pct}% complete</span>
          )}
        </div>
        {hasTarget ? (
          <p className="text-xs font-medium truncate" style={{ color: style.text }}>
            {rec.target_chunk_title}
          </p>
        ) : (
          <p className="text-xs text-white/40 truncate">{rec.reason || 'Review your progress'}</p>
        )}
        {rec.reason && hasTarget && (
          <p className="text-[10px] text-white/25 truncate">{rec.reason}</p>
        )}
      </div>

      {/* Go arrow — disabled if target not yet in graph, or locked */}
      {hasTarget && (
        <button
          onClick={nodeReady && !isLocked ? () => onGoTo(targetNode) : undefined}
          title={
            !nodeReady  ? 'Graph is updating…'          :
            isLocked    ? 'Unlock prerequisites first'  :
                          `Study "${rec.target_chunk_title}"`
          }
          disabled={!nodeReady || isLocked}
          className="flex-shrink-0 text-xs px-2.5 py-1 rounded-lg transition-all duration-200
            disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            background: (!nodeReady || isLocked) ? 'transparent' : `rgba(0,243,255,0.08)`,
            border:     `1px solid ${(!nodeReady || isLocked) ? 'rgba(148,163,184,0.2)' : style.border}`,
            color:      (!nodeReady || isLocked) ? 'rgba(148,163,184,0.4)' : style.text,
          }}
        >
          {isLocked ? '🔒' : 'Go →'}
        </button>
      )}

      {/* Dismiss */}
      <button
        onClick={onDismiss}
        className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center
          text-white/20 hover:text-white/50 text-[10px] transition-colors"
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
  } = useApp()

  const [loading, setLoading]                 = useState(!graphData?.nodes?.length)
  const [error, setError]                     = useState(null)
  const [headerCollapsed, setHeaderCollapsed] = useState(false)
  const [sidebarOpen, setSidebarOpen]         = useState(false)

  // ── NT-04 recommendation state ────────────────────────────────────────────
  const [recommendation, setRecommendation] = useState(null)

  // Fetch graph if empty (direct navigation or page refresh)
  useEffect(() => {
    if (graphData?.nodes?.length) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    graphApi.fetchGraph()
      .then(({ data }) => { if (!cancelled) { setGraphData(data); setLoading(false) } })
      .catch((err)    => { if (!cancelled) { setError(err.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

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
  const fetchRecommendation = useCallback(() => {
    quizApi.recommend()
      .then(({ data }) => {
        // Only show chip if there is a meaningful recommendation
        if (data?.target_chunk_id || data?.reason) {
          setRecommendation(data)
        }
      })
      .catch(() => { /* silent — chip simply doesn't appear */ })
  }, [])

  /**
   * Called by QuizModal after a successful evaluation.
   * Runs the standard mastery update AND fires NT-04 recommendation.
   */
  function handleMasteryUpdate(nodeId, newScore, unlockedIds = []) {
    updateNodeMastery(nodeId, newScore, unlockedIds)
    // Clear stale recommendation then fetch fresh one
    setRecommendation(null)
    fetchRecommendation()
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
              <div className="text-xl mb-2 animate-pulse">⚡</div>
              <p className="text-sm text-white/50 font-mono tracking-widest">INITIALISING CIRCUIT…</p>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-app">
            <div className="glass-3 rounded-2xl px-8 py-6 text-center max-w-sm">
              <p className="text-white/60 text-sm mb-2">Sirkuit terputus</p>
              <p className="text-white/30 text-xs mb-4">{error}</p>
              <p className="text-white/20 text-xs">
                Pastikan backend berjalan di <code className="text-accent-cyan">localhost:8000</code>
              </p>
            </div>
          </div>
        )}

        {!loading && !error && graphData?.nodes?.length === 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-app">
            <div className="glass-3 rounded-2xl px-8 py-6 text-center max-w-sm">
              <p className="text-white/60 text-sm mb-2">Circuit Empty</p>
              <p className="text-white/30 text-xs">Use ingestion to load your first document.</p>
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
