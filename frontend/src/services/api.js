import axios from 'axios'

/**
 * Central Axios instance for all NeuroTree API calls.
 *
 * Base URL points to FastAPI backend.
 * Every request automatically carries the X-User-ID header,
 * pulled from localStorage (generated once on first visit).
 */

// ── Session UUID ─────────────────────────────────────────────────────────────
// Generates and persists a UUID in localStorage so the same user
// keeps their graph across page refreshes.
function getOrCreateSessionId() {
  try {
    const stored = localStorage.getItem('neurotree-session-id')
    if (stored) return stored
    const id = crypto.randomUUID()
    localStorage.setItem('neurotree-session-id', id)
    return id
  } catch {
    // Fallback for environments where localStorage or crypto is unavailable
    return 'fallback-' + Math.random().toString(36).slice(2, 18)
  }
}

export const SESSION_ID = getOrCreateSessionId()

// ── Axios Instance ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 30000, // 30s — LangFlow calls can be slow
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach X-User-ID to every request automatically
api.interceptors.request.use((config) => {
  config.headers['X-User-ID'] = SESSION_ID
  return config
})

// Global response error handler — logs full detail server-side, surfaces safe
// message to callers.
// HTTP 429 is tagged with `isRateLimit = true` so UI components can render
// a specific cooldown message instead of the generic circuit-error state.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status

    if (status === 429) {
      const retryAfter = error.response?.headers?.['retry-after']
      const err = new Error(
        'Sirkuit AI sedang cooldown (Terlalu banyak permintaan). ' +
        'Harap tunggu beberapa saat sebelum mencoba lagi.'
      )
      err.isRateLimit  = true
      err.retryAfter   = retryAfter ? parseInt(retryAfter, 10) : 30  // seconds
      console.warn('[NeuroTree] Rate limit hit — retry after', err.retryAfter, 's')
      return Promise.reject(err)
    }

    const msg =
      error.response?.data?.detail ||
      error.message ||
      'Sirkuit AI sedang mengalami gangguan sementara.'
    console.error('[NeuroTree API Error]', msg, error)
    return Promise.reject(new Error(msg))
  }
)

export default api

// ── Named Endpoint Helpers ─────────────────────────────────────────────────
// Centralising endpoint paths here means only one file needs updating
// when the backend API changes.

export const graphApi = {
  /** GET /api/v1/graph — lightweight node+edge list for React Flow */
  fetchGraph: () => api.get('/api/v1/graph'),

  /** GET /api/v1/node/:id — full node content for learning mode */
  fetchNode: (nodeId) => api.get(`/api/v1/node/${nodeId}`),

  /**
   * POST /api/v1/material/ingest — submit source text for AI processing.
   * F-2: treeName + learningGoal are optional; omitting them is backward compatible.
   */
  ingest: (sourceText, treeName = '', learningGoal = '') =>
    api.post('/api/v1/material/ingest', {
      source_text:   sourceText,
      tree_name:     treeName,
      learning_goal: learningGoal,
    }, { timeout: 90000 }),

  /** GET /api/v1/sessions — dashboard session history (F-2) */
  fetchSessions: () => api.get('/api/v1/sessions'),

  /**
   * POST /api/v1/material/extract — F-4: extract plain text from a PDF or DOCX file.
   * Returns { extracted_text, char_count, truncated }.
   * The caller should pass extracted_text to graphApi.ingest().
   */
  extractFile: (file) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/api/v1/material/extract', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    })
  },
}

export const quizApi = {
  /** POST /api/v1/quiz/generate */
  generate: (nodeId) =>
    api.post('/api/v1/quiz/generate', { node_id: nodeId }),

  /** POST /api/v1/quiz/evaluate */
  evaluate: (nodeId, userAnswer) =>
    api.post('/api/v1/quiz/evaluate', { node_id: nodeId, user_answer: userAnswer }),

  /** GET /api/v1/quiz/recommend */
  recommend: () => api.get('/api/v1/quiz/recommend'),
}

export const careerApi = {
  /** POST /api/v1/career/pathway */
  pathway: (careerGoal) =>
    api.post('/api/v1/career/pathway', { career_goal: careerGoal }),
}

// ── Mock Progressive Growth API (P4 — used until backend endpoint is ready) ───
//
// mockProgressiveApi.createTree(data)
//   Simulates POST /api/v1/tree — returns a single root node to start the circuit.
//   data: { treeName, learningGoal }
//
// mockProgressiveApi.expandNode(nodeId, existingNodeIds)
//   Simulates POST /api/v1/node/:id/expand — given a node, returns 2-3 child
//   nodes + the edges that connect them to the parent.
//   existingNodeIds is passed so the mock can generate unique IDs each time.
//
// Both functions return a { data } wrapper to match Axios response shape,
// so SkillTreeCanvas can swap to the real api call with zero refactoring.

const EXPAND_TEMPLATES = {
  default: [
    { titleSuffix: 'Core Concepts',   masteryScore: 0, status: 'unlocked' },
    { titleSuffix: 'Key Principles',  masteryScore: 0, status: 'unlocked' },
    { titleSuffix: 'Practical Usage', masteryScore: 0, status: 'locked'   },
  ],
  'node-root': [
    { titleSuffix: 'Fundamentals',    masteryScore: 0, status: 'unlocked' },
    { titleSuffix: 'Advanced Topics', masteryScore: 0, status: 'locked'   },
  ],
}

let _mockIdCounter = 100

function makeMockId(prefix) {
  return `${prefix}-${++_mockIdCounter}`
}

export const mockProgressiveApi = {
  /**
   * createTree({ treeName, learningGoal })
   * Returns: { data: { treeId, nodes: [rootNode], edges: [] } }
   */
  createTree({ treeName, learningGoal }) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const rootId = makeMockId('node')
        resolve({
          data: {
            treeId: makeMockId('tree'),
            treeName,
            learningGoal,
            nodes: [
              {
                id:           rootId,
                title:        treeName,
                status:       'unlocked',
                mastery_score: 0,
              },
            ],
            edges: [],
          },
        })
      }, 400) // simulate network delay
    })
  },

  /**
   * expandNode(nodeId, existingNodeIds)
   * Returns: { data: { nodes: [...], edges: [...] } }
   *
   * Generates 2-3 child nodes seeded from the parent node's label.
   * existingNodeIds prevents ID collisions across multiple expand calls.
   */
  expandNode(nodeId, parentLabel = '') {
    return new Promise((resolve) => {
      setTimeout(() => {
        const template =
          EXPAND_TEMPLATES[nodeId] ?? EXPAND_TEMPLATES.default

        const newNodes = template.map((t) => ({
          id:           makeMockId('node'),
          title:        parentLabel ? `${parentLabel}: ${t.titleSuffix}` : t.titleSuffix,
          status:       t.status,
          mastery_score: t.masteryScore,
        }))

        const newEdges = newNodes.map((child) => ({
          source_id: nodeId,
          target_id: child.id,
          status:    child.status === 'locked' ? 'locked' : 'active',
        }))

        resolve({ data: { nodes: newNodes, edges: newEdges } })
      }, 600) // simulate LangFlow latency
    })
  },
}
