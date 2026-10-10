import { useEffect, useState } from 'react'

const STAGES = [
  { id: 'read',    label: 'Reading material'            },
  { id: 'extract', label: 'Extracting knowledge chunks' },
  { id: 'relate',  label: 'Identifying prerequisites'   },
  { id: 'build',   label: 'Building knowledge tree'     },
  { id: 'prep',    label: 'Preparing Skill Tree'        },
]

/**
 * AIProcessingState — Step 3 (10.11.10 / 10.11.11)
 * No fake percentages — stages advance in lock-step with actual API call progress.
 * `processingState`: 'processing' | 'success' | 'error'
 */
export default function AIProcessingState({ processingState, activeStage = 0 }) {
  const [dotFrame, setDotFrame] = useState(0)

  useEffect(() => {
    if (processingState !== 'processing') return
    const t = setInterval(() => setDotFrame((f) => (f + 1) % 4), 500)
    return () => clearInterval(t)
  }, [processingState])

  const dots = '.'.repeat(dotFrame)

  return (
    <div className="flex flex-col items-center py-4 animate-[fadeUp_0.3s_ease_forwards]">
      {/* Organic tree SVG — warm palette */}
      <div className="mb-6 relative" style={{ width: 80, height: 80 }}>
        <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          {/* Connecting cables */}
          {[
            ['40,60', '40,40'],
            ['40,40', '20,20'],
            ['40,40', '60,20'],
          ].map(([from, to], i) => (
            <line
              key={i}
              x1={from.split(',')[0]} y1={from.split(',')[1]}
              x2={to.split(',')[0]}   y2={to.split(',')[1]}
              stroke="rgba(78,114,103,0.45)" strokeWidth="1.5"
              strokeDasharray="4 2"
              style={{ animation: `energyParticle ${1.4 + i * 0.3}s linear infinite` }}
            />
          ))}
          {/* Root node — coral accent */}
          <circle cx="40" cy="60" r="7" fill="rgba(219,98,113,0.15)" stroke="var(--nt-coral)" strokeWidth="1.5"
            style={{ animation: 'glowPulse 2s ease-in-out infinite' }}
          />
          {/* Child nodes — primary green */}
          {[['20','20'],['60','20']].map(([cx,cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="5" fill="rgba(53,78,71,0.12)" stroke="var(--nt-primary-lt)"
              strokeWidth="1.2"
              style={{ animation: `glowPulse ${2.5 + i * 0.4}s ease-in-out infinite` }}
            />
          ))}
          {/* Small leaf accents */}
          <ellipse cx="16" cy="14" rx="4" ry="6" fill="rgba(78,114,103,0.20)"
            transform="rotate(-30 16 14)" />
          <ellipse cx="64" cy="14" rx="4" ry="6" fill="rgba(78,114,103,0.20)"
            transform="rotate(30 64 14)" />
        </svg>
      </div>

      {/* Main message */}
      <p className="text-sm font-medium mb-1" style={{ color: 'var(--nt-text)' }}>
        {processingState === 'processing'
          ? `AI is building your Knowledge Tree${dots}`
          : processingState === 'success'
          ? '✓ Knowledge Tree Generated'
          : 'Processing'}
      </p>
      <p className="text-xs mb-7" style={{ color: 'var(--nt-text-3)' }}>
        {processingState === 'success'
          ? 'Navigating to your Skill Tree…'
          : 'This may take a few moments'}
      </p>

      {/* Stage list */}
      <div className="w-full max-w-xs flex flex-col gap-2">
        {STAGES.map((stage, idx) => {
          const done       = idx < activeStage
          const inProgress = idx === activeStage && processingState === 'processing'

          return (
            <div key={stage.id} className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[9px]
                  transition-all duration-300"
                style={{
                  background: done       ? 'rgba(53,78,71,0.15)'  :
                              inProgress ? 'rgba(219,98,113,0.15)' :
                                           'var(--nt-bg-3)',
                  border: done       ? '1px solid rgba(53,78,71,0.45)'  :
                          inProgress ? '1px solid rgba(219,98,113,0.55)' :
                                       '1px solid var(--nt-border)',
                  color: done ? 'var(--nt-primary-lt)' : inProgress ? 'var(--nt-coral)' : 'var(--nt-text-3)',
                }}
              >
                {done ? '✓' : inProgress ? '●' : '○'}
              </div>
              <span
                className="text-xs transition-colors duration-300"
                style={{
                  color: done       ? 'var(--nt-primary-lt)'  :
                         inProgress ? 'var(--nt-text)'         :
                                      'var(--nt-text-muted)',
                }}
              >
                {stage.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
