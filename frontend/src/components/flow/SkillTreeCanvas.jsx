import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow,
  MiniMap,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import NeonLampNode     from './NeonLampNode'
import EnergyEdge       from './EnergyEdge'
import CyberpunkToolbar from './CyberpunkToolbar'
import RouterModal      from '../router/RouterModal'
import NoteModal        from '../notes/NoteModal'
import { useCanvasTools } from '../../hooks/useCanvasTools'
// mockProgressiveApi removed — no /expand endpoint exists yet (Phase F-2+)

// ── BFS depth-layered layout (Bottom-to-Top) ──────────────────────────────────
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

  const X_STEP = 200
  const Y_STEP = 160
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
        y: (maxDepth - Number(d)) * Y_STEP,
      }
    })
  })
  return positions
}

const NODE_TYPES = { neonLamp: NeonLampNode }
const EDGE_TYPES = { energy:   EnergyEdge  }

// ── Inner canvas — needs to be inside ReactFlowProvider to use useReactFlow ──
function Canvas({ graphData }) {
  const { activeTool, selectTool, theme, toggleTheme } = useCanvasTools()
  const { zoomIn, zoomOut } = useReactFlow()

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // Ref to raw API-shape graph so we can merge without deriving from RF state
  const graphRef = useRef({ nodes: [], edges: [] })

  // ── Modal state ───────────────────────────────────────────────────────────
  // routerModal: full context object { sourceNodeId, targetNodeId, sourceLabel, targetLabel, ... }
  const [routerModal, setRouterModal] = useState(null)
  const [noteModal,   setNoteModal]   = useState(null)   // { edgeId, note } | null

  // ── Shared helper: build RF nodes+edges from raw API-shape arrays ─────────
  const applyGraph = useCallback((apiNodes, apiEdges) => {
    const positions = computeLayout(apiNodes, apiEdges)
    const labelMap  = {}
    apiNodes.forEach((n) => { labelMap[n.id] = n.title })

    setNodes(
      apiNodes.map((n) => ({
        id:       n.id,
        type:     'neonLamp',
        position: positions[n.id] ?? { x: 0, y: 0 },
        sourcePosition: 'top',
        targetPosition: 'bottom',
        data: {
          label:         n.title,
          status:        n.status,
          mastery_score: n.mastery_score,
          id:            n.id,
        },
      }))
    )

    setEdges(
      apiEdges.map((e, idx) => {
        const edgeId = `e-${e.source_id}-${e.target_id}-${idx}`
        return {
          id:     edgeId,
          source: e.source_id,
          target: e.target_id,
          type:   'energy',
          data: {
            status:  e.status ?? (e.unlocked === false ? 'locked' : 'active'),
            router:  e.router ?? null,
            note:    e.note   ?? null,
            onOpenRouter: (router) => setRouterModal({
              ...router,
              sourceLabel: labelMap[router.sourceNodeId] ?? router.sourceNodeId,
              targetLabel: labelMap[router.targetNodeId] ?? router.targetNodeId,
            }),
            onOpenNote: (note) => setNoteModal({
              edgeId,
              sourceNodeId: e.source_id,
              targetNodeId: e.target_id,
              note,
            }),
          },
        }
      })
    )
  }, [setNodes, setEdges])

  // ── Build React Flow nodes/edges from API graph data ─────────────────────
  useEffect(() => {
    if (!graphData?.nodes?.length) return
    graphRef.current = {
      nodes: graphData.nodes,
      edges: graphData.edges,
    }
    applyGraph(graphData.nodes, graphData.edges)
  }, [graphData, applyGraph])

  // ── Edge click dispatcher (spec 10.87) ────────────────────────────────────
  const onEdgeClick = useCallback((event, edge) => {
    // Pan mode: ignore all edge interactions
    if (activeTool === 'pan') return

    if (activeTool === 'cut') {
      // Soft-delete — change visual status, preserve all learning data
      setEdges((eds) =>
        eds.map((e) =>
          e.id === edge.id
            ? { ...e, data: { ...e.data, status: e.data.status === 'cut' ? 'active' : 'cut' } }
            : e
        )
      )
      return
    }

    if (activeTool === 'router') {
      setEdges((eds) => {
        // Resolve labels from current nodes state for rich modal context
        const labelMap = {}
        nodes.forEach((n) => { labelMap[n.id] = n.data?.label ?? n.id })

        return eds.map((e) => {
          if (e.id !== edge.id) return e
          // Toggle: second click on same edge removes the router marker
          if (e.data.router) {
            return { ...e, data: { ...e.data, router: null } }
          }
          const newRouter = {
            id:           `router-${edge.id}`,
            edgeId:       edge.id,
            sourceNodeId: edge.source,
            targetNodeId: edge.target,
            sourceLabel:  labelMap[edge.source] ?? edge.source,
            targetLabel:  labelMap[edge.target] ?? edge.target,
            title:        `${labelMap[edge.source] ?? edge.source} → ${labelMap[edge.target] ?? edge.target}`,
            createdAt:    new Date().toISOString(),
          }
          return { ...e, data: { ...e.data, router: newRouter } }
        })
      })
      return
    }

    if (activeTool === 'note') {
      // Open note creation modal — pre-seed with edge context
      const existingNote = edge.data?.note ?? null
      setNoteModal({
        edgeId:       edge.id,
        sourceNodeId: edge.source,
        targetNodeId: edge.target,
        note:         existingNote,
      })
      return
    }

    // 'default' tool → no special edge action (node card handles selection)
  }, [activeTool, nodes, setEdges])

  // ── Node click dispatcher ─────────────────────────────────────────────────
  // 'grow' tool is a future feature (no /expand backend endpoint yet).
  // The toolbar does not expose it, but keyboard shortcut G can activate it.
  // Clicking a node while 'grow' is active is intentionally a no-op until
  // the real expand endpoint is implemented in a later phase.
  const onNodeClick = useCallback((_event, _node) => {
    // No action: node card is opened inside NeonLampNode via its own onClick.
    // 'grow' tool no-op: mockProgressiveApi removed, real endpoint pending.
  }, [])

  // ── Note save handler ─────────────────────────────────────────────────────
  const handleNoteSave = useCallback((edgeId, content) => {
    setEdges((eds) =>
      eds.map((e) => {
        if (e.id !== edgeId) return e
        const note = {
          id:           `note-${edgeId}`,
          edgeId,
          sourceNodeId: e.source,
          targetNodeId: e.target,
          content,
          createdAt:    e.data.note?.createdAt ?? new Date().toISOString(),
          updatedAt:    new Date().toISOString(),
        }
        return { ...e, data: { ...e.data, note } }
      })
    )
    setNoteModal(null)
  }, [setEdges])

  // ── Note delete handler ───────────────────────────────────────────────────
  const handleNoteDelete = useCallback((edgeId) => {
    setEdges((eds) =>
      eds.map((e) => e.id !== edgeId ? e : { ...e, data: { ...e.data, note: null } })
    )
    setNoteModal(null)
  }, [setEdges])

  // ── Cursor style driven by active tool ────────────────────────────────────
  const cursorStyle =
    activeTool === 'pan'    ? 'grab'     :
    activeTool === 'cut'    ? 'crosshair' :
    activeTool === 'router' ? 'cell'     :
    activeTool === 'note'   ? 'copy'     :
    'default'

  const isLight = theme === 'light'

  // ── Grid colours tuned to app palette ─────────────────────────────────────
  // Dark : surface #111315, grid lines slightly lighter
  // Light: surface #f0f2f5, grid lines slightly darker
  const gridLineColor  = isLight ? '#d4d8df' : '#1e2530'
  const surfaceColor   = isLight ? '#f0f2f5' : '#111315'
  // Radial mask fades the grid from transparent at the centre outward to the
  // surface colour at the edges — creates the "vignette blueprint" look.
  const radialMaskBg   = isLight
    ? 'radial-gradient(ellipse at center, transparent 15%, #f0f2f5 75%)'
    : 'radial-gradient(ellipse at center, transparent 15%, #111315 75%)'

  return (
    // ── Layer 1: surface base colour ──────────────────────────────────────
    <div
      className="w-full h-full relative"
      style={{ background: surfaceColor, cursor: cursorStyle }}
    >
      {/* ── Layer 2: Aceternity-style small grid ──────────────────────── */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundSize: '20px 20px',
          backgroundImage: `
            linear-gradient(to right,  ${gridLineColor} 1px, transparent 1px),
            linear-gradient(to bottom, ${gridLineColor} 1px, transparent 1px)
          `,
        }}
      />

      {/* ── Layer 3: Radial vignette mask ─────────────────────────────── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: radialMaskBg }}
      />

      {/* ── React Flow (transparent — grid shows through) ─────────────── */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onEdgeClick={onEdgeClick}
        onNodeClick={onNodeClick}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.35 }}
        minZoom={0.25}
        maxZoom={2.0}
        nodesDraggable={activeTool !== 'pan'}
        nodesConnectable={false}
        elementsSelectable={activeTool === 'default'}
        panOnDrag={true}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'transparent' }}
      >
        <MiniMap
          nodeColor={(n) => n.data?.status === 'locked'
            ? (isLight ? '#c8cdd4' : '#2a2d31')
            : 'rgba(0,180,210,0.6)'}
          maskColor={isLight ? 'rgba(220,225,230,0.80)' : 'rgba(17,19,21,0.75)'}
          style={{
            bottom: 20, right: 80, top: 'auto',
            background: isLight ? 'rgba(240,242,245,0.92)' : 'rgba(17,19,21,0.92)',
            border: `1px solid ${isLight ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.06)'}`,
          }}
        />
      </ReactFlow>

      {/* ── Floating toolbar ───────────────────────────────────────────── */}
      <CyberpunkToolbar
        activeTool={activeTool}
        onSelectTool={selectTool}
        theme={theme}
        onToggleTheme={toggleTheme}
        onZoomIn={() => zoomIn({ duration: 200 })}
        onZoomOut={() => zoomOut({ duration: 200 })}
      />

      {/* ── Note modal (P2) — uses standalone NoteModal component ──────── */}
      {noteModal && (
        <NoteModal
          context={noteModal}
          onSave={handleNoteSave}
          onDelete={handleNoteDelete}
          onClose={() => setNoteModal(null)}
        />
      )}

      {/* ── Router modal (P1 — full connection + flashcard UI) ───────────── */}
      {routerModal && (
        <RouterModal
          router={routerModal}
          onClose={() => setRouterModal(null)}
        />
      )}
    </div>
  )
}

// ── Public export — wrapped in ReactFlowProvider so useReactFlow() works ──────
export default function SkillTreeCanvas({ graphData }) {
  return (
    <ReactFlowProvider>
      <Canvas graphData={graphData} />
    </ReactFlowProvider>
  )
}
