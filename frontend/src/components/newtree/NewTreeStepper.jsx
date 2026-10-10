/**
 * NewTreeStepper — visual step indicator (10.10.1)
 * Shows Initialize → Knowledge Source → AI Processing
 * M-19: skeuomorphic palette — primary green active, coral done-check, clay bg.
 */
const STEPS = [
  { id: 1, label: 'Initialize' },
  { id: 2, label: 'Source'     },
  { id: 3, label: 'Generate'   },
]

export default function NewTreeStepper({ currentStep }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8 select-none">
      {STEPS.map((s, idx) => {
        const done    = s.id < currentStep
        const active  = s.id === currentStep

        return (
          <div key={s.id} className="flex items-center">
            {/* Step circle */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold
                  transition-all duration-300"
                style={{
                  background: done
                    ? 'rgba(53,78,71,0.18)'
                    : active
                    ? 'rgba(53,78,71,0.14)'
                    : 'var(--nt-bg-3)',
                  border: done
                    ? '1.5px solid rgba(53,78,71,0.55)'
                    : active
                    ? '1.5px solid rgba(78,114,103,0.65)'
                    : '1.5px solid var(--nt-border)',
                  boxShadow: active ? 'var(--nt-shadow-out-sm)' : 'none',
                  color: done
                    ? 'var(--nt-primary)'
                    : active
                    ? 'var(--nt-primary-lt)'
                    : 'var(--nt-text-muted)',
                }}
              >
                {done ? '✓' : s.id}
              </div>
              <span
                className="text-[10px] whitespace-nowrap transition-colors duration-300"
                style={{
                  letterSpacing: '0.05em',
                  color: active
                    ? 'var(--nt-text)'
                    : done
                    ? 'var(--nt-primary-lt)'
                    : 'var(--nt-text-muted)',
                  fontWeight: active ? 500 : 400,
                }}
              >
                {s.label}
              </span>
            </div>

            {/* Connector line */}
            {idx < STEPS.length - 1 && (
              <div
                className="w-16 h-px mx-1 mb-5 transition-all duration-500"
                style={{
                  background: done
                    ? 'linear-gradient(90deg, rgba(53,78,71,0.45), rgba(78,114,103,0.25))'
                    : 'var(--nt-border)',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
