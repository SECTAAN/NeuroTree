import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import MyTreesModal from '../dashboard/MyTreesModal'

/**
 * HamburgerSidebar — glass slide-in panel from the left.
 * Opens when the ☰ button in CollapsibleHeader is clicked.
 * Provides navigation: My Trees (modal), Career Map, Session info.
 *
 * "My Trees" opens MyTreesModal floating above the canvas so the user
 * never loses their place in the Skill Tree.
 */
export default function HamburgerSidebar({ open, onClose }) {
  const { navigateTo, sessionId, graphData } = useApp()
  const overlayRef = useRef(null)
  const [myTreesOpen, setMyTreesOpen] = useState(false)

  // Close on Escape key
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

  // Generic nav item — closes sidebar then fires action
  const navItem = (label, icon, action, accent = false) => (
    <button
      key={label}
      onClick={() => { onClose(); action() }}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors hover:bg-white/8 text-left"
      style={{ color: accent ? 'rgba(0,243,255,0.85)' : 'rgba(240,242,245,0.65)' }}
    >
      <span className="w-5 text-center opacity-70 text-base">{icon}</span>
      {label}
    </button>
  )

  return (
    <>
      {/* ── Dark backdrop ──────────────────────────────────────────────── */}
      <div
        ref={overlayRef}
        onClick={onClose}
        className="fixed inset-0 z-40 transition-opacity duration-300"
        style={{
          background: 'rgba(0,0,0,0.55)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
      />

      {/* ── Sidebar panel ──────────────────────────────────────────────── */}
      <aside
        className="fixed top-0 left-0 h-full z-50 flex flex-col"
        style={{
          width: 260,
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
          background: 'rgba(18,20,24,0.92)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRight: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-5 pb-4 border-b border-white/5">
          <span
            className="text-sm font-semibold tracking-widest uppercase"
            style={{ color: 'rgba(0,243,255,0.7)' }}
          >
            NeuroTree
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg glass-1 flex items-center justify-center text-white/30 hover:text-white/60 text-xs transition-colors"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 flex flex-col gap-1 overflow-y-auto px-2">
          <p className="px-4 py-1 text-[10px] text-white/20 uppercase tracking-widest">Navigate</p>

          {/* My Trees — opens floating modal, preserves canvas state */}
          <button
            onClick={() => { onClose(); setMyTreesOpen(true) }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors hover:bg-white/8 text-left"
            style={{ color: 'rgba(240,242,245,0.65)' }}
          >
            <span className="w-5 text-center opacity-70 text-base">🌳</span>
            My Trees
          </button>

          {navItem('Skill Tree', '⚡', () => navigateTo('skilltree'), true)}
          {navItem('Career Map', '🗺️', () => navigateTo('careermap'))}

          {/* Divider */}
          <div className="mx-4 my-2 h-px bg-white/5" />

          <p className="px-4 py-1 text-[10px] text-white/20 uppercase tracking-widest">Circuit Status</p>

          {/* Stats mini-card */}
          <div className="mx-2 p-3 rounded-xl glass-1 flex flex-col gap-2">
            <div className="flex justify-between text-xs text-white/40">
              <span>Nodes unlocked</span>
              <span style={{ color: 'rgba(0,243,255,0.7)' }}>{unlockedNodes}/{totalNodes}</span>
            </div>
            <div className="flex justify-between text-xs text-white/40">
              <span>Avg mastery</span>
              <span style={{ color: 'rgba(0,243,255,0.7)' }}>{avgMastery}%</span>
            </div>
            {/* Mastery bar */}
            <div className="w-full h-1 rounded-full bg-white/8 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${avgMastery}%`,
                  background: 'linear-gradient(90deg, rgba(0,243,255,0.7), rgba(77,124,254,0.5))',
                }}
              />
            </div>
          </div>
        </nav>

        {/* Footer — session ID */}
        <div className="px-4 py-4 border-t border-white/5">
          <p className="text-[10px] text-white/20 font-mono">Session: {shortSession}</p>
        </div>
      </aside>

      {/* ── MyTreesModal — rendered outside sidebar so it appears above everything ── */}
      <MyTreesModal
        open={myTreesOpen}
        onClose={() => setMyTreesOpen(false)}
      />
    </>
  )
}
