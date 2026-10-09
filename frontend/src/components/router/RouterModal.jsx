import { useState, useEffect } from 'react'
import FlashcardPanel from '../flashcards/FlashcardPanel'
import { graphApi } from '../../services/api'

/**
 * RouterModal — P1 Material Hub modal (spec 10.67).
 *
 * Opened when the user clicks a RouterMarker (▣) on an EnergyEdge.
 * Receives a router context object and fetches REAL node content via
 * graphApi.fetchNode() for both the source and target nodes.
 *
 * Real data contract (GET /api/v1/node/{id}):
 *   { id, title, content, key_concepts, mastery_score, mastery_level }
 *
 * Locked nodes return HTTP 403 — we surface them gracefully.
 *
 * Two tabs:
 *   CONNECTION  — source/target header, relationship explanation, key
 *                 concepts from both nodes, both node content summaries
 *   FLASHCARDS  — FlashcardPanel with cards built from real key_concepts
 *
 * Props:
 *   router    — { sourceNodeId, targetNodeId, sourceLabel, targetLabel, ... }
 *   onClose   — () => void
 */

// ── Flashcard builder ─────────────────────────────────────────────────────────
// Generates active-recall cards from real key_concepts arrays.
// Fallback: when key_concepts is empty (live NT-01 path), generate one card from
// node content so the Flashcard tab is always usable.
// Capped at 6 total cards so the panel stays usable.
function buildFlashcards(sourceNode, targetNode) {
  const cards = []
  let seq = 0

  function addConcepts(node, concepts) {
    const list = Array.isArray(concepts) ? concepts.filter(Boolean) : []

    if (list.length > 0) {
      // Happy path: use real key_concepts
      for (const concept of list) {
        cards.push({
          id:           `fc-${++seq}-${node.id}`,
          front:        `Apa yang dimaksud dengan "${concept}" dalam konteks "${node.title}"?`,
          back:         node.content
            ? `${concept} adalah bagian dari "${node.title}". ${node.content.slice(0, 200).trimEnd()}…`
            : `${concept} adalah salah satu konsep kunci dalam "${node.title}".`,
          sourceNodeId: node.id,
        })
      }
    } else if (node.content) {
      // Fallback: no key_concepts but we have content — generate one content-based card
      cards.push({
        id:           `fc-${++seq}-${node.id}-fallback`,
        front:        `Jelaskan konsep utama dari "${node.title}" dengan kata-katamu sendiri!`,
        back:         node.content.slice(0, 300).trimEnd() + (node.content.length > 300 ? '…' : ''),
        sourceNodeId: node.id,
      })
    }
  }

  if (sourceNode) addConcepts(sourceNode, sourceNode.key_concepts)
  if (targetNode)  addConcepts(targetNode,  targetNode.key_concepts)

  // Cap at 6 to keep the session manageable
  return cards.slice(0, 6)
}

// ── RouterData builder ────────────────────────────────────────────────────────
// Assembles the shape expected by ConnectionTab from two real node objects.
// Either node may be null (locked, 403, or missing).
function buildRouterData(sourceNode, targetNode, sourceLabel, targetLabel) {
  const srcTitle = sourceNode?.title ?? sourceLabel
  const tgtTitle = targetNode?.title  ?? targetLabel

  const allConcepts = [
    ...(sourceNode?.key_concepts ?? []),
    ...(targetNode?.key_concepts  ?? []),
  ]
  // Deduplicate while preserving order
  const keyConcepts = [...new Set(allConcepts)]

  const relationshipExplanation = (sourceNode && targetNode)
    ? `"${tgtTitle}" berfokus pada konsep yang dibangun langsung di atas "${srcTitle}". ` +
      `Menguasai ${srcTitle} memastikan kamu memiliki fondasi yang dibutuhkan untuk memahami ` +
      `dan menerapkan ${tgtTitle} secara mendalam.`
    : `${tgtTitle} merupakan materi lanjutan dari ${srcTitle}. ` +
      `Pahami prasyarat ini untuk membuka potensi penuh dari koneksi ini.`

  // Build material cards from real node content
  const materials = []
  if (sourceNode?.content) {
    materials.push({
      id:      `mat-src-${sourceNode.id}`,
      type:    'source',
      title:   sourceNode.title,
      content: sourceNode.content,
    })
  }
  if (targetNode?.content) {
    materials.push({
      id:      `mat-tgt-${targetNode.id}`,
      type:    'summary',
      title:   targetNode.title,
      content: targetNode.content,
    })
  }

  return {
    relationshipExplanation,
    keyConcepts,
    materials,
    flashcards: buildFlashcards(sourceNode, targetNode),
    sourceNodeId: sourceNode?.id,
    targetNodeId: targetNode?.id,
    sourceLabel:  srcTitle,
    targetLabel:  tgtTitle,
  }
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RouterModal({ router, onClose }) {
  const [tab,     setTab]     = useState('connection')
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // Fetch real node content for both ends of the edge
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setData(null)
    setError(null)

    // Fetch both nodes in parallel; 403 (locked) is treated as null, not error
    const fetchNode = (nodeId) =>
      graphApi.fetchNode(nodeId)
        .then((r) => r.data)
        .catch((err) => {
          // 403 = locked node: return null (show graceful empty state)
          // 404 = node doesn't exist in this session: return null
          // err.status is set by the Axios interceptor in api.js (err.response is stripped)
          if (err?.status === 403 || err?.status === 404) return null
          throw err   // any other error propagates
        })

    Promise.all([
      fetchNode(router.sourceNodeId),
      fetchNode(router.targetNodeId),
    ])
      .then(([srcNode, tgtNode]) => {
        if (cancelled) return
        setData(buildRouterData(
          srcNode, tgtNode,
          router.sourceLabel ?? router.sourceNodeId,
          router.targetLabel ?? router.targetNodeId,
        ))
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err?.message ?? 'Gagal memuat konten router.')
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [router.sourceNodeId, router.targetNodeId])   // re-fetch when edge changes

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-3 pb-3 sm:pb-0"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(14px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* ── Panel ──────────────────────────────────────────────────────────── */}
      <div
        className="w-full flex flex-col rounded-3xl overflow-hidden"
        style={{
          maxWidth: 520,
          maxHeight: 'min(680px, 90vh)',
          background: 'rgba(15,17,21,0.97)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border: '1px solid rgba(255,255,255,0.09)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,243,255,0.06)',
          animation: 'cardIn 0.22s ease forwards',
        }}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <RouterHeader
          sourceLabel={router.sourceLabel ?? router.sourceNodeId}
          targetLabel={router.targetLabel ?? router.targetNodeId}
          tab={tab}
          onTabChange={setTab}
          onClose={onClose}
          flashcardCount={data?.flashcards?.length ?? 0}
        />

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onClose={onClose} />
          ) : tab === 'connection' ? (
            <ConnectionTab data={data} />
          ) : (
            <div className="pt-4 h-full" style={{ minHeight: 340 }}>
              <FlashcardPanel
                flashcards={data?.flashcards ?? []}
                sourceLabel={router.sourceLabel ?? router.sourceNodeId}
                targetLabel={router.targetLabel ?? router.targetNodeId}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── RouterHeader ──────────────────────────────────────────────────────────────
function RouterHeader({ sourceLabel, targetLabel, tab, onTabChange, onClose, flashcardCount }) {
  return (
    <div
      className="flex-shrink-0 px-5 pt-5 pb-0"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Top row: icon + connection line + close */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Router icon */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'rgba(0,243,255,0.08)',
              border: '1px solid rgba(0,243,255,0.25)',
              boxShadow: '0 0 16px rgba(0,243,255,0.12)',
            }}
          >
            <RouterHeaderSvg />
          </div>
          <div className="min-w-0">
            <p
              className="text-[10px] tracking-widest uppercase mb-0.5"
              style={{ color: 'rgba(0,243,255,0.6)' }}
            >
              Router · Material Hub
            </p>
            {/* Source → Target breadcrumb */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <NodePill label={sourceLabel} color="cyan" />
              <span className="text-white/20 text-xs">→</span>
              <NodePill label={targetLabel} color="blue" />
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="w-7 h-7 rounded-xl glass-1 flex items-center justify-center text-white/30
            hover:text-white/70 text-xs transition-colors flex-shrink-0 ml-2"
        >
          ✕
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 pb-0">
        <TabButton
          active={tab === 'connection'}
          onClick={() => onTabChange('connection')}
          label="Connection"
          icon="⚡"
        />
        <TabButton
          active={tab === 'flashcards'}
          onClick={() => onTabChange('flashcards')}
          label={`Flashcards${flashcardCount ? ` · ${flashcardCount}` : ''}`}
          icon="◈"
          accentColor="rgba(0,255,163,0.8)"
        />
      </div>
    </div>
  )
}

// ── ConnectionTab ─────────────────────────────────────────────────────────────
function ConnectionTab({ data }) {
  if (!data) return null

  return (
    <div className="pt-5 flex flex-col gap-4">

      {/* ── Why this connection ──────────────────────────────────────────── */}
      <Section
        label="Why this connection exists"
        accentColor="rgba(0,243,255,0.6)"
        icon="⚡"
      >
        <p className="text-sm text-white/70 leading-relaxed">
          {data.relationshipExplanation}
        </p>
      </Section>

      {/* ── Key concepts ────────────────────────────────────────────────── */}
      {data.keyConcepts?.length > 0 && (
        <Section label="Key concepts" accentColor="rgba(77,124,254,0.7)" icon="◈">
          <div className="flex flex-wrap gap-2">
            {data.keyConcepts.map((concept) => (
              <span
                key={concept}
                className="text-xs px-2.5 py-1 rounded-full"
                style={{
                  background: 'rgba(77,124,254,0.08)',
                  border: '1px solid rgba(77,124,254,0.2)',
                  color: 'rgba(77,124,254,0.9)',
                }}
              >
                {concept}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* ── Materials ───────────────────────────────────────────────────── */}
      {data.materials?.length > 0 && (
        <Section label="Material" accentColor="rgba(0,243,255,0.6)" icon="▣">
          <div className="flex flex-col gap-2.5">
            {data.materials.map((mat) => (
              <MaterialCard key={mat.id} material={mat} />
            ))}
          </div>
        </Section>
      )}

      {/* ── Empty state: both nodes locked ──────────────────────────────── */}
      {(!data.materials?.length && !data.keyConcepts?.length) && (
        <div className="py-8 text-center">
          <p className="text-white/30 text-sm">
            🔒 Selesaikan prasyarat untuk membuka konten koneksi ini.
          </p>
        </div>
      )}
    </div>
  )
}

// ── MaterialCard ──────────────────────────────────────────────────────────────
function MaterialCard({ material }) {
  const [expanded, setExpanded] = useState(false)

  const typeColor = {
    summary:  'rgba(0,243,255,0.6)',
    example:  'rgba(0,255,163,0.6)',
    article:  'rgba(77,124,254,0.7)',
    document: 'rgba(191,0,255,0.6)',
    source:   'rgba(255,160,30,0.6)',
  }[material.type] ?? 'rgba(255,255,255,0.3)'

  const typeLabel = {
    summary: 'Summary', example: 'Example', article: 'Article',
    document: 'Doc', source: 'Source',
  }[material.type] ?? material.type

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-200"
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Card header — always visible */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <span
          className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 font-medium"
          style={{
            background: `${typeColor.replace('0.6', '0.1').replace('0.7', '0.1')}`,
            border: `1px solid ${typeColor.replace('0.6', '0.25').replace('0.7', '0.25')}`,
            color: typeColor,
          }}
        >
          {typeLabel}
        </span>
        <span className="text-sm text-white/75 flex-1 text-left">{material.title}</span>
        <span
          className="text-white/25 text-xs transition-transform duration-200"
          style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
        >
          ▾
        </span>
      </button>

      {/* Expandable content */}
      {expanded && (
        <div className="px-4 pb-4">
          <div className="h-px bg-white/5 mb-3" />
          <p className="text-sm text-white/60 leading-relaxed">{material.content}</p>
          {material.sourceUrl && (
            <a
              href={material.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs transition-colors"
              style={{ color: 'rgba(0,243,255,0.55)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(0,243,255,0.9)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(0,243,255,0.55)' }}
            >
              ↗ View source
            </a>
          )}
        </div>
      )}
    </div>
  )
}

// ── Reusable sub-components ───────────────────────────────────────────────────

function Section({ label, accentColor, icon, children }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2.5">
        <span className="text-xs" style={{ color: accentColor }}>{icon}</span>
        <p className="text-[10px] uppercase tracking-widest font-medium" style={{ color: accentColor }}>
          {label}
        </p>
      </div>
      {children}
    </div>
  )
}

function NodePill({ label, color }) {
  const colors = {
    cyan: { bg: 'rgba(0,243,255,0.07)', border: 'rgba(0,243,255,0.2)', text: 'rgba(0,243,255,0.85)' },
    blue: { bg: 'rgba(77,124,254,0.07)', border: 'rgba(77,124,254,0.2)', text: 'rgba(77,124,254,0.9)' },
  }[color] ?? { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)', text: 'rgba(255,255,255,0.6)' }

  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full max-w-[130px] truncate"
      title={label}
      style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}
    >
      {label}
    </span>
  )
}

function TabButton({ active, onClick, label, icon, accentColor }) {
  const accent = accentColor ?? 'rgba(0,243,255,0.85)'
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium transition-all duration-200 rounded-t-xl"
      style={{
        color:        active ? accent : 'rgba(240,242,245,0.35)',
        background:   active ? 'rgba(255,255,255,0.04)' : 'transparent',
        borderBottom: active ? `2px solid ${accent}` : '2px solid transparent',
      }}
    >
      <span>{icon}</span>
      {label}
    </button>
  )
}

function LoadingState() {
  return (
    <div className="py-12 flex flex-col items-center gap-3">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ border: '1px solid rgba(0,243,255,0.2)', animation: 'glowPulse 1.5s ease-in-out infinite' }}
      >
        <span style={{ color: 'rgba(0,243,255,0.7)', fontSize: 16 }}>▣</span>
      </div>
      <p className="text-xs text-white/30 font-mono tracking-widest">ROUTER CONNECTING…</p>
      <p className="text-xs text-white/20">Loading node content</p>
    </div>
  )
}

function ErrorState({ message, onClose }) {
  return (
    <div className="py-10 text-center">
      <p className="text-white/40 text-sm mb-2">Koneksi terputus</p>
      <p className="text-white/25 text-xs mb-5 max-w-xs mx-auto">{message}</p>
      <button
        onClick={onClose}
        className="btn-liquid px-5 py-2 text-xs"
        style={{ borderColor: 'rgba(255,255,255,0.1)' }}
      >
        Tutup
      </button>
    </div>
  )
}

function RouterHeaderSvg() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="6" width="12" height="7" rx="2" stroke="rgba(0,243,255,0.85)" strokeWidth="1.4" />
      <circle cx="5"  cy="9.5" r="1" fill="rgba(0,243,255,0.85)" />
      <circle cx="8"  cy="9.5" r="1" fill="rgba(0,243,255,0.85)" />
      <circle cx="11" cy="9.5" r="1" fill="rgba(0,243,255,0.85)" />
      <line x1="5"  y1="6" x2="5"  y2="4"   stroke="rgba(0,243,255,0.85)" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="8"  y1="6" x2="8"  y2="2.5" stroke="rgba(0,243,255,0.85)" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="11" y1="6" x2="11" y2="4"   stroke="rgba(0,243,255,0.85)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
