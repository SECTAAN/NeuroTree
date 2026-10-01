import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import MyTreesModal from '../dashboard/MyTreesModal'

/**
 * HamburgerSidebar — slide-in panel from the left.
 *
 * Theme-aware: uses Tailwind dark: variants + .clay-surface / .clay-card
 * so it switches seamlessly when the html class toggles between
 * 'dark' (default) and 'theme-light'.
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

  return (
    <>
      {/* ── Backdrop ─────────────────────────────────────────────────────── */}
      <div
        ref={overlayRef}
        onClick={onClose}
        className="fixed inset-0 z-40 transition-opacity duration-300"
        style={{
          background: 'rgba(0,0,0,0.45)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
      />

      {/* ── Sidebar panel ────────────────────────────────────────────────── */}
      <aside
        className={[
          // Layout
          'fixed top-0 left-0 h-full z-50 flex flex-col',
          // Theme-aware background — clay-surface handles dark/light bg colour
          'clay-surface',
          // Subtle right border — adaptive opacity
          'border-r border-black/10 dark:border-white/[0.06]',
        ].join(' ')}
        style={{
          width: 260,
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 pt-5 pb-4 border-b border-black/8 dark:border-white/[0.05]">
          <span className="text-sm font-semibold tracking-widest uppercase text-cyan-500 dark:text-cyan-400">
            NeuroTree
          </span>

          {/* Close button — adaptive hover */}
          <button
            onClick={onClose}
            className={[
              'w-7 h-7 rounded-lg flex items-center justify-center text-xs',
              'transition-colors duration-150',
              'text-slate-400 dark:text-slate-500',
              'hover:bg-slate-200 dark:hover:bg-slate-800',
              'hover:text-slate-700 dark:hover:text-slate-200',
            ].join(' ')}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        {/* ── Nav items ────────────────────────────────────────────────── */}
        <nav className="flex-1 py-3 flex flex-col gap-0.5 overflow-y-auto px-2">

          {/* Section label */}
          <p className="px-4 py-1 text-[10px] uppercase tracking-widest font-semibold text-slate-400 dark:text-slate-500">
            Navigate
          </p>

          {/* My Trees */}
          <NavButton
            icon="🌳"
            label="My Trees"
            onClick={() => { onClose(); setMyTreesOpen(true) }}
          />

          {/* Skill Tree — accent */}
          <NavButton
            icon="⚡"
            label="Skill Tree"
            accent
            onClick={() => { onClose(); navigateTo('skilltree') }}
          />

          {/* Career Map */}
          <NavButton
            icon="🗺️"
            label="Career Map"
            onClick={() => { onClose(); navigateTo('careermap') }}
          />

          {/* Divider */}
          <div className="mx-4 my-2 h-px bg-black/8 dark:bg-white/[0.05]" />

          {/* Section label */}
          <p className="px-4 py-1 text-[10px] uppercase tracking-widest font-semibold text-slate-400 dark:text-slate-500">
            Circuit Status
          </p>

          {/* Stats card — Soft Claymorphism, matches Dashboard cards exactly */}
          <div className="mx-2 my-1 p-3 rounded-xl clay-card flex flex-col gap-2.5">

            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 dark:text-slate-400">Nodes unlocked</span>
              <span className="font-semibold text-cyan-500 dark:text-cyan-400 tabular-nums">
                {unlockedNodes}/{totalNodes}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 dark:text-slate-400">Avg mastery</span>
              <span className="font-semibold text-cyan-500 dark:text-cyan-400 tabular-nums">
                {avgMastery}%
              </span>
            </div>

            {/* Mastery progress bar */}
            <div className="w-full h-1.5 rounded-full bg-black/10 dark:bg-white/[0.08] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${avgMastery}%`,
                  background: 'linear-gradient(90deg, rgba(0,243,255,0.75), rgba(77,124,254,0.55))',
                }}
              />
            </div>

          </div>
        </nav>

        {/* ── Footer — session ID ───────────────────────────────────────── */}
        <div className="px-4 py-4 border-t border-black/8 dark:border-white/[0.05]">
          <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
            Session: {shortSession}
          </p>
        </div>
      </aside>

      {/* ── MyTreesModal — above everything ───────────────────────────── */}
      <MyTreesModal
        open={myTreesOpen}
        onClose={() => setMyTreesOpen(false)}
      />
    </>
  )
}

// ── NavButton ─────────────────────────────────────────────────────────────────
/**
 * Single navigation item inside the sidebar.
 * accent=true → cyan tint (for the active/primary route like Skill Tree).
 */
function NavButton({ icon, label, onClick, accent = false }) {
  return (
    <button
      onClick={onClick}
      className={[
        'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-left',
        'transition-colors duration-150',
        // Hover: adaptive light/dark tint
        'hover:bg-slate-200/70 dark:hover:bg-slate-800/60',
        // Text colour
        accent
          ? 'text-cyan-500 dark:text-cyan-400'
          : 'text-slate-600 dark:text-slate-300',
      ].join(' ')}
    >
      <span className="w-5 text-center text-base leading-none">{icon}</span>
      {label}
    </button>
  )
}
