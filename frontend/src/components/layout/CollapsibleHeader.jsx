/**
 * CollapsibleHeader — top bar for SkillTree page.
 * M-19: Skeuomorphic clay surface, NeuroTree brand colours.
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
          <button
            onClick={onMenuOpen}
            className="clay-icon w-7 h-7 rounded-lg flex flex-col items-center justify-center gap-[4px]
              transition-colors hover:opacity-80"
            title="Menu"
            aria-label="Open menu"
          >
            <span className="block w-3.5 h-px rounded-full" style={{ background: 'var(--nt-text-3)' }} />
            <span className="block w-3.5 h-px rounded-full" style={{ background: 'var(--nt-text-3)' }} />
            <span className="block w-3.5 h-px rounded-full" style={{ background: 'var(--nt-text-3)' }} />
          </button>

          <button
            onClick={onBack}
            className="text-xs transition-colors flex items-center gap-1"
            style={{ color: 'var(--nt-text-3)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--nt-primary)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--nt-text-3)' }}
          >
            ← Dashboard
          </button>
        </div>

        {/* Centre: stats */}
        {!collapsed && (
          <div className="flex items-center gap-4 text-xs flex-1 justify-center min-w-0"
            style={{ color: 'var(--nt-text-3)' }}>
            {treeName && (
              <span
                className="truncate max-w-[140px] font-medium"
                style={{ color: 'var(--nt-text-2)' }}
                title={treeName}
              >
                {treeName}
              </span>
            )}
            <span>
              <span style={{ color: 'var(--nt-primary)', fontWeight: 600 }}>{unlockedNodes}</span>
              /{totalNodes} unlocked
            </span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 rounded-full overflow-hidden"
                style={{ background: 'var(--nt-bg-3)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${avgMastery}%`,
                    background: 'linear-gradient(90deg, var(--nt-primary), var(--nt-coral))',
                  }}
                />
              </div>
              <span style={{ color: 'var(--nt-text-3)' }}>{avgMastery}%</span>
            </div>
          </div>
        )}

        {/* Right: collapse toggle */}
        <button
          onClick={onToggleCollapse}
          className="clay-icon w-6 h-6 rounded-md flex items-center justify-center
            text-xs transition-colors duration-200"
          style={{ color: 'var(--nt-text-3)' }}
          title={collapsed ? 'Expand header' : 'Collapse header'}
        >
          {collapsed ? '↓' : '↑'}
        </button>
      </div>
    </header>
  )
}
