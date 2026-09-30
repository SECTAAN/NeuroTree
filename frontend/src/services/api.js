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
  // Hardcoded for development — points to the mock session seeded in the backend.
  // Revert to crypto.randomUUID() before production.
  return '123e4567-e89b-12d3-a456-426614174000'
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

  /** POST /api/v1/material/ingest — submit source text for AI processing */
  ingest: (sourceText) =>
    api.post('/api/v1/material/ingest', { source_text: sourceText }),
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
