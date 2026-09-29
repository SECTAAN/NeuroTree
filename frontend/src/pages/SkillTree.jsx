import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import { graphApi } from '../services/api'
import SkillTreeCanvas from '../components/flow/SkillTreeCanvas'
import QuizModal       from '../components/quiz/QuizModal'
import GlassPanel      from '../components/ui/GlassPanel'

export default function SkillTree() {
  const { navigateTo, graphData, setGraphData, quizOpen, closeQuiz, quizNode, updateNodeMastery } = useApp()
  const [loading, setLoading]   = useState(!graphData?.nodes?.length)
  const [error, setError]       = useState(null)
  const [headerCollapsed, setHeaderCollapsed] = useState(false)

  // Fetch graph if empty (direct navigation)
  useEffect(() => {
    if (graphData?.nodes?.length) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    graphApi.fetchGraph()
      .then(({ data }) => { if (!cancelled) { setGraphData(data); setLoading(false) } })
      .catch((err)    => { if (!cancelled) { setError(err.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  const totalNodes   = graphData?.nodes?.length ?? 0
  const unlockedNodes= graphData?.nodes?.filter((n) => n.status !== 'locked').length ?? 0
  const avgMastery   = totalNodes
    ? Math.round(graphData.nodes.reduce((s, n) => s + (n.mastery_score ?? 0), 0) / totalNodes)
    : 0

  return (
    <div className="w-full h-full bg-app flex flex-col">

      {/* ── Top HUD bar ─────────────────────────────────────────────────── */}
      <header
        className="glass-2 mx-3 mt-3 mb-2 rounded-2xl flex-shrink-0 transition-all duration-300 overflow-hidden"
        style={{ height: headerCollapsed ? 44 : 56 }}
      >
        <div className="flex items-center justify-between px-4 h-full gap-4">
          {/* Back */}
          <button
            onClick={() => navigateTo('dashboard')}
            className="text-xs text-white/40 hover:text-white/70 transition-colors flex items-center gap-1"
          >
            ← Dashboard
          </button>

          {!headerCollapsed && (
            <div className="flex items-center gap-4 text-xs text-white/40">
              <span>
                <span style={{ color: 'rgba(0,243,255,0.7)' }}>{unlockedNodes}</span>
                /{totalNodes} unlocked
              </span>
              {/* Overall mastery bar */}
              <div className="flex items-center gap-2">
                <div className="w-24 h-1 rounded-full bg-white/8 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${avgMastery}%`,
                      background: 'linear-gradient(90deg, rgba(0,243,255,0.7), rgba(77,124,254,0.5))',
                    }}
                  />
                </div>
                <span>{avgMastery}%</span>
              </div>
            </div>
          )}

          <button
            onClick={() => setHeaderCollapsed((v) => !v)}
            className="w-6 h-6 rounded-md glass-1 flex items-center justify-center text-white/30 hover:text-white/60 text-xs transition-colors"
          >
            {headerCollapsed ? '↓' : '↑'}
          </button>
        </div>
      </header>

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
