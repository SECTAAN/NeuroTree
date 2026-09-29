import { useCallback, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import NeonLampNode from './NeonLampNode'
import EnergyEdge  from './EnergyEdge'

// ── Layout — BFS depth-layered tree ──────────────────────────────────────────
function computeLayout(apiNodes, apiEdges) {
  const inCount = {}
  apiNodes.forEach((n) => { inCount[n.id] = 0 })
  apiEdges.forEach((e) => { if (e.target_id in inCount) inCount[e.target_id]++ })

  const roots = apiNodes.filter((n) => inCount[n.id] === 0).map((n) => n.id)
  const depth = {}
  const queue = roots.map((id) => ({ id, d: 0 }))
  while (queue.length) {
    const { id, d } = queue.shift()
    if (id in depth) continue
    depth[id] = d
    apiEdges.filter((e) => e.source_id === id).forEach((e) => queue.push({ id: e.target_id, d: d + 1 }))
  }
  apiNodes.forEach((n) => { if (!(n.id in depth)) depth[n.id] = 0 })

  const X_STEP = 200   // wider horizontal spacing so SmoothStep curves don't overlap
  const Y_STEP = 160   // taller vertical spacing for clean vertical cable runs

  // Bottom-to-Top: root (depth 0) sits at the bottom (max Y), children grow upward
  const maxDepth = Math.max(0, ...Object.values(depth))

  const byDepth = {}
  apiNodes.forEach((n) => {
    const d = depth[n.id]
    byDepth[d] = byDepth[d] || []
    byDepth[d].push(n.id)
  })

  const positions = {}

  Object.entries(byDepth).forEach(([d, ids]) => {
    const total = (ids.length - 1) * X_STEP
    ids.forEach((id, i) => {
      positions[id] = {
        x: i * X_STEP - total / 2,
        // depth 0 (root) → y = maxDepth * Y_STEP (bottom)
        // depth maxDepth  → y = 0 (top)
        y: (maxDepth - Number(d)) * Y_STEP,
      }
    })
  })
  return positions
}

const NODE_TYPES = { neonLamp: NeonLampNode }
const EDGE_TYPES = { energy:   EnergyEdge  }

export default function SkillTreeCanvas({ graphData }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  useEffect(() => {
    if (!graphData?.nodes?.length) return
    const positions = computeLayout(graphData.nodes, graphData.edges)

    setNodes(
      graphData.nodes.map((n) => ({
        id:       n.id,
        type:     'neonLamp',
        position: positions[n.id] ?? { x: 0, y: 0 },
        // Tell React Flow which side handles sit on — must match NeonLampNode Handle positions.
        // Bottom-to-Top layout: source (outgoing) is Top, target (incoming) is Bottom.
        sourcePosition: 'top',
        targetPosition: 'bottom',
        data: {
          label:         n.title,
          status:        n.status,
          mastery_score: n.mastery_score,
          // Pass the real node ID into data so GlowingNodeCard → QuizModal can use it
          id:            n.id,
        },
      }))
    )

    setEdges(
      graphData.edges.map((e, idx) => ({
        id:     `e-${e.source_id}-${e.target_id}-${idx}`,
        source: e.source_id,
        target: e.target_id,
        type:   'energy',
        data:   { unlocked: e.unlocked !== false },
      }))
    )
  }, [graphData, setNodes, setEdges])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={NODE_TYPES}
      edgeTypes={EDGE_TYPES}
      fitView
      fitViewOptions={{ padding: 0.35 }}
      minZoom={0.25}
      maxZoom={2.5}
      proOptions={{ hideAttribution: true }}
      style={{ background: 'transparent' }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={48}
        size={1}
        color="rgba(255,255,255,0.04)"
      />
      <Controls
        showInteractive={false}
        style={{ bottom: 20, left: 20, top: 'auto' }}
      />
      <MiniMap
        nodeColor={(n) => n.data?.status === 'locked' ? '#2a2d31' : 'rgba(0,243,255,0.5)'}
        maskColor="rgba(17,19,21,0.75)"
        style={{ bottom: 20, right: 20, top: 'auto' }}
      />
    </ReactFlow>
  )
}
