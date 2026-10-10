import { useState } from 'react'
import useFlashcardProgress from '../../hooks/useFlashcardProgress'

/**
 * FlashcardPanel — Active-Recall flashcard UI (spec 10.70).
 *
 * Each card has a front (question) and back (answer).
 * The user can:
 *   • Click the card to flip it (reveal the answer)
 *   • Mark it as "Got it ✓" or "Review again ↺"
 *
 * Progress: shows X/Y cards and a completion bar.
 * Source tracing: if card.sourceNodeId is set, a small badge shows which node it came from.
 *
 * Props:
 *   flashcards  — array of { id, front, back, sourceNodeId? }
 *   sourceLabel — human label for the source node (for badge display)
 *   targetLabel — human label for the target node
 *   storageKey  — localStorage key for persisting progress across refreshes.
 *                 Format: "nt-fc-progress-<sessionId>-<edgeId>".
 *                 Pass null/undefined to disable persistence (pure in-memory).
 */
export default function FlashcardPanel({ flashcards = [], sourceLabel, targetLabel, storageKey }) {
  const [index,   setIndex]   = useState(0)
  const [flipped, setFlipped] = useState(false)
  // results persisted via localStorage when storageKey is provided
  const [results, markCard, clearProgress] = useFlashcardProgress(storageKey)

  if (!flashcards.length) {
    return (
      <div className="py-10 text-center">
        <p className="text-white/30 text-sm">No flashcards available for this connection.</p>
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
    // Advance to next unreviewed card, or wrap around
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
        <div className="flex justify-between text-xs text-white/30 mb-1.5">
          <span>{done}/{total} reviewed</span>
          <span style={{ color: 'rgba(0,255,163,0.7)' }}>{knownCount} known</span>
        </div>
        <div className="h-1 rounded-full bg-white/8 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(done / total) * 100}%`,
              background: 'linear-gradient(90deg, rgba(0,255,163,0.7), rgba(0,243,255,0.5))',
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
              background: 'rgba(0,255,163,0.08)',
              border: '1px solid rgba(0,255,163,0.25)',
              boxShadow: '0 0 20px rgba(0,255,163,0.12)',
            }}
          >
            ⚡
          </div>
          <p className="text-sm font-medium text-white/80 mb-1">Session complete!</p>
          <p className="text-xs text-white/35 mb-5">
            {knownCount}/{total} cards mastered
          </p>
          <button
            onClick={handleRestart}
            className="btn-liquid px-5 py-2 text-xs"
            style={{ borderColor: 'rgba(0,243,255,0.3)' }}
          >
            Review again ↺
          </button>
        </div>
      ) : (
        <>
          {/* ── Card body ─────────────────────────────────────────────── */}
          <div
            className="flex-1 rounded-2xl p-5 flex flex-col justify-between cursor-pointer transition-all duration-200 mb-4 relative overflow-hidden"
            style={{
              background: flipped
                ? 'rgba(0,243,255,0.05)'
                : 'rgba(255,255,255,0.03)',
              border: `1px solid ${flipped ? 'rgba(0,243,255,0.2)' : 'rgba(255,255,255,0.07)'}`,
              minHeight: 140,
            }}
            onClick={() => !cardResult && setFlipped((v) => !v)}
          >
            {/* Card index badge */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-white/20 font-mono tracking-widest uppercase">
                {flipped ? 'Answer' : 'Question'} · {index + 1}/{total}
              </span>
              {/* Source node badge */}
              {card.sourceNodeId && (
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(0,243,255,0.07)',
                    border: '1px solid rgba(0,243,255,0.15)',
                    color: 'rgba(0,243,255,0.5)',
                  }}
                >
                  {card.sourceNodeId === flashcards[0]?.sourceNodeId ? sourceLabel : targetLabel}
                </span>
              )}
            </div>

            {/* Card content */}
            <p
              className="text-sm leading-relaxed flex-1 flex items-center"
              style={{ color: flipped ? 'rgba(240,242,245,0.9)' : 'rgba(240,242,245,0.75)' }}
            >
              {flipped ? card.back : card.front}
            </p>

            {/* Flip hint */}
            {!flipped && !cardResult && (
              <p className="text-[10px] text-white/20 mt-3 text-center">
                Click to reveal answer
              </p>
            )}

            {/* Already-marked overlay */}
            {cardResult && (
              <div
                className="absolute inset-0 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(17,19,21,0.75)' }}
              >
                <span
                  className="text-xs font-medium px-3 py-1.5 rounded-full"
                  style={
                    cardResult === 'known'
                      ? { background: 'rgba(0,255,163,0.12)', color: 'rgba(0,255,163,0.8)', border: '1px solid rgba(0,255,163,0.25)' }
                      : { background: 'rgba(255,140,0,0.10)', color: 'rgba(255,160,30,0.8)', border: '1px solid rgba(255,140,0,0.2)' }
                  }
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
              className="flex-1 py-2.5 rounded-xl text-xs font-medium transition-all duration-200"
              style={{
                background: 'rgba(255,140,0,0.07)',
                border: '1px solid rgba(255,140,0,0.2)',
                color: 'rgba(255,160,30,0.8)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,140,0,0.12)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,140,0,0.07)' }}
            >
              ↺ Review again
            </button>
            <button
              onClick={() => handleMark('known')}
              className="flex-1 py-2.5 rounded-xl text-xs font-medium transition-all duration-200"
              style={{
                background: 'rgba(0,255,163,0.07)',
                border: '1px solid rgba(0,255,163,0.2)',
                color: 'rgba(0,255,163,0.8)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,255,163,0.13)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,255,163,0.07)' }}
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
                  background: results[fc.id] === 'known'
                    ? 'rgba(0,255,163,0.6)'
                    : results[fc.id] === 'review'
                    ? 'rgba(255,160,30,0.5)'
                    : i === index
                    ? 'rgba(0,243,255,0.7)'
                    : 'rgba(255,255,255,0.12)',
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
