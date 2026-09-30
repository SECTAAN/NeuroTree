/**
 * CollapsibleHeader — top HUD bar for SkillTree page.
 * Shows stats (unlocked nodes, avg mastery) and a hamburger ☰ menu button.
 * Collapse toggle shrinks bar to 44px to maximise canvas space.
 *
 * Light/Dark mode:
 *   Background  — bg-white/50 dark:bg-slate-900/50  (glass-2 base kept)
 *   Text        — text-slate-700 dark:text-white/60
 *   Icons       — stroke via CSS var --icon-stroke (set per theme in index.css)
 */
export default function CollapsibleHeader({
  collapsed,
  onToggleCollapse,
  onMenuOpen,
  onBack,
  totalNodes,
  unlockedNodes,
  avgMastery,
  treeName,
}) {
  return (
    <header
      className="mx-3 mt-3 mb-2 rounded-2xl flex-shrink-0 transition-all duration-300 overflow-hidden
        bg-white/50 dark:bg-slate-900/50
        backdrop-blur-xl
        border border-black/8 dark:border-white/10
        shadow-sm dark:shadow-none"
      style={{ height: collapsed ? 44 : 56 }}
    >
      <div className="flex items-center justify-between px-4 h-full gap-4">

        {/* Left: hamburger + back */}
        <div className="flex items-center gap-3">
          {/* Hamburger menu */}
          <button
            onClick={onMenuOpen}
            className="w-7 h-7 rounded-md flex flex-col items-center justify-center gap-[4px]
              bg-black/5 dark:bg-white/5
              border border-black/8 dark:border-white/8
              hover:bg-black/10 dark:hover:bg-white/10
              transition-colors"
            title="Menu"
            aria-label="Open menu"
          >
            <span className="block w-3.5 h-px rounded-full bg-slate-600 dark:bg-white/50" />
            <span className="block w-3.5 h-px rounded-full bg-slate-600 dark:bg-white/50" />
            <span className="block w-3.5 h-px rounded-full bg-slate-600 dark:bg-white/50" />
          </button>

          {/* Back to Dashboard */}
          <button
            onClick={onBack}
            className="text-xs text-slate-500 dark:text-white/40
              hover:text-slate-800 dark:hover:text-white/70
              transition-colors flex items-center gap-1"
          >
            ← Dashboard
          </button>
        </div>

        {/* Centre: stats (hidden when collapsed) */}
        {!collapsed && (
          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-white/40 flex-1 justify-center min-w-0">
            {treeName && (
              <span className="text-slate-700 dark:text-white/60 truncate max-w-[140px]" title={treeName}>
                {treeName}
              </span>
            )}
            <span>
              {/* Cyan accent kept in both modes — readable on light bg at 0.9 opacity */}
              <span style={{ color: 'rgba(0,180,210,0.9)' }}>{unlockedNodes}</span>
              /{totalNodes} unlocked
            </span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-1 rounded-full bg-black/8 dark:bg-white/8 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${avgMastery}%`,
                    background: 'linear-gradient(90deg, rgba(0,180,210,0.8), rgba(77,124,254,0.6))',
                  }}
                />
              </div>
              <span className="text-slate-600 dark:text-white/40">{avgMastery}%</span>
            </div>
          </div>
        )}

        {/* Right: collapse toggle */}
        <button
          onClick={onToggleCollapse}
          className="w-6 h-6 rounded-md flex items-center justify-center text-xs transition-colors
            bg-black/5 dark:bg-white/5
            border border-black/8 dark:border-white/8
            text-slate-500 dark:text-white/30
            hover:text-slate-800 dark:hover:text-white/60"
          title={collapsed ? 'Expand header' : 'Collapse header'}
        >
          {collapsed ? '↓' : '↑'}
        </button>
      </div>
    </header>
  )
}
