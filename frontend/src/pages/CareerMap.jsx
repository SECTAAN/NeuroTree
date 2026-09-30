import { useApp } from '../context/AppContext'
import GlassPanel from '../components/ui/GlassPanel'
import LiquidButton from '../components/ui/LiquidButton'

/**
 * CareerMap — placeholder page for Milestone 6.
 * Shows a coming-soon state inside the app shell so routing works correctly.
 * Full career-gap analysis will be wired here in Milestone 6.
 */
export default function CareerMap() {
  const { navigateTo } = useApp()

  return (
    <div className="w-full h-full bg-app flex flex-col">

      {/* ── Minimal top bar ──────────────────────────────────────────── */}
      <header className="glass-2 mx-3 mt-3 mb-2 rounded-2xl flex-shrink-0 flex items-center px-4 gap-4" style={{ height: 56 }}>
        <button
          onClick={() => navigateTo('dashboard')}
          className="text-xs text-white/40 hover:text-white/70 transition-colors flex items-center gap-1"
        >
          ← Dashboard
        </button>
        <span
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'rgba(0,243,255,0.6)' }}
        >
          Career Map
        </span>
      </header>

      {/* ── Content ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-4">
        <GlassPanel level={3} className="max-w-md w-full text-center py-12 px-8">

          {/* Animated circuit icon */}
          <div className="mb-6 flex justify-center">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="28" stroke="rgba(0,243,255,0.15)" strokeWidth="1.5" />
              <circle cx="32" cy="32" r="18" stroke="rgba(0,243,255,0.25)" strokeWidth="1" strokeDasharray="4 3" />
              <circle cx="32" cy="32" r="6" fill="rgba(0,243,255,0.3)" />
              {/* Compass arms */}
              <line x1="32" y1="4"  x2="32" y2="14" stroke="rgba(0,243,255,0.4)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="32" y1="50" x2="32" y2="60" stroke="rgba(0,243,255,0.4)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="4"  y1="32" x2="14" y2="32" stroke="rgba(0,243,255,0.4)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="50" y1="32" x2="60" y2="32" stroke="rgba(0,243,255,0.4)" strokeWidth="1.5" strokeLinecap="round" />
              {/* Career-path dots */}
              <circle cx="20" cy="20" r="3" fill="rgba(77,124,254,0.5)" />
              <circle cx="44" cy="20" r="3" fill="rgba(77,124,254,0.5)" />
              <circle cx="44" cy="44" r="3" fill="rgba(0,243,255,0.6)" />
              <line x1="20" y1="20" x2="44" y2="20" stroke="rgba(77,124,254,0.3)" strokeWidth="1" strokeDasharray="3 2" />
              <line x1="44" y1="20" x2="44" y2="44" stroke="rgba(0,243,255,0.4)" strokeWidth="1" strokeDasharray="3 2" />
            </svg>
          </div>

          <h2
            className="text-lg font-semibold mb-2 tracking-wide"
            style={{ color: 'rgba(240,242,245,0.85)' }}
          >
            Career Map
          </h2>

          <p className="text-sm text-white/35 mb-2 leading-relaxed">
            Set your target career goal and the AI will analyse your current knowledge graph to identify gaps and build a personalised learning path.
          </p>

          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs mb-8"
            style={{
              background: 'rgba(0,243,255,0.06)',
              border: '1px solid rgba(0,243,255,0.18)',
              color: 'rgba(0,243,255,0.6)',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            Coming in Milestone 6
          </div>

          <div className="flex flex-col gap-3">
            <LiquidButton onClick={() => navigateTo('skilltree')} variant="primary">
              Back to Skill Tree
            </LiquidButton>
            <LiquidButton onClick={() => navigateTo('dashboard')} variant="ghost">
              My Trees
            </LiquidButton>
          </div>
        </GlassPanel>
      </div>
    </div>
  )
}
