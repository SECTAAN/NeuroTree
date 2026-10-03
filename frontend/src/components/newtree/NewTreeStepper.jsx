/**
 * NewTreeStepper — visual step indicator (10.10.1)
 * Shows Initialization → Knowledge Source → AI Processing
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
        const upcoming= s.id > currentStep

        return (
          <div key={s.id} className="flex items-center">
            {/* Circle */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300"
                style={{
                  background: done
                    ? 'rgba(0,243,255,0.15)'
                    : active
                    ? 'rgba(0,243,255,0.2)'
                    : 'rgba(255,255,255,0.04)',
                  border: done || active
                    ? '1.5px solid rgba(0,243,255,0.5)'
                    : '1.5px solid rgba(255,255,255,0.1)',
                  boxShadow: active ? '0 0 10px rgba(0,243,255,0.25)' : 'none',
                  color: done || active
                    ? '#00F3FF'
                    : 'rgba(255,255,255,0.25)',
                }}
              >
                {done ? '✓' : s.id}
              </div>
              <span
                className="text-[10px] whitespace-nowrap transition-colors duration-300"
                style={{
                  color: active
                    ? 'rgba(240,242,245,0.8)'
                    : done
                    ? 'rgba(0,243,255,0.6)'
                    : 'rgba(255,255,255,0.25)',
                  letterSpacing: '0.05em',
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
                    ? 'linear-gradient(90deg, rgba(0,243,255,0.4), rgba(0,243,255,0.2))'
                    : 'rgba(255,255,255,0.08)',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
