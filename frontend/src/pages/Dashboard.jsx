import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { graphApi } from '../services/api'
import NewTreeDialog from '../components/newtree/NewTreeDialog'

// Mastery accent colours — cyberpunk neon on clay base
function masteryColor(pct) {
  if (pct >= 80) return { line: '#00d27a', glow: 'rgba(0,210,122,0.45)'  }
  if (pct >= 60) return { line: '#00c8dc', glow: 'rgba(0,200,220,0.45)'  }
  if (pct >= 40) return { line: '#4d7cfe', glow: 'rgba(77,124,254,0.45)' }
  return           { line: '#94a3b8',      glow: 'transparent'            }
}

// ── TreeCard — Claymorphism ───────────────────────────────────────────────────
function TreeCard({ tree, onClick }) {
  const { line, glow } = masteryColor(tree.mastery)

  return (
    <button
      onClick={onClick}
      className="clay-card w-full text-left rounded-3xl p-5
        transition-all duration-300 ease-out
        hover:-translate-y-1 active:translate-y-0 active:scale-[0.99]"
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {tree.name}
        </span>
        <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0 ml-2 mt-px">
          {tree.lastStudied}
        </span>
      </div>

      {/* Mastery bar — thin neon strip on clay surface */}
      <div className="h-1.5 rounded-full overflow-hidden mb-2.5 bg-slate-300/60 dark:bg-slate-700/60">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width:      `${tree.mastery}%`,
            background: `linear-gradient(90deg, ${line}, #4d7cfe)`,
            boxShadow:  `0 0 8px ${glow}`,
          }}
        />
      </div>

      <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500">
        <span className="font-medium" style={{ color: line }}>{Math.round(tree.mastery)}%</span>
        <span>{tree.nodes} nodes</span>
      </div>
    </button>
  )
}

// ── Empty state — shown when no sessions exist yet ────────────────────────────
function EmptySessionState({ onNewTree }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="clay-icon w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center">
        <span className="text-2xl text-slate-400 dark:text-slate-500">⚡</span>
      </div>
      <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
        No trees yet
      </p>
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
        Create your first learning session to get started.
      </p>
      <button
        onClick={onNewTree}
        className="clay-card px-5 py-2 rounded-xl text-xs text-slate-600 dark:text-slate-300
          hover:-translate-y-0.5 transition-transform duration-200"
      >
        + New Tree
      </button>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { navigateTo, setGraphData, setTreeName, setLearningGoal, sessionId } = useApp()
  const [dialogOpen, setDialogOpen]         = useState(false)
  const [headerCollapsed, setHeaderCollapsed] = useState(false)
  const [navLoading, setNavLoading]         = useState(false)

  // ── F-2: real session history ─────────────────────────────────────────────
  const [sessions, setSessions]     = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [sessionsError, setSessionsError]     = useState(null)

  useEffect(() => {
    let cancelled = false
    setSessionsLoading(true)
    graphApi.fetchSessions()
      .then(({ data }) => {
        if (!cancelled) {
          // Map API shape → TreeCard shape
          const mapped = (data.sessions || []).map((s) => ({
            id:          s.session_id,
            name:        s.tree_name || 'My Tree',
            mastery:     s.avg_mastery ?? 0,
            nodes:       s.total_nodes ?? 0,
            lastStudied: s.last_studied || 'Today',
            treeName:    s.tree_name,
            learningGoal: s.learning_goal,
          }))
          setSessions(mapped)
          setSessionsLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSessionsError(err.message)
          setSessionsLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])

  async function handleOpenTree(tree) {
    setNavLoading(true)
    // Set tree identity in context for SkillTree header
    setTreeName(tree.treeName || tree.name || '')
    setLearningGoal(tree.learningGoal || '')
    try {
      const { data } = await graphApi.fetchGraph()
      setGraphData(data)
      navigateTo('skilltree')
    } catch {
      navigateTo('skilltree')
    } finally {
      setNavLoading(false)
    }
  }

  return (
    <div className="w-full h-full bg-app flex flex-col overflow-hidden">

      {/* ── Collapsible Header — Claymorphism ──────────────────────────────── */}
      <header
        className="clay-header mx-4 mt-4 rounded-2xl flex-shrink-0
          transition-all duration-300 overflow-hidden"
        style={{ height: headerCollapsed ? 52 : 64 }}
      >
        <div className="flex items-center justify-between px-5 h-full">
          <div className="flex items-center gap-3">
            {/* Logo mark — concave clay icon */}
            <div
              className="clay-icon w-7 h-7 rounded-lg flex items-center justify-center
                text-xs font-mono text-cyan-500 dark:text-cyan-400"
            >
              NT
            </div>
            {!headerCollapsed && (
              <span
                className="font-mono text-sm tracking-widest text-slate-600 dark:text-slate-300"
                style={{ letterSpacing: '0.2em' }}
              >
                NEUROTREE
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!headerCollapsed && (
              <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                {sessionId.slice(0, 8)}…
              </span>
            )}
            <button
              onClick={() => setHeaderCollapsed((v) => !v)}
              className="clay-icon w-7 h-7 rounded-lg flex items-center justify-center
                text-xs text-slate-500 dark:text-slate-400
                hover:text-slate-700 dark:hover:text-slate-200
                transition-colors duration-200"
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
          <p className="text-xs tracking-widest uppercase mb-1 text-slate-400 dark:text-slate-500">
            Welcome back
          </p>
          <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">
            Continue your learning journey
          </h1>
        </div>

        {/* ── NewTree CTA — Claymorphism ───────────────────────────────────── */}
        <div
          className="animate-[fadeUp_0.5s_ease_0.1s_forwards] opacity-0 mb-8"
          style={{ animationFillMode: 'forwards' }}
        >
          <button
            onClick={() => setDialogOpen(true)}
            className="clay-card w-full rounded-3xl p-8 text-center
              transition-all duration-300 ease-out
              hover:-translate-y-1 active:translate-y-0 active:scale-[0.99]"
          >
            {/* + icon — clay pill */}
            <div className="clay-icon w-14 h-14 rounded-2xl mx-auto mb-4
              flex items-center justify-center text-2xl
              text-slate-500 dark:text-slate-400">
              +
            </div>
            <p className="font-semibold text-base mb-1 text-slate-700 dark:text-slate-200">
              New Tree
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              Start a new learning session
            </p>
          </button>
        </div>

        {/* ── Session history ─────────────────────────────────────────────── */}
        <div
          className="animate-[fadeUp_0.5s_ease_0.2s_forwards] opacity-0"
          style={{ animationFillMode: 'forwards' }}
        >
          <p className="text-xs tracking-widest uppercase mb-4 text-slate-400 dark:text-slate-500">
            Your Trees
          </p>

          {/* Loading skeleton */}
          {sessionsLoading && (
            <div className="grid gap-4">
              {[1, 2].map((i) => (
                <div key={i} className="clay-card rounded-3xl p-5 animate-pulse">
                  <div className="h-3 bg-slate-300/50 dark:bg-slate-700/50 rounded mb-3 w-1/2" />
                  <div className="h-1.5 bg-slate-300/40 dark:bg-slate-700/40 rounded mb-2.5" />
                  <div className="h-3 bg-slate-300/30 dark:bg-slate-700/30 rounded w-1/4" />
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {!sessionsLoading && sessionsError && (
            <div className="text-center py-8">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Could not load sessions — backend may be offline.
              </p>
            </div>
          )}

          {/* Empty state */}
          {!sessionsLoading && !sessionsError && sessions.length === 0 && (
            <EmptySessionState onNewTree={() => setDialogOpen(true)} />
          )}

          {/* Real session cards */}
          {!sessionsLoading && !sessionsError && sessions.length > 0 && (
            <div className="grid gap-4">
              {sessions.map((tree) => (
                <TreeCard
                  key={tree.id}
                  tree={tree}
                  onClick={() => handleOpenTree(tree)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Navigation overlay */}
        {navLoading && (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center"
            style={{ background: 'rgba(17,19,21,0.70)', backdropFilter: 'blur(8px)' }}
          >
            <div className="glass-3 rounded-2xl px-8 py-6 text-center">
              <div className="text-2xl mb-2 animate-pulse">⚡</div>
              <p className="text-sm font-mono tracking-widest text-slate-600 dark:text-white/60">
                LOADING CIRCUIT…
              </p>
            </div>
          </div>
        )}
      </main>

      {/* NewTreeDialog */}
      {dialogOpen && (
        <NewTreeDialog onClose={() => setDialogOpen(false)} />
      )}
    </div>
  )
}
