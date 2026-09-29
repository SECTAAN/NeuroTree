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
// Simple layered-tree positioning:
// Builds a map of {nodeId → depth} by BFS from root nodes (no incoming edges),
// then spreads nodes horizontally within each depth layer.
function computeLayout(apiNodes, apiEdges) {
  const incomingCount = {}
  apiNodes.forEach((n) => { incomingCount[n.id] = 0 })
  apiEdges.forEach((e) => {
    if (e.target_id in incomingCount) incomingCount[e.target_id]++
  })

  // BFS: roots are nodes with no incoming edges
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
  // Fallback for any nodes not reached by BFS
  apiNodes.forEach((n) => { if (!(n.id in depth)) depth[n.id] = 0 })

  // Group by depth
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
  if (score >= 65)         return 'node-bright'
  if (score >= 40)         return 'node-medium'
  if (score > 0)           return 'node-low'
  return 'node-low'
}

// ── Custom node renderer ──────────────────────────────────────────────────────
// Inline here so React Flow's nodeTypes reference is stable.
// Will be extracted to NeonLampNode.jsx in Milestone 4.
function NeonLampNode({ data }) {
  const cls = masteryClass(data.mastery_score, data.status)
  const isLocked = data.status === 'locked'

  // Handle style — invisible dot that React Flow uses as edge anchor
  const handleStyle = {
    width: 10,
    height: 10,
    background: isLocked ? '#1e3a5f' : '#00f3ff',
    border: '2px solid',
    borderColor: isLocked ? '#1e3a5f' : '#00f3ff',
    boxShadow: isLocked ? 'none' : '0 0 6px #00f3ff',
    borderRadius: '50%',
  }

  return (
    <div
      style={{ position: 'relative' }}
    >
      {/* Target handle — edges arrive here (top) */}
      <Handle
        type="target"
        position={Position.Top}
        style={handleStyle}
        isConnectable={false}
      />

      {/* Node body */}
      <div
      className={[
        'flex flex-col items-center justify-center',
        'w-36 px-3 py-4 rounded-2xl',
        'glass-panel border',
        isLocked ? 'border-white/10' : 'border-neon-cyan/40',
        cls,
        'cursor-pointer select-none transition-all duration-300',
        'hover:scale-105',
      ].join(' ')}
      style={{
        boxShadow: isLocked
          ? 'none'
          : `0 0 ${8 + data.mastery_score * 0.3}px rgba(0,243,255,${0.2 + data.mastery_score * 0.006})`,
      }}
    >
      {/* Lamp icon */}
      <div
        className="text-3xl mb-1 leading-none"
        style={{
          filter: isLocked
            ? 'grayscale(1) opacity(0.3)'
            : `drop-shadow(0 0 ${4 + data.mastery_score * 0.1}px #00f3ff)`,
        }}
      >
        💡
      </div>

      {/* Title */}
      <span
        className={[
          'text-xs font-medium text-center leading-tight',
          isLocked ? 'text-white/30' : 'text-neon-cyan',
        ].join(' ')}
      >
        {data.label}
      </span>

      {/* Mastery bar */}
      {!isLocked && (
        <div className="w-full mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${data.mastery_score}%`,
              background: 'linear-gradient(90deg, #00f3ff, #0ea5e9)',
              boxShadow: '0 0 6px #00f3ff',
            }}
          />
        </div>
      )}

      {/* Lock icon */}
      {isLocked && (
        <span className="text-xs mt-1 text-white/20">🔒 Locked</span>
      )}
    </div>

      {/* Source handle — edges leave from here (bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={handleStyle}
        isConnectable={false}
      />
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

        // Map API nodes → React Flow node format
        const rfNodes = data.nodes.map((n) => ({
          id: n.id,
          type: 'neonLamp',
          position: positions[n.id] ?? { x: 0, y: 0 },
          data: {
            label:        n.title,
            status:       n.status,
            mastery_score: n.mastery_score,
          },
        }))

        // Map API edges → React Flow edge format
        // Backend sends { source_id, target_id } — React Flow needs { source, target }
        const rfEdges = data.edges.map((e, idx) => ({
          id:           `edge-${e.source_id}-${e.target_id}-${idx}`,
          source:       e.source_id,
          target:       e.target_id,
          // Animated dashed line — simulates energy flowing through the circuit.
          // Will be replaced by custom EnergyEdge in Milestone 4.
          animated:     true,
          type:         'default',
          style: {
            stroke:          '#00f3ff',
            strokeWidth:     2,
            strokeDasharray: '6 3',
            filter:          'drop-shadow(0 0 4px #00f3ff) drop-shadow(0 0 8px #00f3ff66)',
          },
          markerEnd: {
            type:  'arrowclosed',
            color: '#00f3ff',
            width: 16,
            height: 16,
          },
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

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-cyberpunk">
        <GlassPanel className="px-10 py-8 text-center" glow="cyan">
          <div className="text-2xl mb-3 animate-pulse">⚡</div>
          <p className="text-neon-cyan font-hud text-sm tracking-widest">
            INITIALISING CIRCUIT...
          </p>
        </GlassPanel>
      </div>
    )
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-cyberpunk">
        <GlassPanel className="px-10 py-8 text-center max-w-sm" glow="purple">
          <div className="text-2xl mb-3">⚠️</div>
          <p className="text-white/80 text-sm mb-1">Sirkuit terputus</p>
          <p className="text-white/40 text-xs">{error}</p>
          <p className="text-white/30 text-xs mt-3">
            Pastikan backend berjalan di <code className="text-neon-cyan">localhost:8000</code>
          </p>
        </GlassPanel>
      </div>
    )
  }

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (nodes.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-cyberpunk">
        <GlassPanel className="px-10 py-8 text-center max-w-sm" glow="blue">
          <div className="text-3xl mb-3">🌐</div>
          <p className="text-neon-blue font-hud text-sm tracking-widest mb-2">
            CIRCUIT EMPTY
          </p>
          <p className="text-white/50 text-xs">
            Belum ada materi. Gunakan halaman Ingestion untuk memuat dokumen pertamamu.
          </p>
        </GlassPanel>
      </div>
    )
  }

  // ── Graph canvas ────────────────────────────────────────────────────────────
  return (
    <div className="w-full h-full bg-cyberpunk bg-circuit-grid">
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
        <Background
          variant={BackgroundVariant.Dots}
          gap={40}
          size={1}
          color="rgba(14,165,233,0.12)"
        />
        <Controls
          showInteractive={false}
          style={{ bottom: 24, left: 24, top: 'auto' }}
        />
        <MiniMap
          nodeColor={(n) =>
            n.data?.status === 'locked' ? '#1e3a5f' : '#00f3ff'
          }
          maskColor="rgba(2,8,23,0.7)"
          style={{ bottom: 24, right: 24, top: 'auto' }}
        />
      </ReactFlow>
    </div>
  )
}
