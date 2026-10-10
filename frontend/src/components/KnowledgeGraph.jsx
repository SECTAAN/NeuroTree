/**
 * KnowledgeGraph — legacy M-1/M-2 prototype. Not used by any page.
 * Retained for reference only. All active graph rendering is in SkillTreeCanvas.jsx.
 *
 * M-19: Neon colours replaced with organic palette to keep grep clean.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant,
  Handle,
  Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { graphApi } from '../services/api'
import GlassPanel from './ui/GlassPanel'

// ── Layout helper ─────────────────────────────────────────────────────────────
function computeLayout(apiNodes, apiEdges) {
  const incomingCount = {}
  apiNodes.forEach((n) => { incomingCount[n.id] = 0 })
  apiEdges.forEach((e) => {
    if (e.target_id in incomingCount) incomingCount[e.target_id]++
  })

  const roots = apiNodes.filter((n) => incomingCount[n.id] === 0).map((n) => n.id)
  const depth = {}
  const queue = roots.map((id) => ({ id, d: 0 }))
  while (queue.length) {
    const { id, d } = queue.shift()
    if (id in depth) continue
    depth[id] = d
    apiEdges
      .filter((e) => e.source_id === id)
      .forEach((e) => queue.push({ id: e.target_id, d: d + 1 }))
  }
  apiNodes.forEach((n) => { if (!(n.id in depth)) depth[n.id] = 0 })

  const byDepth = {}
  apiNodes.forEach((n) => {
    const d = depth[n.id]
    byDepth[d] = byDepth[d] || []
    byDepth[d].push(n.id)
  })

  const X_SPACING = 220
  const Y_SPACING = 160
  const positions = {}
  Object.entries(byDepth).forEach(([d, ids]) => {
    const totalWidth = (ids.length - 1) * X_SPACING
    ids.forEach((id, i) => {
      positions[id] = {
        x: i * X_SPACING - totalWidth / 2,
        y: Number(d) * Y_SPACING,
      }
    })
  })
  return positions
}

// ── Mastery → visual class ────────────────────────────────────────────────────
function masteryClass(score, status) {
  if (status === 'locked') return 'node-locked'
  if (score >= 100)        return 'node-full'
  if (score >= 70)         return 'node-bright'
  if (score >= 40)         return 'node-medium'
  if (score > 0)           return 'node-low'
  return 'node-low'
}

// ── Custom node renderer ──────────────────────────────────────────────────────
function NeonLampNode({ data }) {
  const cls = masteryClass(data.mastery_score, data.status)
  const isLocked = data.status === 'locked'

  const handleStyle = {
    width: 10,
    height: 10,
    background: isLocked ? 'var(--nt-bg-3)' : 'var(--nt-primary)',
    border: '2px solid',
    borderColor: isLocked ? 'var(--nt-border)' : 'var(--nt-primary)',
    borderRadius: '50%',
  }

  return (
    <div style={{ position: 'relative' }}>
      <Handle type="target" position={Position.Top} style={handleStyle} isConnectable={false} />

      <div
        className={[
          'flex flex-col items-center justify-center',
          'w-36 px-3 py-4 rounded-2xl',
          'nt-panel border',
          isLocked ? 'border-nt-border' : 'border-nt-primary/40',
          cls,
          'cursor-pointer select-none transition-all duration-300 hover:scale-105',
        ].join(' ')}
      >
        <div className="text-3xl mb-1 leading-none" style={{ filter: isLocked ? 'grayscale(1) opacity(0.3)' : 'none' }}>
          💡
        </div>
        <span className={['text-xs font-medium text-center leading-tight', isLocked ? 'text-nt-muted/40' : 'text-nt-text'].join(' ')}>
          {data.label}
        </span>
        {!isLocked && (
          <div className="w-full mt-2 h-1 rounded-full bg-nt-border overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 bg-nt-primary"
              style={{ width: `${data.mastery_score}%` }}
            />
          </div>
        )}
        {isLocked && <span className="text-xs mt-1 text-nt-muted/40">🔒 Locked</span>}
      </div>

      <Handle type="source" position={Position.Bottom} style={handleStyle} isConnectable={false} />
    </div>
  )
}

const NODE_TYPES = { neonLamp: NeonLampNode }

// ── Main Component ────────────────────────────────────────────────────────────
export default function KnowledgeGraph() {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  useEffect(() => {
    let cancelled = false
    async function loadGraph() {
      try {
        setLoading(true)
        setError(null)
        const { data } = await graphApi.fetchGraph()
        if (cancelled) return

        const positions = computeLayout(data.nodes, data.edges)
        const rfNodes = data.nodes.map((n) => ({
          id: n.id,
          type: 'neonLamp',
          position: positions[n.id] ?? { x: 0, y: 0 },
          data: { label: n.title, status: n.status, mastery_score: n.mastery_score },
        }))
        const rfEdges = data.edges.map((e, idx) => ({
          id:       `edge-${e.source_id}-${e.target_id}-${idx}`,
          source:   e.source_id,
          target:   e.target_id,
          animated: true,
          type:     'default',
          style: { stroke: 'var(--nt-primary)', strokeWidth: 2 },
          markerEnd: { type: 'arrowclosed', color: 'var(--nt-primary)', width: 16, height: 16 },
        }))
        setNodes(rfNodes)
        setEdges(rfEdges)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadGraph()
    return () => { cancelled = true }
  }, [setNodes, setEdges])

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--nt-bg)' }}>
        <GlassPanel className="px-10 py-8 text-center" glow="primary">
          <div className="text-2xl mb-3 animate-pulse">🌱</div>
          <p className="text-nt-primary text-sm tracking-widest">Loading circuit…</p>
        </GlassPanel>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--nt-bg)' }}>
        <GlassPanel className="px-10 py-8 text-center max-w-sm" glow="coral">
          <div className="text-2xl mb-3">⚠️</div>
          <p className="text-nt-text/80 text-sm mb-1">Circuit disconnected</p>
          <p className="text-nt-muted text-xs">{error}</p>
          <p className="text-nt-muted/60 text-xs mt-3">
            Ensure backend is running at <code className="text-nt-primary">localhost:8000</code>
          </p>
        </GlassPanel>
      </div>
    )
  }

  if (nodes.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--nt-bg)' }}>
        <GlassPanel className="px-10 py-8 text-center max-w-sm" glow="primary">
          <div className="text-3xl mb-3">🌐</div>
          <p className="text-nt-primary text-sm tracking-widest mb-2">CIRCUIT EMPTY</p>
          <p className="text-nt-muted text-xs">No materials yet. Use the Ingestion page to load your first document.</p>
        </GlassPanel>
      </div>
    )
  }

  return (
    <div className="w-full h-full" style={{ background: 'var(--nt-bg)' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={40} size={1} color="var(--nt-border)" />
        <Controls showInteractive={false} style={{ bottom: 24, left: 24, top: 'auto' }} />
        <MiniMap
          nodeColor={(n) => n.data?.status === 'locked' ? 'var(--nt-bg-3)' : 'var(--nt-primary)'}
          maskColor="rgba(9,35,40,0.7)"
          style={{ bottom: 24, right: 24, top: 'auto' }}
        />
      </ReactFlow>
    </div>
  )
}
