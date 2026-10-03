import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { graphApi } from '../../services/api'

/**
 * MyTreesModal — floating glass-3 modal that lists the user's saved trees.
 * Opened from HamburgerSidebar so users can switch trees without leaving
 * the Skill Tree canvas.
 *
 * F-6 P0-1: loads real session data from GET /api/v1/sessions.
 * Uses the same API and mapping logic as Dashboard.jsx.
 */

// ── TreeRow — compact card for the modal list ─────────────────────────────────
function TreeRow({ tree, onClick, active }) {
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
      className="w-full text-left rounded-2xl px-4 py-3.5 transition-all duration-200 flex items-center gap-4"
      style={{
        background:  hovered || active ? 'rgba(0,243,255,0.05)' : 'rgba(255,255,255,0.02)',
        border:      `1px solid ${active ? 'rgba(0,243,255,0.3)' : hovered ? 'rgba(0,243,255,0.15)' : 'rgba(255,255,255,0.06)'}`,
        boxShadow:   active ? '0 0 14px rgba(0,243,255,0.08)' : undefined,
      }}
    >
      {/* Lamp indicator */}
      <div
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{
          background: masteryColor,
          boxShadow: `0 0 6px ${masteryColor}`,
        }}
      />

      {/* Name + last-studied */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/85 truncate">{tree.name}</p>
        <p className="text-xs text-white/30">{tree.lastStudied}</p>
      </div>

      {/* Mastery % */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="text-xs font-mono" style={{ color: masteryColor }}>{Math.round(tree.mastery)}%</span>
        <div className="w-16 h-0.5 rounded-full bg-white/8 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${tree.mastery}%`,
              background: masteryColor,
            }}
          />
        </div>
      </div>
    </button>
  )
}

// ── MyTreesModal ──────────────────────────────────────────────────────────────
export default function MyTreesModal({ open, onClose }) {
  const { navigateTo, sessionId, setGraphData, setTreeName, setLearningGoal } = useApp()

  // ── Real session data (mirrors Dashboard.jsx mapping) ─────────────────────
  const [trees, setTrees]           = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [loadingTreeId, setLoadingTreeId]     = useState(null)  // session_id being opened

  // Fetch sessions whenever the modal opens
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setSessionsLoading(true)
    graphApi.fetchSessions()
      .then(({ data }) => {
        if (cancelled) return
        const mapped = (data.sessions || []).map((s) => ({
          id:           s.session_id,
          name:         s.tree_name || 'My Tree',
          mastery:      s.avg_mastery ?? 0,
          nodes:        s.total_nodes ?? 0,
          lastStudied:  s.last_studied || 'Today',
          treeName:     s.tree_name,
          learningGoal: s.learning_goal,
        }))
        setTrees(mapped)
        setSessionsLoading(false)
      })
      .catch(() => {
        if (!cancelled) setSessionsLoading(false)
      })
    return () => { cancelled = true }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  async function handleSelectTree(tree) {
    setLoadingTreeId(tree.id)
    // Set tree identity in context immediately (same pattern as Dashboard.jsx)
    setTreeName(tree.treeName || tree.name || '')
    setLearningGoal(tree.learningGoal || '')
    try {
      const { data } = await graphApi.fetchGraph()
      setGraphData(data)
    } catch {
      // Silently fall through — SkillTree page will re-fetch on mount
    } finally {
      setLoadingTreeId(null)
    }
    onClose()
    navigateTo('skilltree', { treeName: tree.treeName || tree.name, learningGoal: tree.learningGoal || '' })
  }

  const isLoading = loadingTreeId !== null

  return (
    <>
      {/* ── Backdrop ─────────────────────────────────────────────────────── */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 transition-opacity duration-200"
        style={{
          background: 'rgba(0,0,0,0.50)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
      />

      {/* ── Modal panel ──────────────────────────────────────────────────── */}
      <div
        className="fixed z-50 top-1/2 left-1/2"
        style={{
          transform: open
            ? 'translate(-50%, -50%) scale(1)'
            : 'translate(-50%, -50%) scale(0.96)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1), opacity 0.22s ease',
          width: 'min(440px, calc(100vw - 32px))',
        }}
      >
        <div
          className="rounded-3xl flex flex-col overflow-hidden"
          style={{
            background: 'rgba(16,18,22,0.96)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,243,255,0.06)',
          }}
        >
          {/* ── Header ─────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/5">
            <div>
              <h2 className="text-sm font-semibold text-white/90">My Trees</h2>
              <p className="text-xs text-white/30 mt-0.5">
                {sessionsLoading ? 'Loading…' : `${trees.length} learning circuit${trees.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-xl glass-1 flex items-center justify-center text-white/30
                hover:text-white/70 text-xs transition-colors"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* ── Tree list ──────────────────────────────────────────────── */}
          <div className="px-3 py-3 flex flex-col gap-2 max-h-72 overflow-y-auto">
            {sessionsLoading && (
              <div className="py-6 text-center">
                <p className="text-xs text-white/30 font-mono animate-pulse tracking-widest">
                  LOADING CIRCUITS…
                </p>
              </div>
            )}

            {!sessionsLoading && trees.length === 0 && (
              <div className="py-6 text-center">
                <p className="text-xs text-white/25">No trees yet. Create one from the Dashboard.</p>
              </div>
            )}

            {!sessionsLoading && trees.map((tree) => (
              <TreeRow
                key={tree.id}
                tree={tree}
                active={tree.id === sessionId}
                onClick={() => !isLoading && handleSelectTree(tree)}
              />
            ))}
          </div>

          {/* ── Footer ─────────────────────────────────────────────────── */}
          <div className="px-5 py-4 border-t border-white/5 flex items-center justify-between">
            <button
              onClick={() => { onClose(); navigateTo('dashboard') }}
              className="text-xs text-white/35 hover:text-white/60 transition-colors flex items-center gap-1.5"
            >
              ← Full Dashboard
            </button>

            {/* Loading indicator while fetching graph */}
            {isLoading && (
              <span className="text-xs text-white/30 font-mono animate-pulse flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent-cyan animate-ping" />
                Loading circuit…
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
