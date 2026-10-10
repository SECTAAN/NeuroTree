import { useState } from 'react'
import useFlashcardProgress from '../../hooks/useFlashcardProgress'

/**
 * FlashcardPanel — Active-Recall flashcard UI (spec 10.70).
 * M-19: full --nt-* palette. All neon (#00FFA3, #00F3FF) replaced.
 */
export default function FlashcardPanel({ flashcards = [], sourceLabel, targetLabel, storageKey }) {
  const [index,   setIndex]   = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [results, markCard, clearProgress] = useFlashcardProgress(storageKey)

  if (!flashcards.length) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm" style={{ color: 'var(--nt-text-3)' }}>
          No flashcards available for this connection.
        </p>
      </div>
    )
  }

  const card       = flashcards[index]
  const total      = flashcards.length
  const done       = Object.keys(results).length
  const allDone    = done === total
  const knownCount = Object.values(results).filter((v) => v === 'known').length

  function handleMark(verdict) {
    markCard(card.id, verdict)
    setFlipped(false)
    const nextIdx = (index + 1) % total
    setIndex(nextIdx)
  }

  function handleRestart() {
    clearProgress()
    setIndex(0)
    setFlipped(false)
  }

  const cardResult = results[card.id]

  return (
    <div className="flex flex-col h-full">

      {/* ── Progress bar + counter ─────────────────────────────────────── */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--nt-text-3)' }}>
          <span>{done}/{total} reviewed</span>
          <span style={{ color: 'var(--nt-primary-lt)' }}>{knownCount} known</span>
        </div>
        <div className="nt-track h-1.5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(done / total) * 100}%`,
              background: 'linear-gradient(90deg, var(--nt-primary), var(--nt-primary-lt))',
            }}
          />
        </div>
      </div>

      {/* ── All done state ─────────────────────────────────────────────── */}
      {allDone ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-4"
            style={{
              background: 'rgba(53,78,71,0.10)',
              border: '1px solid rgba(53,78,71,0.25)',
              boxShadow: 'var(--nt-shadow-out-sm)',
            }}
          >
            ✦
          </div>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--nt-text)' }}>
            Session complete!
          </p>
          <p className="text-xs mb-5" style={{ color: 'var(--nt-text-3)' }}>
            {knownCount}/{total} cards mastered
          </p>
          <button onClick={handleRestart} className="nt-btn-secondary px-5 py-2 text-xs">
            Review again ↺
          </button>
        </div>
      ) : (
        <>
          {/* ── Card body ─────────────────────────────────────────────── */}
          <div
            className="flex-1 nt-card rounded-2xl p-5 flex flex-col justify-between cursor-pointer
              transition-all duration-200 mb-4 relative overflow-hidden"
            style={{
              background: flipped ? 'rgba(53,78,71,0.06)' : 'var(--nt-surface)',
              border: flipped ? '1px solid rgba(53,78,71,0.22)' : '1px solid var(--nt-border)',
              boxShadow: flipped ? 'var(--nt-shadow-in)' : 'var(--nt-shadow-out-sm)',
              minHeight: 140,
            }}
            onClick={() => !cardResult && setFlipped((v) => !v)}
          >
            {/* Card index badge */}
            <div className="flex items-center justify-between mb-3">
              <span className="nt-section-label">
                {flipped ? 'Answer' : 'Question'} · {index + 1}/{total}
              </span>
              {/* Source node badge */}
              {card.sourceNodeId && (
                <span className="nt-chip text-[10px] px-2 py-0.5">
                  {card.sourceNodeId === flashcards[0]?.sourceNodeId ? sourceLabel : targetLabel}
                </span>
              )}
            </div>

            {/* Card content */}
            <p
              className="text-sm leading-relaxed flex-1 flex items-center"
              style={{ color: flipped ? 'var(--nt-text)' : 'var(--nt-text-2)' }}
            >
              {flipped ? card.back : card.front}
            </p>

            {/* Flip hint */}
            {!flipped && !cardResult && (
              <p className="text-[10px] mt-3 text-center" style={{ color: 'var(--nt-text-muted)' }}>
                Click to reveal answer
              </p>
            )}

            {/* Already-marked overlay */}
            {cardResult && (
              <div
                className="absolute inset-0 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(var(--nt-bg-rgb, 250,242,227), 0.80)' }}
              >
                <span
                  className={`text-xs font-medium px-3 py-1.5 rounded-full ${cardResult === 'known' ? 'nt-fc-known' : 'nt-fc-review'}`}
                >
                  {cardResult === 'known' ? '✓ Marked as known' : '↺ Marked for review'}
                </span>
              </div>
            )}
          </div>

          {/* ── Action buttons (visible after flip) ─────────────────────── */}
          <div
            className="flex gap-2 transition-all duration-200"
            style={{ opacity: flipped ? 1 : 0, pointerEvents: flipped ? 'auto' : 'none' }}
          >
            <button
              onClick={() => handleMark('review')}
              className="nt-fc-review flex-1 py-2.5 rounded-xl text-xs font-medium transition-all duration-200"
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85' }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
            >
              ↺ Review again
            </button>
            <button
              onClick={() => handleMark('known')}
              className="nt-fc-known flex-1 py-2.5 rounded-xl text-xs font-medium transition-all duration-200"
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85' }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
            >
              ✓ Got it
            </button>
          </div>

          {/* ── Navigation dots ─────────────────────────────────────────── */}
          <div className="flex justify-center gap-1.5 mt-3">
            {flashcards.map((fc, i) => (
              <button
                key={fc.id}
                onClick={() => { setIndex(i); setFlipped(false) }}
                className="rounded-full transition-all duration-200"
                style={{
                  width:      i === index ? 16 : 6,
                  height:     6,
                  background: results[fc.id] === 'known'  ? 'var(--nt-primary)'    :
                              results[fc.id] === 'review' ? 'var(--nt-coral-lt)'   :
                              i === index                 ? 'var(--nt-primary-lt)' :
                                                            'var(--nt-border-2)',
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
