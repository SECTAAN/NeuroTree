import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { USER_ID, activeSession, graphApi } from '../services/api'

const AppContext = createContext(null)

// ── sessionStorage keys ───────────────────────────────────────────────────────
const PAGE_KEY    = 'neurotree-page'
const SESSION_KEY = 'neurotree-active-session'  // F-6: persist active tree UUID

// ── Page ↔ URL path mapping ───────────────────────────────────────────────────
// Used for pushState / popstate so browser Back/Forward works.
const PAGE_TO_PATH = {
  landing:   '/',
  intro:     '/intro',
  dashboard: '/dashboard',
  skilltree: '/skilltree',
  careermap: '/careermap',
}
const PATH_TO_PAGE = Object.fromEntries(
  Object.entries(PAGE_TO_PATH).map(([p, u]) => [u, p])
)

// Pages that are safe to restore on refresh from sessionStorage alone
// (used when history.state is absent, e.g. direct URL entry).
// 'dashboard' excluded: new tab should always start at LandingPage → IntroPage.
// 'intro' included: refresh while reading intro stays there.
const RESTORABLE_PAGES = new Set(['intro', 'skilltree', 'careermap'])

function readInitialPage() {
  const pathname = window.location.pathname

  // 0. Root path always means the entry/landing screen, unconditionally.
  //    This prevents stale history.state or sessionStorage from skipping the
  //    LandingPage when the user opens or refreshes at '/'.
  if (pathname === '/' || pathname === '') {
    return 'landing'
  }

  // 1. For non-root deep paths, prefer history.state (reliable on same-tab refresh).
  const stateFromHistory = window.history.state?.page
  if (stateFromHistory && PAGE_TO_PATH[stateFromHistory] && stateFromHistory !== 'landing') {
    // Only trust state if the stored page's path matches the current pathname,
    // preventing a stale state from a different page overriding the URL.
    if (PAGE_TO_PATH[stateFromHistory] === pathname) {
      return stateFromHistory
    }
  }

  // 2. Resolve page from the current pathname directly.
  const fromPath = PATH_TO_PAGE[pathname]
  if (fromPath && RESTORABLE_PAGES.has(fromPath)) {
    return fromPath
  }

  // 3. Unknown path — fall back to landing.
  return 'landing'
}

function persistPage(page) {
  try {
    sessionStorage.setItem(PAGE_KEY, page)
  } catch {
    // sessionStorage unavailable — silent, no crash
  }
}

function pushHistoryEntry(page) {
  const path = PAGE_TO_PATH[page] ?? '/'
  // Only push if this is genuinely a new page (avoid duplicate entries on
  // repeated navigateTo calls with the same target).
  if (window.history.state?.page !== page) {
    window.history.pushState({ page }, '', path)
  }
}

// Seed the very first history entry so popstate fires correctly on first Back.
// Uses replaceState so we don't add a spurious extra entry on top of the
// browser's initial history entry.
// Guard: only seed if the page's canonical path matches the current pathname,
// preventing us from tagging a '/' entry as {page:'intro'}.
function seedInitialHistoryEntry(page) {
  const expectedPath = PAGE_TO_PATH[page] ?? '/'
  const currentPath  = window.location.pathname
  // Only write state when there is no state yet AND the path is consistent.
  if (!window.history.state?.page && expectedPath === currentPath) {
    window.history.replaceState({ page }, '', currentPath)
  }
}

// ── Active session persistence (F-6) ─────────────────────────────────────────
function readPersistedSessionId() {
  try {
    return sessionStorage.getItem(SESSION_KEY) || null
  } catch {
    return null
  }
}

function persistSessionId(id) {
  try {
    if (id) {
      sessionStorage.setItem(SESSION_KEY, id)
    } else {
      sessionStorage.removeItem(SESSION_KEY)
    }
  } catch {
    // silent
  }
}

export function AppProvider({ children }) {
  // ── Navigation state (replaces React Router for simplicity) ───────────────
  // page: 'landing' | 'intro' | 'dashboard' | 'skilltree' | 'careermap'
  // Initialised from history.state → pathname → sessionStorage (in that order).
  const [page, setPage] = useState(() => {
    const initial = readInitialPage()
    // Seed the first history entry so the browser has a state to pop back to.
    seedInitialHistoryEntry(initial)
    return initial
  })
  const [activeTreeId, setActiveTreeId] = useState(null)

  // ── F-6: Active session (per-tree UUID) ────────────────────────────────────
  // Persisted in sessionStorage so refresh within the same tab restores it.
  // Also kept in sync with activeSession.id (the mutable ref in api.js) so
  // every Axios request automatically sends the correct X-Session-ID header.
  const [activeSessionId, _setActiveSessionId] = useState(() => {
    const persisted = readPersistedSessionId()
    // Sync the api.js ref immediately at initialisation time
    activeSession.id = persisted
    return persisted
  })

  const setActiveSessionId = useCallback((id) => {
    _setActiveSessionId(id)
    activeSession.id = id   // keep Axios interceptor in sync
    persistSessionId(id)
  }, [])

  // ── Graph data ─────────────────────────────────────────────────────────────
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] })

  // ── F-2: Tree identity (set during ingest, survives within session) ────────
  const [treeName, setTreeName]         = useState('')
  const [learningGoal, setLearningGoal] = useState('')

  // ── Selected node (for GlowingNodeCard) ───────────────────────────────────
  const [selectedNode, setSelectedNode] = useState(null)

  // ── Quiz state ────────────────────────────────────────────────────────────
  const [quizOpen, setQuizOpen]   = useState(false)
  const [quizNode, setQuizNode]   = useState(null)

  const openQuiz = useCallback((node) => {
    setQuizNode(node)
    setQuizOpen(true)
  }, [])

  const closeQuiz = useCallback(() => {
    setQuizOpen(false)
    setQuizNode(null)
  }, [])

  // ── Browser Back/Forward — popstate listener ──────────────────────────────
  // When the user presses Back or Forward, the browser fires 'popstate' with
  // the state object we wrote in pushState/replaceState.  We read page from
  // that state and update React — no pushState here (the browser already moved).
  useEffect(() => {
    function onPopState(e) {
      const target = e.state?.page
      if (target && PAGE_TO_PATH[target]) {
        setPage(target)
        persistPage(target)
      } else {
        // No recognisable state (e.g. browser history entry predates this app).
        // Fallback to landing — safest choice.
        setPage('landing')
        persistPage('landing')
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, []) // run once; setPage / persistPage are stable

  // ── P0-2: Restore treeName/learningGoal after a refresh to 'skilltree' ─────
  // On mount, if we restored to 'skilltree' but treeName is empty, pull it
  // from GET /api/v1/sessions matching the restored activeSessionId.
  // This runs once on mount and is a no-op when treeName is already populated.
  useEffect(() => {
    if (page !== 'skilltree' || treeName) return
    graphApi.fetchSessions()
      .then(({ data }) => {
        // Find the session matching activeSessionId (if set), else take first
        const sid = activeSession.id
        const match = sid
          ? (data?.sessions ?? []).find((s) => s.session_id === sid)
          : data?.sessions?.[0]
        if (match?.tree_name)    setTreeName(match.tree_name)
        if (match?.learning_goal) setLearningGoal(match.learning_goal)
      })
      .catch(() => { /* silent — header will show blank, non-blocking */ })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // ^ intentionally run only on mount; page/treeName deps would re-fire on navigation

  // ── Mastery update (called after quiz evaluate response) ───────────────────
  // 1. Optimistic local update — immediate visual feedback (lamp brightness,
  //    unlock status for known dependents).
  // 2. Background re-sync — fetches authoritative graph from DB so edge
  //    visual states (energy flow) and any cascading unlocks are accurate.
  //    Fire-and-forget: no loading spinner, silently ignored on error.
  const updateNodeMastery = useCallback((nodeId, newScore, unlockedIds = []) => {
    // Optimistic update
    setGraphData((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => {
        if (n.id === nodeId) return { ...n, mastery_score: newScore }
        if (unlockedIds.includes(n.id)) return { ...n, status: 'unlocked' }
        return n
      }),
    }))

    // Background re-sync — updates edge statuses and any cascading unlocks
    graphApi.fetchGraph()
      .then(({ data }) => setGraphData(data))
      .catch(() => { /* silent — optimistic state is still valid */ })
  }, [])

  // ── Master Light mastery update (M-8B) ─────────────────────────────────────
  // Called by MasterLightModal after Q2 is_final=true.
  // 1. Optimistic patch: update master_light_mastery on the ML node immediately
  //    so the gold glow lights up without waiting for the network round-trip.
  // 2. Background re-sync: same fetchGraph fire-and-forget as updateNodeMastery,
  //    which also picks up master_light_unlocked (may already be true, but
  //    ensures the graph is in sync).
  const updateMasterLightMastery = useCallback((nodeId, mlMastery) => {
    // Optimistic patch — light up the ML node glow immediately
    setGraphData((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, master_light_mastery: mlMastery }
          : n
      ),
    }))

    // Authoritative re-sync — picks up any field the optimistic patch missed
    graphApi.fetchGraph()
      .then(({ data }) => setGraphData(data))
      .catch(() => { /* silent — optimistic state already reflects the result */ })
  }, [])

  /**
   * navigateTo — navigate to a page.
   *
   * F-2 extension: accepts optional metadata object for 'skilltree' target.
   *   navigateTo('skilltree', { treeName, learningGoal })
   *   navigateTo('skilltree', treeId)  // legacy string form still supported
   *
   * F-6 P0-2: persists the target page to sessionStorage so refresh restores it.
   * M-19d: pushes a browser history entry so Back/Forward work natively.
   */
  const navigateTo = useCallback((target, meta = null) => {
    setPage(target)
    persistPage(target)
    pushHistoryEntry(target)   // M-19d: enable browser Back/Forward
    if (typeof meta === 'string') {
      // Legacy: navigateTo('skilltree', treeId)
      setActiveTreeId(meta)
    } else if (meta && typeof meta === 'object') {
      // F-2: navigateTo('skilltree', { treeName, learningGoal })
      if (meta.treeName  !== undefined) setTreeName(meta.treeName)
      if (meta.learningGoal !== undefined) setLearningGoal(meta.learningGoal)
    }
  }, [])

  return (
    <AppContext.Provider value={{
      page, navigateTo,
      activeTreeId,
      graphData, setGraphData,
      treeName,  setTreeName,
      learningGoal, setLearningGoal,
      selectedNode, setSelectedNode,
      quizOpen, quizNode, openQuiz, closeQuiz,
      updateNodeMastery,
      updateMasterLightMastery,   // M-8B: ML post-assessment graph re-sync
      // F-6 multi-session
      activeSessionId, setActiveSessionId,
      // Legacy compat — consumers that used sessionId: SESSION_ID still work
      sessionId: USER_ID,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
