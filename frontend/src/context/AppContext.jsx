import { createContext, useContext, useState, useCallback } from 'react'
import { SESSION_ID, graphApi } from '../services/api'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  // ── Navigation state (replaces React Router for simplicity) ───────────────
  // page: 'landing' | 'dashboard' | 'skilltree' | 'careermap'
  const [page, setPage]           = useState('landing')
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
   */
  const navigateTo = useCallback((target, meta = null) => {
    setPage(target)
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
