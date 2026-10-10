import { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { graphApi } from '../services/api'
import NewTreeDialog from '../components/newtree/NewTreeDialog'
import BackgroundRippleEffect from '../components/ui/BackgroundRippleEffect'

// Mastery colour using new palette
function masteryColor(pct) {
  if (pct >= 70) return { line: 'var(--nt-primary)',    glow: 'rgba(53,78,71,0.40)'   }
  if (pct >  0)  return { line: 'var(--nt-coral)',      glow: 'rgba(219,98,113,0.35)' }
  return           { line: 'var(--nt-text-3)',          glow: 'transparent'            }
}

// ── TreeCard ──────────────────────────────────────────────────────────────────
function TreeCard({ tree, onClick, onRename, onDelete }) {
  const { line } = masteryColor(tree.mastery)
  const [menuOpen,   setMenuOpen]   = useState(false)
  const [renaming,   setRenaming]   = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [newName,    setNewName]    = useState(tree.name)
  const [saving,     setSaving]     = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const inputRef = useRef(null)
  const menuRef  = useRef(null)

  useEffect(() => { if (renaming) inputRef.current?.focus() }, [renaming])

  useEffect(() => {
    if (!menuOpen) return
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  async function handleSaveRename(e) {
    e.preventDefault()
    const trimmed = newName.trim()
    if (!trimmed || trimmed === tree.name) { setRenaming(false); return }
    setSaving(true)
    try { await onRename(tree.id, trimmed) }
    finally { setSaving(false); setRenaming(false) }
  }

  async function handleConfirmDelete() {
    setDeleting(true)
    try { await onDelete(tree.id) }
    finally { setDeleting(false); setConfirmDel(false) }
  }

  // Delete confirmation overlay
  if (confirmDel) {
    return (
      <div className="clay-card rounded-3xl p-5">
        <p className="text-sm font-semibold mb-1" style={{ color: 'var(--nt-text)' }}>
          Delete "{tree.name}"?
        </p>
        <p className="text-xs mb-4" style={{ color: 'var(--nt-text-3)' }}>
          All nodes, edges and mastery progress will be permanently removed.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setConfirmDel(false)}
            disabled={deleting}
            className="flex-1 clay-card rounded-xl py-2 text-xs disabled:opacity-40 hover:-translate-y-0.5 transition-transform"
            style={{ color: 'var(--nt-text-2)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmDelete}
            disabled={deleting}
            className="flex-1 rounded-xl py-2 text-xs font-medium disabled:opacity-40 transition-all"
            style={{
              background: 'rgba(219,98,113,0.08)',
              border: '1px solid rgba(219,98,113,0.30)',
              color: 'var(--nt-coral)',
            }}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="clay-card rounded-3xl p-5 relative group">

      {/* Top row */}
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
              className="nt-input flex-1 px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
            />
            <button
              type="submit"
              disabled={saving || !newName.trim()}
              className="text-xs px-2.5 py-1.5 rounded-lg disabled:opacity-40 transition-colors"
              style={{
                color: 'var(--nt-primary)',
                border: '1px solid rgba(53,78,71,0.3)',
                background: 'rgba(53,78,71,0.07)',
              }}
            >
              {saving ? '…' : '✓'}
            </button>
            <button
              type="button"
              onClick={() => { setRenaming(false); setNewName(tree.name) }}
              className="text-xs px-2.5 py-1.5 rounded-lg transition-colors"
              style={{
                color: 'var(--nt-text-3)',
                border: '1px solid var(--nt-border)',
              }}
            >
              ✕
            </button>
          </form>
        ) : (
          <>
            <button
              onClick={onClick}
              className="flex-1 text-left text-sm font-semibold transition-colors"
              style={{ color: 'var(--nt-text)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--nt-primary)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--nt-text)' }}
            >
              {tree.name}
            </button>

            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs" style={{ color: 'var(--nt-text-3)' }}>
                {tree.lastStudied}
              </span>

              <div className="relative" ref={menuRef}>
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-base leading-none transition-colors"
                  style={{ color: 'var(--nt-text-3)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--nt-text)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--nt-text-3)' }}
                  title="Tree actions"
                  aria-label="Tree actions"
                >
                  ⋯
                </button>

                {menuOpen && (
                  <div
                    className="absolute right-0 top-8 z-20 rounded-2xl overflow-hidden"
                    style={{
                      minWidth: 140,
                      background: 'var(--nt-surface)',
                      border: '1px solid var(--nt-border)',
                      boxShadow: 'var(--nt-shadow-out-sm)',
                    }}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setNewName(tree.name); setRenaming(true) }}
                      className="w-full text-left px-4 py-2.5 text-xs transition-colors"
                      style={{ color: 'var(--nt-text-2)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(53,78,71,0.07)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                    >
                      ✏️ Rename
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setConfirmDel(true) }}
                      className="w-full text-left px-4 py-2.5 text-xs transition-colors"
                      style={{ color: 'var(--nt-coral)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(219,98,113,0.06)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
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

      {/* Mastery bar */}
      <button onClick={renaming ? undefined : onClick} className="w-full text-left">
        <div className="h-1.5 rounded-full overflow-hidden mb-2.5"
          style={{ background: 'var(--nt-bg-3)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${tree.mastery}%`,
              background: `linear-gradient(90deg, ${line}, var(--nt-primary-lt))`,
            }}
          />
        </div>
        <div className="flex justify-between text-xs" style={{ color: 'var(--nt-text-3)' }}>
          <span className="font-medium" style={{ color: line }}>{Math.round(tree.mastery)}%</span>
          <span>{tree.nodes} nodes</span>
        </div>
      </button>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptySessionState({ onNewTree }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="clay-icon w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center">
        <span className="text-2xl" style={{ color: 'var(--nt-text-3)' }}>🌱</span>
      </div>
      <p className="text-sm font-medium mb-1" style={{ color: 'var(--nt-text-2)' }}>
        No trees yet
      </p>
      <p className="text-xs mb-4" style={{ color: 'var(--nt-text-3)' }}>
        Create your first learning session to get started.
      </p>
      <button
        onClick={onNewTree}
        className="nt-btn-secondary px-5 py-2 rounded-xl text-xs hover:-translate-y-0.5 transition-transform"
        style={{ color: 'var(--nt-text-2)' }}
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
  const [dialogOpen, setDialogOpen]           = useState(false)
  const [headerCollapsed, setHeaderCollapsed] = useState(false)
  const [navLoading, setNavLoading]           = useState(false)

  const [sessions, setSessions]               = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [sessionsError, setSessionsError]     = useState(null)

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
      .catch((err) => { setSessionsError(err.message); setSessionsLoading(false) })
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])

  async function handleOpenTree(tree) {
    setNavLoading(true)
    setActiveSessionId(tree.id)
    setTreeName(tree.treeName || tree.name || '')
    setLearningGoal(tree.learningGoal || '')
    try {
      const { data } = await graphApi.fetchGraph()
      setGraphData(data)
      navigateTo('skilltree')
    } catch { navigateTo('skilltree') }
    finally { setNavLoading(false) }
  }

  async function handleRename(sessionId, newName) {
    await graphApi.renameSession(sessionId, newName)
    loadSessions()
  }

  async function handleDelete(sid) {
    await graphApi.deleteSession(sid)
    if (sid === activeSessionId) {
      setActiveSessionId(null)
      setGraphData({ nodes: [], edges: [] })
      setTreeName('')
      setLearningGoal('')
    }
    loadSessions()
  }

  return (
    <div className="w-full h-full bg-app flex flex-col overflow-hidden relative">

      {/* ── Aceternity cell-ripple grid — click anywhere to ripple ────────── */}
      <BackgroundRippleEffect cellSize={60} rippleSpeed={200} className="z-0" />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header
        className="clay-header mx-4 mt-4 rounded-2xl flex-shrink-0
          transition-all duration-300 overflow-hidden"
        style={{ height: headerCollapsed ? 52 : 64 }}
      >
        <div className="flex items-center justify-between px-5 h-full">
          <div className="flex items-center gap-3">
            <div
              className="clay-icon w-8 h-8 rounded-xl flex items-center justify-center
                text-xs font-semibold"
              style={{ color: 'var(--nt-primary)' }}
            >
              NT
            </div>
            {!headerCollapsed && (
              <span
                className="font-serif font-semibold text-sm"
                style={{ color: 'var(--nt-primary)', letterSpacing: '0.05em' }}
              >
                NeuroTree
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!headerCollapsed && (
              <span className="text-xs" style={{ color: 'var(--nt-text-3)', fontFamily: 'monospace' }}>
                {sessionId.slice(0, 8)}…
              </span>
            )}
            <button
              onClick={() => setHeaderCollapsed((v) => !v)}
              className="clay-icon w-7 h-7 rounded-lg flex items-center justify-center
                text-xs transition-colors duration-200"
              style={{ color: 'var(--nt-text-3)' }}
              title={headerCollapsed ? 'Expand header' : 'Collapse header'}
            >
              {headerCollapsed ? '↓' : '↑'}
            </button>
          </div>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto px-4 py-6">

        {/* Welcome */}
        <div className="mb-8 animate-[fadeUp_0.5s_ease_forwards]">
          <p className="text-xs tracking-widest uppercase mb-1" style={{ color: 'var(--nt-text-3)' }}>
            Welcome back
          </p>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--nt-text)' }}>
            Continue your learning journey
          </h1>
        </div>

        {/* New Tree CTA */}
        <div
          className="animate-[fadeUp_0.5s_ease_0.1s_forwards] opacity-0 mb-8"
          style={{ animationFillMode: 'forwards' }}
        >
          <button
            onClick={() => setDialogOpen(true)}
            className="clay-card w-full rounded-3xl p-8 text-center
              hover:-translate-y-1 active:translate-y-0 active:scale-[0.99] transition-all duration-300"
          >
            {/* Decorative organic ring */}
            <div className="relative mx-auto mb-4 w-16 h-16">
              <div
                className="clay-icon w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ fontSize: 26 }}
              >
                🌱
              </div>
            </div>
            <p className="font-semibold text-base mb-1" style={{ color: 'var(--nt-text)' }}>
              New Tree
            </p>
            <p className="text-sm" style={{ color: 'var(--nt-text-3)' }}>
              Start a new learning session
            </p>
          </button>
        </div>

        {/* Session list */}
        <div
          className="animate-[fadeUp_0.5s_ease_0.2s_forwards] opacity-0"
          style={{ animationFillMode: 'forwards' }}
        >
          <p className="text-xs tracking-widest uppercase mb-4" style={{ color: 'var(--nt-text-3)' }}>
            Your Trees
          </p>

          {sessionsLoading && (
            <div className="grid gap-4">
              {[1, 2].map((i) => (
                <div key={i} className="clay-card rounded-3xl p-5 animate-pulse">
                  <div className="h-3 rounded mb-3 w-1/2" style={{ background: 'var(--nt-bg-3)' }} />
                  <div className="h-1.5 rounded mb-2.5" style={{ background: 'var(--nt-bg-3)' }} />
                  <div className="h-3 rounded w-1/4" style={{ background: 'var(--nt-bg-3)' }} />
                </div>
              ))}
            </div>
          )}

          {!sessionsLoading && sessionsError && (
            <div className="text-center py-8">
              <p className="text-xs" style={{ color: 'var(--nt-text-3)' }}>
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

        {/* Nav loading overlay */}
        {navLoading && (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center nt-modal-backdrop"
          >
            <div className="glass-3 rounded-2xl px-8 py-6 text-center">
              <div
                className="w-10 h-10 rounded-full mx-auto mb-4 organic-pulse"
                style={{ border: '2px solid var(--nt-primary)', borderTopColor: 'var(--nt-coral)' }}
              />
              <p className="text-sm font-medium" style={{ color: 'var(--nt-text-2)' }}>
                Loading tree…
              </p>
            </div>
          </div>
        )}
      </main>

      {dialogOpen && (
        <NewTreeDialog onClose={() => { setDialogOpen(false); loadSessions() }} />
      )}
    </div>
  )
}
