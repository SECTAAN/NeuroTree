import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { SESSION_ID, graphApi } from '../services/api'

const AppContext = createContext(null)

// ── sessionStorage key for page persistence (P0-2) ────────────────────────────
const PAGE_KEY = 'neurotree-page'

// Pages that are safe to restore on refresh (skip 'landing' — first load
// should always show the landing screen for new tabs/sessions).
const RESTORABLE_PAGES = new Set(['dashboard', 'skilltree', 'careermap'])

function readPersistedPage() {
  try {
    const stored = sessionStorage.getItem(PAGE_KEY)
    return RESTORABLE_PAGES.has(stored) ? stored : 'landing'
  } catch {
    return 'landing'
  }
}

function persistPage(page) {
  try {
    sessionStorage.setItem(PAGE_KEY, page)
  } catch {
    // sessionStorage unavailable — silent, no crash
  }
}

export function AppProvider({ children }) {
  // ── Navigation state (replaces React Router for simplicity) ───────────────
  // page: 'landing' | 'dashboard' | 'skilltree' | 'careermap'
  // Initialise from sessionStorage so refresh restores the correct page.
  const [page, setPage]           = useState(() => readPersistedPage())
  const [activeTreeId, setActiveTreeId] = useState(null)

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

  // ── P0-2: Restore treeName/learningGoal after a refresh to 'skilltree' ─────
  // On mount, if we restored to 'skilltree' but treeName is empty, pull it
  // from GET /api/v1/sessions (same fallback already in SkillTree.jsx for F-2).
  // This runs once on mount and is a no-op when treeName is already populated.
  useEffect(() => {
    if (page !== 'skilltree' || treeName) return
    graphApi.fetchSessions()
      .then(({ data }) => {
        const first = data?.sessions?.[0]
        if (first?.tree_name)    setTreeName(first.tree_name)
        if (first?.learning_goal) setLearningGoal(first.learning_goal)
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

  /**
   * navigateTo — navigate to a page.
   *
   * F-2 extension: accepts optional metadata object for 'skilltree' target.
   *   navigateTo('skilltree', { treeName, learningGoal })
   *   navigateTo('skilltree', treeId)  // legacy string form still supported
   *
   * F-6 P0-2: persists the target page to sessionStorage so refresh restores it.
   */
  const navigateTo = useCallback((target, meta = null) => {
    setPage(target)
    persistPage(target)
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
      sessionId: SESSION_ID,
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
