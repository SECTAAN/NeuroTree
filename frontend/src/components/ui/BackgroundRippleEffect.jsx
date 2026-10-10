/**
 * BackgroundRippleEffect — Aceternity "Background Boxes" cell-ripple grid.
 *
 * Grid of cells permanently visible via subtle borders.
 * Hovering any cell triggers a ripple wave that spreads to neighbours.
 * Single elegant color (--nt-primary at low opacity) — no color alternation.
 */
import { useEffect, useRef, useState } from 'react'

export default function BackgroundRippleEffect({
  cellSize    = 60,
  rippleSpeed = 180,
  className   = '',
}) {
  const wrapperRef = useRef(null)
  const [dims, setDims] = useState({ cols: 0, rows: 0 })
  // cellKey → animationDelay string, present only while that cell is active
  const [active, setActive] = useState({})
  const timers = useRef({})   // cellKey → timeout id

  // ── Size grid to wrapper ────────────────────────────────────────────────────
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    function measure() {
      setDims({
        cols: Math.ceil(el.offsetWidth  / cellSize) + 1,
        rows: Math.ceil(el.offsetHeight / cellSize) + 1,
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [cellSize])

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => Object.values(timers.current).forEach(clearTimeout)
  }, [])

  // ── Hover on a single cell → spread ripple to neighbours ───────────────────
  function handleCellEnter(originC, originR) {
    const { cols, rows } = dims
    const SPREAD = 5   // how many cells out the ripple reaches

    for (let c = Math.max(0, originC - SPREAD); c <= Math.min(cols - 1, originC + SPREAD); c++) {
      for (let r = Math.max(0, originR - SPREAD); r <= Math.min(rows - 1, originR + SPREAD); r++) {
        const dist  = Math.sqrt((c - originC) ** 2 + (r - originR) ** 2)
        if (dist > SPREAD) continue

        const key   = `${c}-${r}`
        const delay = Math.round(dist * rippleSpeed * 0.3)   // ms

        // Clear any existing fade-out timer for this cell
        if (timers.current[key]) clearTimeout(timers.current[key])

        setActive(prev => ({ ...prev, [key]: delay }))

        // Fade out after animation completes
        const total = delay + rippleSpeed + 80
        timers.current[key] = setTimeout(() => {
          setActive(prev => {
            const next = { ...prev }
            delete next[key]
            return next
          })
        }, total)
      }
    }
  }

  const { cols, rows } = dims

  return (
    <div
      ref={wrapperRef}
      aria-hidden="true"
      className={[
        'absolute inset-0 pointer-events-none overflow-hidden',
        className,
      ].join(' ')}
    >
      <div className="absolute inset-0" style={{ pointerEvents: 'auto' }}>
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} style={{ display: 'flex' }}>
            {Array.from({ length: cols }, (_, c) => {
              const key   = `${c}-${r}`
              const delay = active[key]
              const isOn  = delay !== undefined

              return (
                <div
                  key={c}
                  onMouseEnter={() => handleCellEnter(c, r)}
                  style={{
                    width:           cellSize,
                    height:          cellSize,
                    flexShrink:      0,
                    // Grid lines always visible — border at full opacity always
                    border:          '1px solid var(--nt-border)',
                    // Use backgroundColor (not background shorthand) so CSS keyframe
                    // animation can override it — shorthand resets would block the animation.
                    backgroundColor: isOn ? undefined : 'transparent',
                    animation:       isOn
                      ? `cell-ripple-fill ${rippleSpeed}ms ease-out ${delay}ms 1 forwards`
                      : 'none',
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
