import { useState, useCallback, useEffect, useRef } from 'react'

/**
 * useCanvasTools — global interaction state for the SkillTree canvas.
 *
 * activeTool controls what happens on edge/node click:
 *   'default'  → select / open card
 *   'pan'      → canvas drag; edge/node clicks ignored
 *   'cut'      → edge.data.status = 'cut'
 *   'router'   → inject router object onto edge.data.router
 *   'note'     → open NoteModal for edge
 *   'grow'     → expand node: call expandNode API and append children (P4)
 *
 * Keyboard shortcuts (spec 10.84):
 *   H → pan      C → cut     R → router     N → note     G → grow
 *   Escape       → default (clear active tool)
 *   Ctrl+Z       → undo last cut (restores most recently cut edge)
 *
 * Theme (spec 10.61):
 *   Persisted in localStorage.
 *   Toggling applies/removes class 'theme-light' on <html> so CSS overrides work globally.
 */

const STORAGE_KEY = 'neurotree-theme'

function getInitialTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* ignore */ }
  // M-19: light is the new default
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyThemeClass(theme) {
  const html = document.documentElement
  if (theme === 'dark') {
    html.classList.add('dark')
    html.classList.remove('theme-light')
  } else {
    // Light mode: remove dark, add theme-light (legacy CSS still checks this)
    html.classList.remove('dark')
    html.classList.add('theme-light')
  }
}

/**
 * External undo registry — SkillTreeCanvas registers a callback here so the
 * hook can trigger undo without prop-drilling.
 * Pattern: singleton per hook instance, cleaned up on unmount.
 */
export function useCanvasTools() {
  const [activeTool, setActiveTool] = useState('default')
  const [theme, setThemeState]      = useState(() => {
    const t = getInitialTheme()
    // Apply on initial render (covers page refresh)
    applyThemeClass(t)
    return t
  })

  // Ref to undo handler registered by SkillTreeCanvas
  const undoHandlerRef = useRef(null)

  /** Called by SkillTreeCanvas to register its undo function */
  const registerUndoHandler = useCallback((fn) => {
    undoHandlerRef.current = fn
  }, [])

  const selectTool = useCallback((tool) => {
    setActiveTool((prev) => prev === tool ? 'default' : tool)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      try { localStorage.setItem(STORAGE_KEY, next) } catch { /* ignore */ }
      applyThemeClass(next)
      return next
    })
  }, [])

  // ── Global keyboard shortcuts ─────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e) {
      // Skip if user is typing in a text field / textarea / contenteditable
      const tag = e.target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return

      switch (e.key.toLowerCase()) {
        case 'h':
          e.preventDefault()
          setActiveTool((prev) => prev === 'pan' ? 'default' : 'pan')
          break
        case 'c':
          // Only intercept bare C (not Ctrl+C copy)
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            setActiveTool((prev) => prev === 'cut' ? 'default' : 'cut')
          }
          break
        case 'r':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            setActiveTool((prev) => prev === 'router' ? 'default' : 'router')
          }
          break
        case 'n':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            setActiveTool((prev) => prev === 'note' ? 'default' : 'note')
          }
          break
        case 'g':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            setActiveTool((prev) => prev === 'grow' ? 'default' : 'grow')
          }
          break
        case 'escape':
          setActiveTool('default')
          break
        case 'z':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            undoHandlerRef.current?.()
          }
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return { activeTool, selectTool, theme, toggleTheme, registerUndoHandler }
}
