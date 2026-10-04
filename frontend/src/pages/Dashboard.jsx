import { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { graphApi } from '../services/api'
import NewTreeDialog from '../components/newtree/NewTreeDialog'

// Mastery accent colours — cyberpunk neon on clay base
function masteryColor(pct) {
  if (pct >= 70) return { line: '#00d27a', glow: 'rgba(0,210,122,0.45)'  }
  if (pct >  0)  return { line: '#00c8dc', glow: 'rgba(0,200,220,0.45)'  }
  return           { line: '#94a3b8',      glow: 'transparent'            }
}

// ── TreeCard — Claymorphism with Rename + Delete ──────────────────────────────
// States per card:
//   default     — normal view, ⋯ button reveals action menu
//   menuOpen    — action menu visible (Rename / Delete)
//   renaming    — inline text input for new name
//   confirmDel  — delete confirmation
function TreeCard({ tree, onClick, onRename, onDelete }) {
  const { line, glow } = masteryColor(tree.mastery)
  const [menuOpen,    setMenuOpen]    = useState(false)
  const [renaming,    setRenaming]    = useState(false)
  const [confirmDel,  setConfirmDel]  = useState(false)
  const [newName,     setNewName]     = useState(tree.name)
  const [saving,      setSaving]      = useState(false)
  const [deleting,    setDeleting]    = useState(false)
  const inputRef = useRef(null)
  const menuRef  = useRef(null)

  // Focus the input as soon as rename mode activates
  useEffect(() => {
    if (renaming) inputRef.current?.focus()
  }, [renaming])

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  async function handleSaveRename(e) {
    e.preventDefault()
    const trimmed = newName.trim()
    if (!trimmed || trimmed === tree.name) { setRenaming(false); return }
    setSaving(true)
    try {
      await onRename(tree.id, trimmed)
    } finally {
      setSaving(false)
      setRenaming(false)
    }
  }

  async function handleConfirmDelete() {
    setDeleting(true)
    try {
      await onDelete(tree.id)
    } finally {
      setDeleting(false)
      setConfirmDel(false)
    }
  }

  // ── Delete confirmation overlay ───────────────────────────────────────────
  if (confirmDel) {
    return (
      <div className="clay-card rounded-3xl p-5">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
          Delete "{tree.name}"?
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
          All nodes, edges and mastery progress will be permanently removed.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setConfirmDel(false)}
            disabled={deleting}
            className="flex-1 clay-card rounded-xl py-2 text-xs text-slate-600 dark:text-slate-300
              hover:-translate-y-0.5 transition-transform duration-200 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmDelete}
            disabled={deleting}
            className="flex-1 rounded-xl py-2 text-xs font-medium text-red-500 dark:text-red-400
              transition-all duration-200 disabled:opacity-40"
            style={{ border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.06)' }}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="clay-card rounded-3xl p-5 relative group">

      {/* ── Top row: name / rename input + ⋯ menu ─────────────────────────── */}
      <div className="flex items-start justify-between mb-3 gap-2">
        {renaming ? (
          <form onSubmit={handleSaveRename} className="flex-1 flex gap-2 items-center">
            <input
              ref={inputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setRenaming(false)}
              maxLength={255}
              disabled={saving}
              className="flex-1 rounded-xl px-3 py-1.5 text-sm font-semibold
                text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800
                border border-slate-300 dark:border-slate-600 focus:outline-none
                focus:border-cyan-400 dark:focus:border-cyan-500 disabled:opacity-40"
            />
            <button
              type="submit"
              disabled={saving || !newName.trim()}
              className="text-xs px-2.5 py-1.5 rounded-lg text-cyan-600 dark:text-cyan-400
                border border-cyan-400/40 bg-cyan-50 dark:bg-cyan-900/20
                hover:bg-cyan-100 dark:hover:bg-cyan-900/40 disabled:opacity-40 transition-colors"
            >
              {saving ? '…' : '✓'}
            </button>
            <button
              type="button"
              onClick={() => { setRenaming(false); setNewName(tree.name) }}
              className="text-xs px-2.5 py-1.5 rounded-lg text-slate-500 dark:text-slate-400
                border border-slate-300/40 hover:bg-slate-100 dark:hover:bg-slate-700/40
                transition-colors"
            >
              ✕
            </button>
          </form>
        ) : (
          <>
            {/* Clicking the name area opens the tree */}
            <button
              onClick={onClick}
              className="flex-1 text-left text-sm font-semibold text-slate-700 dark:text-slate-200
                hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
            >
              {tree.name}
            </button>

            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {tree.lastStudied}
              </span>

              {/* ⋯ action trigger */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
                  className="w-6 h-6 rounded-lg flex items-center justify-center
                    text-slate-400 dark:text-slate-500
                    hover:text-slate-700 dark:hover:text-slate-200
                    hover:bg-slate-200/60 dark:hover:bg-slate-700/60
                    transition-colors text-base leading-none"
                  title="Tree actions"
                  aria-label="Tree actions"
                >
                  ⋯
                </button>

                {/* Drop-down menu */}
                {menuOpen && (
                  <div
                    className="absolute right-0 top-8 z-20 rounded-xl overflow-hidden shadow-lg"
                    style={{
                      minWidth: 130,
                      background: 'var(--clay-surface, #f1f3f6)',
                      border: '1px solid rgba(0,0,0,0.07)',
                    }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setMenuOpen(false)
                        setNewName(tree.name)
                        setRenaming(true)
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200
                        hover:bg-slate-200/60 dark:hover:bg-slate-700/40 transition-colors"
                    >
                      ✏️ Rename
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setMenuOpen(false)
                        setConfirmDel(true)
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs text-red-500 dark:text-red-400
                        hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      🗑 Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Mastery bar — clicking it also opens the tree */}
      <button onClick={renaming ? undefined : onClick} className="w-full text-left">
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
    </div>
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
  const {
    navigateTo, setGraphData, setTreeName, setLearningGoal,
    sessionId, activeSessionId, setActiveSessionId,
  } = useApp()
  const [dialogOpen, setDialogOpen]         = useState(false)
  const [headerCollapsed, setHeaderCollapsed] = useState(false)
  const [navLoading, setNavLoading]         = useState(false)

  // ── Session list state ────────────────────────────────────────────────────
  const [sessions, setSessions]               = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [sessionsError, setSessionsError]     = useState(null)

  // Memoised fetch so it can be called after rename/delete too
  const loadSessions = useCallback(() => {
    setSessionsLoading(true)
    setSessionsError(null)
    graphApi.fetchSessions()
      .then(({ data }) => {
        const mapped = (data.sessions || []).map((s) => ({
          id:           s.session_id,
          name:         s.tree_name || 'My Tree',
          mastery:      s.avg_mastery ?? 0,
          nodes:        s.total_nodes ?? 0,
          lastStudied:  s.last_studied || 'Today',
          treeName:     s.tree_name,
          learningGoal: s.learning_goal,
        }))
        setSessions(mapped)
        setSessionsLoading(false)
      })
      .catch((err) => {
        setSessionsError(err.message)
        setSessionsLoading(false)
      })
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])

  // ── Open tree ─────────────────────────────────────────────────────────────
  async function handleOpenTree(tree) {
    setNavLoading(true)
    // F-6: set active session BEFORE fetching graph so the request carries
    // the correct X-Session-ID and returns this tree's nodes/edges only.
    setActiveSessionId(tree.id)
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

  // ── Rename ────────────────────────────────────────────────────────────────
  async function handleRename(sessionId, newName) {
    await graphApi.renameSession(sessionId, newName)
    // Refresh list — also syncs treeName in context if this is the active tree
    loadSessions()
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete(sid) {
    await graphApi.deleteSession(sid)
    // If the user deleted the currently active tree, clear session state
    if (sid === activeSessionId) {
      setActiveSessionId(null)
      setGraphData({ nodes: [], edges: [] })
      setTreeName('')
      setLearningGoal('')
    }
    // Refresh list
    loadSessions()
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

          {!sessionsLoading && sessionsError && (
            <div className="text-center py-8">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Could not load sessions — backend may be offline.
              </p>
            </div>
          )}

          {!sessionsLoading && !sessionsError && sessions.length === 0 && (
            <EmptySessionState onNewTree={() => setDialogOpen(true)} />
          )}

          {!sessionsLoading && !sessionsError && sessions.length > 0 && (
            <div className="grid gap-4">
              {sessions.map((tree) => (
                <TreeCard
                  key={tree.id}
                  tree={tree}
                  onClick={() => handleOpenTree(tree)}
                  onRename={handleRename}
                  onDelete={handleDelete}
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
        <NewTreeDialog onClose={() => { setDialogOpen(false); loadSessions() }} />
      )}
    </div>
  )
}
