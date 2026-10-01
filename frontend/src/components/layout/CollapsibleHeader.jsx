/**
 * CollapsibleHeader — top HUD bar for SkillTree page.
 * Soft Claymorphism surface — matches Dashboard card system.
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
      className="clay-header mx-3 mt-3 mb-2 rounded-2xl flex-shrink-0
        transition-all duration-300 overflow-hidden"
      style={{ height: collapsed ? 44 : 56 }}
    >
      <div className="flex items-center justify-between px-4 h-full gap-4">

        {/* Left: hamburger + back */}
        <div className="flex items-center gap-3">
          {/* Hamburger — concave clay button */}
          <button
            onClick={onMenuOpen}
            className="clay-icon w-7 h-7 rounded-lg flex flex-col items-center justify-center gap-[4px]
              transition-colors hover:opacity-80"
            title="Menu"
            aria-label="Open menu"
          >
            <span className="block w-3.5 h-px rounded-full bg-slate-500 dark:bg-slate-400" />
            <span className="block w-3.5 h-px rounded-full bg-slate-500 dark:bg-slate-400" />
            <span className="block w-3.5 h-px rounded-full bg-slate-500 dark:bg-slate-400" />
          </button>

          {/* Back to Dashboard */}
          <button
            onClick={onBack}
            className="text-xs text-slate-500 dark:text-slate-400
              hover:text-slate-800 dark:hover:text-slate-200
              transition-colors flex items-center gap-1"
          >
            ← Dashboard
          </button>
        </div>

        {/* Centre: stats (hidden when collapsed) */}
        {!collapsed && (
          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400
            flex-1 justify-center min-w-0">
            {treeName && (
              <span className="text-slate-700 dark:text-slate-200 truncate max-w-[140px]"
                title={treeName}>
                {treeName}
              </span>
            )}
            <span>
              <span style={{ color: 'rgba(0,180,210,0.95)' }}>{unlockedNodes}</span>
              /{totalNodes} unlocked
            </span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 rounded-full overflow-hidden
                bg-black/10 dark:bg-black/40">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${avgMastery}%`,
                    background: 'linear-gradient(90deg, #00b4d2, #4d7cfe)',
                  }}
                />
              </div>
              <span className="text-slate-600 dark:text-slate-400">{avgMastery}%</span>
            </div>
          </div>
        )}

        {/* Right: collapse toggle — concave clay button */}
        <button
          onClick={onToggleCollapse}
          className="clay-icon w-6 h-6 rounded-md flex items-center justify-center
            text-xs text-slate-500 dark:text-slate-400
            hover:text-slate-700 dark:hover:text-slate-200
            transition-colors duration-200"
          title={collapsed ? 'Expand header' : 'Collapse header'}
        >
          {collapsed ? '↓' : '↑'}
        </button>
      </div>
    </header>
  )
}
