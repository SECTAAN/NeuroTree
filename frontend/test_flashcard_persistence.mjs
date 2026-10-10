/**
 * test_flashcard_persistence.mjs
 *
 * Pure Node.js (no React, no jsdom) regression tests for the flashcard
 * persistence layer:
 *   - flashcardStorageKey()   (key derivation)
 *   - readStorage / writeStorage  (localStorage read/write)
 *   - markCard + clearProgress behaviour
 *   - session isolation
 *
 * Run from frontend/:
 *   node test_flashcard_persistence.mjs
 *
 * Exit 0 = all tests pass.  Exit 1 = failure.
 */

// ── Minimal localStorage mock (same interface browsers expose) ────────────────
class LocalStorageMock {
  constructor() { this._store = {} }
  getItem(key)        { return Object.prototype.hasOwnProperty.call(this._store, key) ? this._store[key] : null }
  setItem(key, value) { this._store[key] = String(value) }
  removeItem(key)     { delete this._store[key] }
  clear()             { this._store = {} }
}

const localStorage = new LocalStorageMock()

// ── Inline the hook logic (no imports needed — copy the pure functions) ───────
// These mirror the implementation in useFlashcardProgress.js exactly.

const LS_PREFIX = 'nt-fc-progress-'

function readStorage(key) {
  if (!key) return {}
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
    return {}
  } catch { return {} }
}

function writeStorage(key, value) {
  if (!key) return
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* quota */ }
}

function flashcardStorageKey(sessionId, edgeId) {
  if (!sessionId || !edgeId) return null
  return `${LS_PREFIX}${sessionId}-${edgeId}`
}

// Simulated markCard / clearProgress (mirrors the hook's functional logic)
function makeProgressStore(storageKey) {
  let results = readStorage(storageKey)

  function markCard(cardId, verdict) {
    results = { ...results, [cardId]: verdict }
    writeStorage(storageKey, results)
  }

  function clearProgress() {
    results = {}
    if (storageKey) { try { localStorage.removeItem(storageKey) } catch { /* silent */ } }
  }

  function getResults() { return { ...results } }

  return { markCard, clearProgress, getResults }
}

// ── Test harness ──────────────────────────────────────────────────────────────
let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (err) {
    console.error(`  ✗ ${name}`)
    console.error(`      ${err.message}`)
    failed++
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg ?? 'Assertion failed')
}

function assertEqual(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b))
    throw new Error(msg ?? `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log('\nFlashcard Persistence Tests\n')

// 1. Key derivation
test('flashcardStorageKey returns null when sessionId is missing', () => {
  assertEqual(flashcardStorageKey(null, 'edge-1'), null)
  assertEqual(flashcardStorageKey('', 'edge-1'), null)
})

test('flashcardStorageKey returns null when edgeId is missing', () => {
  assertEqual(flashcardStorageKey('sess-1', null), null)
  assertEqual(flashcardStorageKey('sess-1', ''), null)
})

test('flashcardStorageKey returns null when both are missing', () => {
  assertEqual(flashcardStorageKey(null, null), null)
})

test('flashcardStorageKey returns correct key', () => {
  assertEqual(
    flashcardStorageKey('abc-123', 'edge-xyz'),
    'nt-fc-progress-abc-123-edge-xyz'
  )
})

// 2. readStorage safety
test('readStorage returns {} for unknown key', () => {
  assertEqual(readStorage('nonexistent-key-12345'), {})
})

test('readStorage returns {} for null key', () => {
  assertEqual(readStorage(null), {})
})

test('readStorage returns {} for corrupt JSON', () => {
  localStorage.setItem('bad-key', '{not valid json}')
  assertEqual(readStorage('bad-key'), {})
})

test('readStorage returns {} for JSON array (wrong type)', () => {
  localStorage.setItem('array-key', '["a","b"]')
  assertEqual(readStorage('array-key'), {})
})

// 3. markCard persists to localStorage
test('markCard saves a card verdict and persists it', () => {
  const key = flashcardStorageKey('sess-1', 'edge-1')
  localStorage.clear()
  const store = makeProgressStore(key)

  store.markCard('card-1', 'known')
  assertEqual(store.getResults(), { 'card-1': 'known' })

  // Simulate page refresh: new store reads from localStorage
  const restored = makeProgressStore(key)
  assertEqual(restored.getResults(), { 'card-1': 'known' })
})

test('markCard accumulates multiple cards', () => {
  const key = flashcardStorageKey('sess-1', 'edge-2')
  localStorage.clear()
  const store = makeProgressStore(key)

  store.markCard('card-1', 'known')
  store.markCard('card-2', 'review')
  store.markCard('card-3', 'known')

  const restored = makeProgressStore(key)
  assertEqual(restored.getResults(), { 'card-1': 'known', 'card-2': 'review', 'card-3': 'known' })
})

test('markCard overwrites a previous verdict', () => {
  const key = flashcardStorageKey('sess-1', 'edge-3')
  localStorage.clear()
  const store = makeProgressStore(key)

  store.markCard('card-1', 'review')
  store.markCard('card-1', 'known')   // change mind

  const restored = makeProgressStore(key)
  assertEqual(restored.getResults(), { 'card-1': 'known' })
})

// 4. clearProgress removes from localStorage
test('clearProgress empties in-memory results and removes localStorage key', () => {
  const key = flashcardStorageKey('sess-1', 'edge-4')
  localStorage.clear()
  const store = makeProgressStore(key)

  store.markCard('card-1', 'known')
  store.clearProgress()

  assertEqual(store.getResults(), {})
  // Simulate refresh — should start fresh
  const restored = makeProgressStore(key)
  assertEqual(restored.getResults(), {})
})

// 5. Session isolation
test('different sessionIds do not share data', () => {
  const key1 = flashcardStorageKey('sess-A', 'edge-same')
  const key2 = flashcardStorageKey('sess-B', 'edge-same')
  localStorage.clear()

  const store1 = makeProgressStore(key1)
  store1.markCard('card-1', 'known')

  const store2 = makeProgressStore(key2)
  assertEqual(store2.getResults(), {})   // sess-B sees nothing from sess-A
})

test('different edgeIds do not share data', () => {
  const key1 = flashcardStorageKey('sess-same', 'edge-A')
  const key2 = flashcardStorageKey('sess-same', 'edge-B')
  localStorage.clear()

  const store1 = makeProgressStore(key1)
  store1.markCard('card-1', 'review')

  const store2 = makeProgressStore(key2)
  assertEqual(store2.getResults(), {})   // edge-B sees nothing from edge-A
})

// 6. Null storageKey is safe (no persistence, no crash)
test('markCard with null storageKey does not crash', () => {
  const store = makeProgressStore(null)
  store.markCard('card-1', 'known')   // should not throw
  assertEqual(store.getResults(), { 'card-1': 'known' })  // in-memory still works
})

test('clearProgress with null storageKey does not crash', () => {
  const store = makeProgressStore(null)
  store.markCard('card-1', 'known')
  store.clearProgress()
  assertEqual(store.getResults(), {})
})

// 7. Restoration after page refresh (end-to-end simulation)
test('full save → refresh → restore scenario', () => {
  const SID  = 'session-uuid-abc'
  const EID  = 'edge-uuid-xyz'
  const key  = flashcardStorageKey(SID, EID)
  localStorage.clear()

  // User session: mark 3 of 4 cards
  const session1 = makeProgressStore(key)
  session1.markCard('fc-1', 'known')
  session1.markCard('fc-2', 'review')
  session1.markCard('fc-3', 'known')
  // fc-4 not yet reviewed

  // Page refresh: new store
  const session2 = makeProgressStore(key)
  const restored = session2.getResults()
  assertEqual(restored['fc-1'], 'known')
  assertEqual(restored['fc-2'], 'review')
  assertEqual(restored['fc-3'], 'known')
  assert(restored['fc-4'] === undefined, 'fc-4 should be unset')

  // Verify known count matches
  const knownCount = Object.values(restored).filter((v) => v === 'known').length
  assertEqual(knownCount, 2)
})

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`)

if (failed > 0) {
  process.exit(1)
}
