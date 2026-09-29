import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { graphApi } from '../services/api'
import NewTreeDialog from '../components/newtree/NewTreeDialog'

// ── Mock session history for Dashboard ───────────────────────────────────────
const MOCK_TREES = [
  { id: 'tree_network', name: 'Computer Networks', mastery: 45, nodes: 8,  lastStudied: 'Today' },
  { id: 'tree_python',  name: 'Python Fundamentals', mastery: 72, nodes: 12, lastStudied: 'Yesterday' },
  { id: 'tree_db',      name: 'Database Fundamentals', mastery: 86, nodes: 15, lastStudied: '3 days ago' },
]

// ── TreeCard ──────────────────────────────────────────────────────────────────
function TreeCard({ tree, onClick }) {
  const [hovered, setHovered] = useState(false)

  const masteryColor =
    tree.mastery >= 80 ? 'rgba(0,255,163,0.7)'  :
    tree.mastery >= 60 ? 'rgba(0,243,255,0.7)'  :
    tree.mastery >= 40 ? 'rgba(77,124,254,0.7)' :
                         'rgba(255,255,255,0.3)'

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full text-left rounded-2xl p-5 glass-2 transition-all duration-200 group"
      style={{
        borderColor: hovered ? 'rgba(0,243,255,0.25)' : 'rgba(255,255,255,0.08)',
        boxShadow:   hovered ? '0 0 20px rgba(0,243,255,0.08)' : undefined,
        transform:   hovered ? 'translateY(-2px)' : 'none',
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-sm font-medium text-white/90">{tree.name}</span>
        <span className="text-xs text-white/30">{tree.lastStudied}</span>
      </div>

      {/* Mastery bar */}
      <div className="h-1 rounded-full bg-white/8 overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${tree.mastery}%`,
            background: `linear-gradient(90deg, ${masteryColor}, rgba(77,124,254,0.5))`,
            boxShadow: `0 0 6px ${masteryColor}`,
          }}
        />
      </div>

      <div className="flex justify-between text-xs text-white/35">
        <span>{tree.mastery}% mastery</span>
        <span>{tree.nodes} nodes</span>
      </div>
    </button>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { navigateTo, setGraphData, sessionId } = useApp()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [headerCollapsed, setHeaderCollapsed] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleOpenTree(treeId) {
    setLoading(true)
    try {
      const { data } = await graphApi.fetchGraph()
      setGraphData(data)
      navigateTo('skilltree', treeId)
    } catch {
      navigateTo('skilltree', treeId)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full h-full bg-app flex flex-col overflow-hidden">

      {/* ── Collapsible Header ─────────────────────────────────────────────── */}
      <header
        className="glass-2 mx-4 mt-4 rounded-2xl transition-all duration-300 overflow-hidden flex-shrink-0"
        style={{ height: headerCollapsed ? 52 : 64 }}
      >
        <div className="flex items-center justify-between px-5 h-full">
          <div className="flex items-center gap-3">
            {/* Logo mark */}
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono"
              style={{
                background: 'linear-gradient(135deg, rgba(0,243,255,0.2), rgba(77,124,254,0.2))',
                border: '1px solid rgba(0,243,255,0.3)',
                boxShadow: '0 0 10px rgba(0,243,255,0.15)',
              }}
            >
              NT
            </div>
            {!headerCollapsed && (
              <span
                className="font-mono text-sm tracking-widest text-white/70"
                style={{ letterSpacing: '0.2em' }}
              >
                NEUROTREE
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!headerCollapsed && (
              <span className="text-xs text-white/30 font-mono">{sessionId.slice(0,8)}…</span>
            )}
            <button
              onClick={() => setHeaderCollapsed((v) => !v)}
              className="w-7 h-7 rounded-lg glass-1 flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
              title={headerCollapsed ? 'Expand header' : 'Collapse header'}
            >
              {headerCollapsed ? '↓' : '↑'}
            </button>
          </div>
        </div>
      </header>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto px-4 py-6">

        {/* Welcome */}
        <div className="mb-8 animate-[fadeUp_0.5s_ease_forwards]">
          <p className="text-xs text-white/35 tracking-widest uppercase mb-1">Welcome back</p>
          <h1 className="text-2xl font-semibold text-white/90">Continue your learning journey</h1>
        </div>

        {/* NewTree CTA */}
        <div
          className="glass-2 rounded-3xl p-6 mb-8 text-center cursor-pointer
            hover:border-accent-cyan/30 transition-all duration-200 group
            animate-[fadeUp_0.5s_ease_0.1s_forwards] opacity-0"
          style={{ animationFillMode: 'forwards' }}
          onClick={() => setDialogOpen(true)}
        >
          <div
            className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center text-xl
              glass-1 group-hover:shadow-glow-blue transition-all duration-300"
          >
            +
          </div>
          <p className="font-medium text-white/80 mb-1">New Tree</p>
          <p className="text-xs text-white/35">Start a new learning session</p>
        </div>

        {/* Session history */}
        <div className="animate-[fadeUp_0.5s_ease_0.2s_forwards] opacity-0" style={{ animationFillMode: 'forwards' }}>
          <p className="text-xs text-white/35 tracking-widest uppercase mb-4">Your Trees</p>
          <div className="grid gap-3">
            {MOCK_TREES.map((tree) => (
              <TreeCard
                key={tree.id}
                tree={tree}
                onClick={() => handleOpenTree(tree.id)}
              />
            ))}
          </div>
        </div>

        {loading && (
          <div className="fixed inset-0 z-40 flex items-center justify-center"
            style={{ background: 'rgba(17,19,21,0.7)', backdropFilter: 'blur(8px)' }}>
            <div className="glass-3 rounded-2xl px-8 py-6 text-center">
              <div className="text-2xl mb-2 animate-pulse">⚡</div>
              <p className="text-sm text-white/60 font-mono tracking-widest">LOADING CIRCUIT…</p>
            </div>
          </div>
        )}
      </main>

      {/* NewTreeDialog — multi-step flow (Golden Rule: never navigate directly from + NewTree) */}
      {dialogOpen && (
        <NewTreeDialog onClose={() => setDialogOpen(false)} />
      )}
    </div>
  )
}
