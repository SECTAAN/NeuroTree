import { createContext, useContext, useState, useCallback } from 'react'
import { SESSION_ID } from '../services/api'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  // ── Navigation state (replaces React Router for simplicity) ───────────────
  // page: 'landing' | 'dashboard' | 'skilltree'
  const [page, setPage]           = useState('landing')
  const [activeTreeId, setActiveTreeId] = useState(null)

  // ── Graph data ─────────────────────────────────────────────────────────────
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] })

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
  const updateNodeMastery = useCallback((nodeId, newScore, unlockedIds = []) => {
    setGraphData((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => {
        if (n.id === nodeId) return { ...n, mastery_score: newScore }
        if (unlockedIds.includes(n.id)) return { ...n, status: 'unlocked' }
        return n
      }),
    }))
  }, [])

  const navigateTo = useCallback((target, treeId = null) => {
    setPage(target)
    if (treeId) setActiveTreeId(treeId)
  }, [])

  return (
    <AppContext.Provider value={{
      page, navigateTo,
      activeTreeId,
      graphData, setGraphData,
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
