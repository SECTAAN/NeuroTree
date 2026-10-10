import { useState, useEffect } from 'react'
import FlashcardPanel from '../flashcards/FlashcardPanel'
import { graphApi, activeSession } from '../../services/api'
import { flashcardStorageKey } from '../../hooks/useFlashcardProgress'

/**
 * RouterModal — P1 Material Hub modal (spec 10.67).
 * M-19: full palette, skeuomorphic surface. All neon removed.
 */

// ── Flashcard builder ─────────────────────────────────────────────────────────
function buildFlashcards(sourceNode, targetNode) {
  const cards = []
  function addConcepts(node, concepts) {
    if (!concepts?.length) return
    concepts.slice(0, 3).forEach((concept, i) => {
      cards.push({
        id: `${node?.id ?? 'x'}-${i}`,
        front: `What is "${concept}"?`,
        back: node?.content
          ? `${concept} — ${node.content.slice(0, 180)}…`
          : `Key concept from ${node?.title ?? 'this node'}: ${concept}.`,
        sourceNodeId: node?.id,
      })
    })
  }
  if (sourceNode?.key_concepts?.length) {
    addConcepts(sourceNode, sourceNode.key_concepts)
  } else if (sourceNode?.content) {
    cards.push({
      id: `${sourceNode.id}-fallback`,
      front: `Summarise: "${sourceNode.title}"`,
      back: sourceNode.content.slice(0, 220),
      sourceNodeId: sourceNode.id,
    })
  }
  if (targetNode?.key_concepts?.length) {
    addConcepts(targetNode, targetNode.key_concepts)
  } else if (targetNode?.content && cards.length < 6) {
    cards.push({
      id: `${targetNode.id}-fallback`,
      front: `Summarise: "${targetNode.title}"`,
      back: targetNode.content.slice(0, 220),
      sourceNodeId: targetNode.id,
    })
  }
  return cards.slice(0, 6)
}

function buildRouterData(sourceNode, targetNode, sourceLabel, targetLabel) {
  const srcConcepts = sourceNode?.key_concepts ?? []
  const tgtConcepts = targetNode?.key_concepts ?? []
  const keyConcepts = [...new Set([...srcConcepts, ...tgtConcepts])].slice(0, 8)

  const explanations = [
    sourceNode && `"${sourceNode.title}" establishes the foundational concepts needed to progress.`,
    targetNode && `"${targetNode.title}" builds upon these concepts.`,
    keyConcepts.length > 0 && `Key shared concepts: ${keyConcepts.slice(0, 3).join(', ')}.`,
  ].filter(Boolean)

  const materials = []
  if (sourceNode?.content) {
    materials.push({
      id: `${sourceNode.id}-summary`,
      type: 'summary',
      title: sourceLabel,
      content: sourceNode.content,
    })
  }
  if (targetNode?.content) {
    materials.push({
      id: `${targetNode.id}-summary`,
      type: 'summary',
      title: targetLabel,
      content: targetNode.content,
    })
  }

  return {
    sourceLabel,
    targetLabel,
    relationshipExplanation: explanations.join(' '),
    keyConcepts,
    materials,
    flashcards: buildFlashcards(sourceNode, targetNode),
  }
}

export default function RouterModal({ router, onClose }) {
  const [tab,     setTab]     = useState('connection')
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setData(null)
    setError(null)

    const fetchNode = (nodeId) =>
      graphApi.fetchNode(nodeId)
        .then((r) => r.data)
        .catch((err) => {
          if (err?.status === 403 || err?.status === 404) return null
          throw err
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
  }, [router.sourceNodeId, router.targetNodeId])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-3 pb-3 sm:pb-0 nt-modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* ── Panel ──────────────────────────────────────────────────────────── */}
      <div
        className="w-full flex flex-col rounded-3xl overflow-hidden animate-[cardIn_0.22s_ease_forwards]"
        style={{
          maxWidth: 520,
          maxHeight: 'min(680px, 90vh)',
          background: 'var(--nt-bg)',
          border: '1px solid var(--nt-border)',
          boxShadow: 'var(--nt-shadow-out)',
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
                storageKey={flashcardStorageKey(activeSession.id, router.edgeId)}
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
      className="flex-shrink-0 px-5 pt-5 pb-0 nt-modal-header"
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Router icon — clay raised */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'rgba(53,78,71,0.10)',
              border: '1px solid rgba(53,78,71,0.22)',
              boxShadow: 'var(--nt-shadow-out-sm)',
            }}
          >
            <RouterHeaderSvg />
          </div>
          <div className="min-w-0">
            <p className="nt-section-label mb-0.5">Router · Material Hub</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <NodePill label={sourceLabel} color="source" />
              <span className="text-xs" style={{ color: 'var(--nt-text-muted)' }}>→</span>
              <NodePill label={targetLabel} color="target" />
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="w-7 h-7 rounded-xl nt-card flex items-center justify-center text-xs transition-colors flex-shrink-0 ml-2"
          style={{ color: 'var(--nt-text-3)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--nt-coral)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--nt-text-3)' }}
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
          accentColor="coral"
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

      {/* Why this connection */}
      <Section label="Why this connection exists" accent="primary" icon="⚡">
        <p className="text-sm leading-relaxed" style={{ color: 'var(--nt-text-2)' }}>
          {data.relationshipExplanation}
        </p>
      </Section>

      {/* Key concepts */}
      {data.keyConcepts?.length > 0 && (
        <Section label="Key concepts" accent="coral" icon="◈">
          <div className="flex flex-wrap gap-2">
            {data.keyConcepts.map((concept) => (
              <span key={concept} className="nt-chip">
                {concept}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Materials */}
      {data.materials?.length > 0 && (
        <Section label="Material" accent="primary" icon="▣">
          <div className="flex flex-col gap-2.5">
            {data.materials.map((mat) => (
              <MaterialCard key={mat.id} material={mat} />
            ))}
          </div>
        </Section>
      )}

      {/* Empty state */}
      {(!data.materials?.length && !data.keyConcepts?.length) && (
        <div className="py-8 text-center">
          <p className="text-sm" style={{ color: 'var(--nt-text-3)' }}>
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

  const typeLabel = {
    summary: 'Summary', example: 'Example', article: 'Article',
    document: 'Doc', source: 'Source',
  }[material.type] ?? material.type

  return (
    <div
      className="nt-card rounded-2xl overflow-hidden transition-all duration-200"
      style={{ boxShadow: 'var(--nt-shadow-out-sm)' }}
    >
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="nt-chip-coral text-[10px] flex-shrink-0">{typeLabel}</span>
        <span className="text-sm flex-1 text-left" style={{ color: 'var(--nt-text)' }}>{material.title}</span>
        <span
          className="text-xs transition-transform duration-200"
          style={{
            color: 'var(--nt-text-3)',
            transform: expanded ? 'rotate(180deg)' : 'none',
          }}
        >
          ▾
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          <div className="nt-divider mb-3" />
          <p className="text-sm leading-relaxed" style={{ color: 'var(--nt-text-2)' }}>{material.content}</p>
          {material.sourceUrl && (
            <a
              href={material.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs transition-colors"
              style={{ color: 'var(--nt-primary-lt)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--nt-primary)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--nt-primary-lt)' }}
            >
              ↗ View source
            </a>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ label, accent, icon, children }) {
  const color = accent === 'primary' ? 'var(--nt-primary-lt)' :
                accent === 'coral'   ? 'var(--nt-coral)'       :
                'var(--nt-text-3)'
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2.5">
        <span className="text-xs" style={{ color }}>{icon}</span>
        <p className="nt-section-label" style={{ color }}>{label}</p>
      </div>
      {children}
    </div>
  )
}

function NodePill({ label, color }) {
  const isPrimary = color === 'source'
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full max-w-[130px] truncate"
      title={label}
      style={{
        background: isPrimary ? 'rgba(53,78,71,0.10)' : 'rgba(219,98,113,0.08)',
        border: isPrimary ? '1px solid rgba(53,78,71,0.22)' : '1px solid rgba(219,98,113,0.22)',
        color: isPrimary ? 'var(--nt-primary-lt)' : 'var(--nt-coral)',
      }}
    >
      {label}
    </span>
  )
}

function TabButton({ active, onClick, label, icon, accentColor }) {
  const color = accentColor === 'coral' ? 'var(--nt-coral)' : 'var(--nt-primary-lt)'
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium transition-all duration-200 rounded-t-xl"
      style={{
        color:        active ? color : 'var(--nt-text-3)',
        background:   active ? 'rgba(53,78,71,0.06)' : 'transparent',
        borderBottom: active ? `2px solid ${color}` : '2px solid transparent',
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
      <div className="nt-spinner" />
      <p className="nt-section-label">Connecting…</p>
      <p className="text-xs" style={{ color: 'var(--nt-text-muted)' }}>Loading node content</p>
    </div>
  )
}

function ErrorState({ message, onClose }) {
  return (
    <div className="py-10 text-center">
      <p className="text-sm mb-2" style={{ color: 'var(--nt-text-2)' }}>Koneksi terputus</p>
      <p className="text-xs mb-5 max-w-xs mx-auto" style={{ color: 'var(--nt-text-3)' }}>{message}</p>
      <button onClick={onClose} className="nt-btn-secondary px-5 py-2 text-xs">Tutup</button>
    </div>
  )
}

function RouterHeaderSvg() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="6" width="12" height="7" rx="2" stroke="var(--nt-primary-lt)" strokeWidth="1.4" />
      <circle cx="5"  cy="9.5" r="1" fill="var(--nt-primary-lt)" />
      <circle cx="8"  cy="9.5" r="1" fill="var(--nt-primary-lt)" />
      <circle cx="11" cy="9.5" r="1" fill="var(--nt-primary-lt)" />
      <line x1="5"  y1="6" x2="5"  y2="4"   stroke="var(--nt-primary-lt)" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="8"  y1="6" x2="8"  y2="2.5" stroke="var(--nt-primary-lt)" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="11" y1="6" x2="11" y2="4"   stroke="var(--nt-primary-lt)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
