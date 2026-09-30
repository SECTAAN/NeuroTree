import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import { graphApi } from '../services/api'
import SkillTreeCanvas     from '../components/flow/SkillTreeCanvas'
import QuizModal           from '../components/quiz/QuizModal'
import CollapsibleHeader   from '../components/layout/CollapsibleHeader'
import HamburgerSidebar    from '../components/layout/HamburgerSidebar'

export default function SkillTree() {
  const { navigateTo, graphData, setGraphData, quizOpen, closeQuiz, quizNode, updateNodeMastery } = useApp()
  const [loading, setLoading]           = useState(!graphData?.nodes?.length)
  const [error, setError]               = useState(null)
  const [headerCollapsed, setHeaderCollapsed] = useState(false)
  const [sidebarOpen, setSidebarOpen]   = useState(false)

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

  const totalNodes    = graphData?.nodes?.length ?? 0
  const unlockedNodes = graphData?.nodes?.filter((n) => n.status !== 'locked').length ?? 0
  const avgMastery    = totalNodes
    ? Math.round(graphData.nodes.reduce((s, n) => s + (n.mastery_score ?? 0), 0) / totalNodes)
    : 0

  // Try to read the tree name from any node's session (not stored on graph directly),
  // so we just show a generic label for now.
  const treeName = null

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
        treeName={treeName}
      />

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
          onMasteryUpdate={updateNodeMastery}
        />
      )}
    </div>
  )
}
