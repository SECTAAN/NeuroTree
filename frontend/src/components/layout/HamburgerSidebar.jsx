import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import MyTreesModal from '../dashboard/MyTreesModal'

/**
 * HamburgerSidebar — slide-in panel from the left.
 * M-19: Skeuomorphic clay surface, NeuroTree brand colours.
 */
export default function HamburgerSidebar({ open, onClose }) {
  const { navigateTo, sessionId, graphData } = useApp()
  const overlayRef = useRef(null)
  const [myTreesOpen, setMyTreesOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const totalNodes    = graphData?.nodes?.length ?? 0
  const unlockedNodes = graphData?.nodes?.filter((n) => n.status !== 'locked').length ?? 0
  const avgMastery    = totalNodes
    ? Math.round(graphData.nodes.reduce((s, n) => s + (n.mastery_score ?? 0), 0) / totalNodes)
    : 0

  const shortSession = sessionId ? sessionId.slice(0, 8) + '…' : '—'

  return (
    <>
      {/* Backdrop */}
      <div
        ref={overlayRef}
        onClick={onClose}
        className="fixed inset-0 z-40 transition-opacity duration-300 nt-modal-backdrop"
        style={{ opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
      />

      {/* Sidebar panel */}
      <aside
        className="fixed top-0 left-0 h-full z-50 flex flex-col clay-surface"
        style={{
          width: 260,
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
          borderRight: '1px solid var(--nt-border)',
          boxShadow: '4px 0 20px rgba(53,78,71,0.08)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 pt-5 pb-4"
          style={{ borderBottom: '1px solid var(--nt-border)' }}
        >
          <span
            className="text-sm font-serif font-semibold"
            style={{ color: 'var(--nt-primary)' }}
          >
            NeuroTree
          </span>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs
              transition-colors duration-150"
            style={{ color: 'var(--nt-text-3)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--nt-text)'; e.currentTarget.style.background = 'rgba(53,78,71,0.07)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--nt-text-3)'; e.currentTarget.style.background = 'transparent' }}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 flex flex-col gap-0.5 overflow-y-auto px-2">
          <p
            className="px-4 py-1 text-[10px] uppercase tracking-widest font-semibold"
            style={{ color: 'var(--nt-text-3)' }}
          >
            Navigate
          </p>

          <NavButton icon="🌳" label="My Trees"
            onClick={() => { onClose(); setMyTreesOpen(true) }} />
          <NavButton icon="🌿" label="Skill Tree" accent
            onClick={() => { onClose(); navigateTo('skilltree') }} />
          <NavButton icon="🗺️" label="Career Map"
            onClick={() => { onClose(); navigateTo('careermap') }} />

          <div className="mx-4 my-2 h-px" style={{ background: 'var(--nt-border)' }} />

          <p
            className="px-4 py-1 text-[10px] uppercase tracking-widest font-semibold"
            style={{ color: 'var(--nt-text-3)' }}
          >
            Progress
          </p>

          {/* Stats card */}
          <div className="mx-2 my-1 p-3 rounded-xl clay-card flex flex-col gap-2.5">
            <div className="flex justify-between items-center text-xs">
              <span style={{ color: 'var(--nt-text-3)' }}>Nodes unlocked</span>
              <span className="font-semibold tabular-nums" style={{ color: 'var(--nt-primary)' }}>
                {unlockedNodes}/{totalNodes}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span style={{ color: 'var(--nt-text-3)' }}>Avg mastery</span>
              <span className="font-semibold tabular-nums" style={{ color: 'var(--nt-primary)' }}>
                {avgMastery}%
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden"
              style={{ background: 'var(--nt-bg-3)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${avgMastery}%`,
                  background: 'linear-gradient(90deg, var(--nt-primary), var(--nt-coral))',
                }}
              />
            </div>
          </div>
        </nav>

        {/* Footer */}
        <div
          className="px-4 py-4"
          style={{ borderTop: '1px solid var(--nt-border)' }}
        >
          <p className="text-[10px]" style={{ color: 'var(--nt-text-3)', fontFamily: 'monospace' }}>
            Session: {shortSession}
          </p>
        </div>
      </aside>

      <MyTreesModal open={myTreesOpen} onClose={() => setMyTreesOpen(false)} />
    </>
  )
}

function NavButton({ icon, label, onClick, accent = false }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-left
        transition-colors duration-150"
      style={{ color: accent ? 'var(--nt-primary)' : 'var(--nt-text-2)' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(53,78,71,0.07)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      <span className="w-5 text-center text-base leading-none">{icon}</span>
      {label}
    </button>
  )
}
