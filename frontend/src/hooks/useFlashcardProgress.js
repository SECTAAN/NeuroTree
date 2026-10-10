/**
 * useFlashcardProgress — persists flashcard session results in localStorage.
 *
 * Key format:  nt-fc-progress-<sessionId>-<edgeId>
 *
 * Stored value:  { [cardId]: 'known' | 'review' }
 *
 * Guarantees:
 *  - Returns an empty object when the key is absent or the stored value is
 *    malformed (corrupt JSON, wrong type, etc.).
 *  - `persist` is a no-op when storageKey is null/undefined (safe to call
 *    unconditionally even before the key is known).
 *  - Session isolation: different sessionId+edgeId pairs never share data.
 *
 * Usage:
 *   const [results, setResults, clearResults] = useFlashcardProgress(key)
 *   // key is null-safe — pass null when session/edge not yet known
 */

import { useState, useCallback, useRef } from 'react'

const LS_PREFIX = 'nt-fc-progress-'

/** Safely read and parse an object from localStorage.  Returns {} on any error. */
function readStorage(key) {
  if (!key) return {}
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    // Ensure it's a plain object mapping card ids to verdict strings
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed
    }
    return {}
  } catch {
    return {}
  }
}

/** Safely write to localStorage; silently ignores quota/security errors. */
function writeStorage(key, value) {
  if (!key) return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Quota exceeded or private-browsing restriction — continue without crashing
  }
}

/**
 * @param {string|null} storageKey  e.g. "nt-fc-progress-<sessionId>-<edgeId>"
 * @returns {[object, (cardId: string, verdict: string) => void, () => void]}
 *   [results, markCard, clearProgress]
 */
export default function useFlashcardProgress(storageKey) {
  // Read persisted state once on mount (or when storageKey identity changes).
  // useRef guards against stale initial reads when key changes at runtime.
  const keyRef = useRef(storageKey)
  const [results, _setResults] = useState(() => readStorage(storageKey))

  // When storageKey changes (different edge opened), reload from storage.
  // This handles the case where RouterModal is reused for a different edge
  // without unmounting (rare but safe to handle).
  if (keyRef.current !== storageKey) {
    keyRef.current = storageKey
    const fresh = readStorage(storageKey)
    // Synchronous state replacement on key change — safe per React rules
    // because this only runs during render when the key identity changed.
    _setResults(fresh)
  }

  const markCard = useCallback((cardId, verdict) => {
    _setResults((prev) => {
      const next = { ...prev, [cardId]: verdict }
      writeStorage(storageKey, next)
      return next
    })
  }, [storageKey])

  const clearProgress = useCallback(() => {
    _setResults({})
    if (storageKey) {
      try { localStorage.removeItem(storageKey) } catch { /* silent */ }
    }
  }, [storageKey])

  return [results, markCard, clearProgress]
}

/** Build the localStorage key from sessionId and edgeId. */
export function flashcardStorageKey(sessionId, edgeId) {
  if (!sessionId || !edgeId) return null
  return `${LS_PREFIX}${sessionId}-${edgeId}`
}
