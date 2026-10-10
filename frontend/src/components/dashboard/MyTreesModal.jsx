import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { graphApi } from '../../services/api'

/**
 * MyTreesModal — floating modal listing the user's saved trees.
 * M-19: full --nt-* palette. All neon/dark removed.
 */

// ── TreeRow — compact card for the modal list ─────────────────────────────────
function TreeRow({ tree, onClick, active }) {
  const [hovered, setHovered] = useState(false)

  // Mastery color uses 70-point rule
  const masteryIsDone = tree.mastery >= 70
  const masteryColor  = masteryIsDone ? 'var(--nt-primary-lt)' :
                        tree.mastery > 0 ? 'var(--nt-coral)' :
                        'var(--nt-text-3)'

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full text-left rounded-2xl px-4 py-3.5 transition-all duration-200 flex items-center gap-4"
      style={{
        background: active || hovered ? 'rgba(53,78,71,0.08)' : 'var(--nt-bg-2)',
        border:     active  ? '1px solid rgba(53,78,71,0.35)'  :
                    hovered ? '1px solid rgba(53,78,71,0.22)'  :
                              '1px solid var(--nt-border)',
        boxShadow: active ? 'var(--nt-shadow-in)' : 'var(--nt-shadow-out-sm)',
      }}
    >
      {/* Mastery indicator dot */}
      <div
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{
          background: masteryColor,
          boxShadow: masteryIsDone ? `0 0 6px rgba(53,78,71,0.40)` : 'none',
        }}
      />

      {/* Name + last-studied */}
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate font-medium" style={{ color: 'var(--nt-text)' }}>{tree.name}</p>
        <p className="text-xs" style={{ color: 'var(--nt-text-3)' }}>{tree.lastStudied}</p>
      </div>

      {/* Mastery % */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="text-xs font-mono" style={{ color: masteryColor }}>
          {Math.round(tree.mastery)}%
        </span>
        <div className="nt-track w-16 h-1 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${tree.mastery}%`,
              background: masteryIsDone
                ? 'linear-gradient(90deg, var(--nt-primary), var(--nt-primary-lt))'
                : 'var(--nt-coral)',
            }}
          />
        </div>
      </div>
    </button>
  )
}

// ── MyTreesModal ──────────────────────────────────────────────────────────────
export default function MyTreesModal({ open, onClose }) {
  const { navigateTo, sessionId, setGraphData, setTreeName, setLearningGoal, setActiveSessionId } = useApp()

  const [trees, setTrees]                   = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [loadingTreeId, setLoadingTreeId]     = useState(null)

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
      .catch(() => { if (!cancelled) setSessionsLoading(false) })
    return () => { cancelled = true }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  async function handleSelectTree(tree) {
    setLoadingTreeId(tree.id)
    setActiveSessionId(tree.id)
    setTreeName(tree.treeName || tree.name || '')
    setLearningGoal(tree.learningGoal || '')
    try {
      const { data } = await graphApi.fetchGraph()
      setGraphData(data)
    } catch {
      // Silently fall through
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
        className="fixed inset-0 z-40 transition-opacity duration-200 nt-modal-backdrop"
        style={{
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
            background: 'var(--nt-bg)',
            border: '1px solid var(--nt-border)',
            boxShadow: 'var(--nt-shadow-out)',
          }}
        >
          {/* ── Header ─────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 nt-modal-header">
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--nt-text)' }}>
                My Trees
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--nt-text-3)' }}>
                {sessionsLoading
                  ? 'Loading…'
                  : `${trees.length} learning tree${trees.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-xl nt-card flex items-center justify-center text-xs transition-colors"
              style={{ color: 'var(--nt-text-3)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--nt-coral)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--nt-text-3)' }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* ── Tree list ──────────────────────────────────────────────── */}
          <div className="px-3 py-3 flex flex-col gap-2 max-h-72 overflow-y-auto">
            {sessionsLoading && (
              <div className="py-6 text-center flex flex-col items-center gap-3">
                <div className="nt-spinner" />
                <p className="text-xs" style={{ color: 'var(--nt-text-3)' }}>
                  Loading trees…
                </p>
              </div>
            )}

            {!sessionsLoading && trees.length === 0 && (
              <div className="py-6 text-center">
                <p className="text-xs" style={{ color: 'var(--nt-text-3)' }}>
                  No trees yet. Create one from the Dashboard.
                </p>
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
          <div
            className="px-5 py-4 flex items-center justify-between"
            style={{ borderTop: '1px solid var(--nt-border)' }}
          >
            <button
              onClick={() => { onClose(); navigateTo('dashboard') }}
              className="text-xs transition-colors flex items-center gap-1.5"
              style={{ color: 'var(--nt-text-3)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--nt-primary-lt)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--nt-text-3)' }}
            >
              ← Full Dashboard
            </button>

            {isLoading && (
              <span
                className="text-xs flex items-center gap-1.5"
                style={{ color: 'var(--nt-text-3)' }}
              >
                <div className="nt-spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} />
                Loading…
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
