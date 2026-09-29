import { useEffect, useState } from 'react'

const STAGES = [
  { id: 'read',    label: 'Reading material'         },
  { id: 'extract', label: 'Extracting knowledge chunks' },
  { id: 'relate',  label: 'Identifying prerequisites'  },
  { id: 'build',   label: 'Building knowledge tree'   },
  { id: 'prep',    label: 'Preparing Skill Tree'       },
]

/**
 * AIProcessingState — Step 3 (10.11.10 / 10.11.11)
 * No fake percentages — stages advance in lock-step with actual API call progress.
 * `processingState`: 'processing' | 'success' | 'error'
 */
export default function AIProcessingState({ processingState, activeStage = 0 }) {
  const [dotFrame, setDotFrame] = useState(0)

  // Animated ellipsis dots
  useEffect(() => {
    if (processingState !== 'processing') return
    const t = setInterval(() => setDotFrame((f) => (f + 1) % 4), 500)
    return () => clearInterval(t)
  }, [processingState])

  const dots = '.'.repeat(dotFrame)

  return (
    <div className="flex flex-col items-center py-4 animate-[fadeUp_0.3s_ease_forwards]">
      {/* Circuit tree SVG animation */}
      <div className="mb-6 relative" style={{ width: 80, height: 80 }}>
        <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          {/* Edges */}
          {[
            ['40,60', '40,40'],
            ['40,40', '20,20'],
            ['40,40', '60,20'],
          ].map(([from, to], i) => (
            <line
              key={i}
              x1={from.split(',')[0]} y1={from.split(',')[1]}
              x2={to.split(',')[0]}   y2={to.split(',')[1]}
              stroke="rgba(0,243,255,0.3)" strokeWidth="1.5"
              strokeDasharray="4 2"
              style={{ animation: `energyParticle ${1.4 + i * 0.3}s linear infinite` }}
            />
          ))}
          {/* Root node */}
          <circle cx="40" cy="60" r="6" fill="rgba(0,243,255,0.15)" stroke="#00F3FF" strokeWidth="1.5"
            style={{ filter: 'drop-shadow(0 0 4px #00F3FF)', animation: 'glowPulse 2s ease-in-out infinite' }}
          />
          {/* Child nodes */}
          {[['20','20'],['60','20']].map(([cx,cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="4" fill="rgba(0,243,255,0.08)" stroke="rgba(0,243,255,0.5)"
              strokeWidth="1.2"
              style={{
                filter: 'drop-shadow(0 0 3px rgba(0,243,255,0.4))',
                animation: `glowPulse ${2.5 + i * 0.4}s ease-in-out infinite`,
              }}
            />
          ))}
        </svg>
      </div>

      {/* Main message */}
      <p className="text-sm font-medium text-white/80 mb-1">
        {processingState === 'processing'
          ? `AI is building your Knowledge Tree${dots}`
          : processingState === 'success'
          ? '✓ Knowledge Tree Generated'
          : 'Processing'}
      </p>
      <p className="text-xs text-white/35 mb-7">
        {processingState === 'success'
          ? 'Navigating to your Skill Tree…'
          : 'This may take a few moments'}
      </p>

      {/* Stage list */}
      <div className="w-full max-w-xs flex flex-col gap-2">
        {STAGES.map((stage, idx) => {
          const done       = idx < activeStage
          const inProgress = idx === activeStage && processingState === 'processing'
          const pending    = idx > activeStage

          return (
            <div key={stage.id} className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[9px]
                  transition-all duration-300"
                style={{
                  background: done       ? 'rgba(0,255,163,0.15)' :
                              inProgress ? 'rgba(0,243,255,0.15)' :
                                           'rgba(255,255,255,0.04)',
                  border: done       ? '1px solid rgba(0,255,163,0.5)' :
                          inProgress ? '1px solid rgba(0,243,255,0.5)' :
                                       '1px solid rgba(255,255,255,0.1)',
                  boxShadow: inProgress ? '0 0 6px rgba(0,243,255,0.3)' : 'none',
                }}
              >
                {done ? '✓' : inProgress ? '●' : '○'}
              </div>
              <span
                className="text-xs transition-colors duration-300"
                style={{
                  color: done       ? 'rgba(0,255,163,0.7)' :
                         inProgress ? 'rgba(240,242,245,0.85)' :
                                      'rgba(255,255,255,0.25)',
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
