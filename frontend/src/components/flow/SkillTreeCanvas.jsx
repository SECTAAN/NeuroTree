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
import MasterLightNode  from './MasterLightNode'
import EnergyEdge       from './EnergyEdge'
import CyberpunkToolbar from './CyberpunkToolbar'
import RouterModal      from '../router/RouterModal'
import NoteModal        from '../notes/NoteModal'
import { useCanvasTools } from '../../hooks/useCanvasTools'
import { graphApi, edgeApi, activeSession } from '../../services/api'
// mockProgressiveApi removed — no /expand endpoint exists yet (Phase F-2+)

// ── BFS depth-layered layout (Bottom-to-Top) ──────────────────────────────────
// Returns { positions, depth } — depth map is preserved for progressive reveal.
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
  return { positions, depth }
}

const NODE_TYPES = { neonLamp: NeonLampNode, masterLight: MasterLightNode }
const EDGE_TYPES = { energy:   EnergyEdge  }

// ── Inner canvas — needs to be inside ReactFlowProvider to use useReactFlow ──
function Canvas({ graphData }) {
  const { activeTool, selectTool, theme, toggleTheme } = useCanvasTools()
  const { zoomIn, zoomOut } = useReactFlow()

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // Ref to raw API-shape graph + depth map so we can merge without deriving from RF state
  const graphRef = useRef({ nodes: [], edges: [], depth: {} })

  // ── Progressive reveal state ──────────────────────────────────────────────
  // revealedDepth: the deepest BFS layer currently shown (0 = root only).
  // growingNodeId: node currently showing the pulse animation before reveal.
  const [revealedDepth, setRevealedDepth] = useState(0)
  const [growingNodeId, setGrowingNodeId] = useState(null)

  // ── Modal state ───────────────────────────────────────────────────────────
  // routerModal: full context object { sourceNodeId, targetNodeId, sourceLabel, targetLabel, ... }
  const [routerModal, setRouterModal] = useState(null)
  const [noteModal,   setNoteModal]   = useState(null)   // { edgeId, note } | null

  // ── Build filtered RF node/edge arrays from the full graph ────────────────
  // maxDepth: only nodes at depth <= maxDepth are included.
  // Edges are included only when BOTH source and target are within maxDepth.
  const buildRFArrays = useCallback((apiNodes, apiEdges, depthMap, maxDepth, labelMapRef) => {
    const { positions } = computeLayout(apiNodes, apiEdges)
    const labelMap = labelMapRef ?? {}
    apiNodes.forEach((n) => { labelMap[n.id] = n.title })

    const visibleIds = new Set(
      apiNodes
        .filter((n) => (depthMap[n.id] ?? 0) <= maxDepth)
        .map((n) => n.id)
    )

    const rfNodes = apiNodes
      .filter((n) => visibleIds.has(n.id))
      .map((n) => ({
        id:       n.id,
        type:     n.node_type === 'master_light' ? 'masterLight' : 'neonLamp',
        position: positions[n.id] ?? { x: 0, y: 0 },
        sourcePosition: 'top',
        targetPosition: 'bottom',
        data: {
          label:                 n.title,
          status:                n.status,
          mastery_score:         n.mastery_score,
          id:                    n.id,
          node_type:             n.node_type ?? 'knowledge',
          master_light_unlocked: n.master_light_unlocked ?? false,
          master_light_mastery:  n.master_light_mastery  ?? 0,
        },
      }))

    const rfEdges = apiEdges
      .filter((e) => visibleIds.has(e.source_id) && visibleIds.has(e.target_id))
      .map((e, idx) => {
        // Use the stable DB UUID as the RF edge id so PATCH calls have the right key.
        // Fall back to synthetic id for edges that pre-date the id field (edge case).
        const edgeId = e.id ?? `e-${e.source_id}-${e.target_id}-${idx}`

        // Restore a persisted note string from GET /graph as a NoteData object.
        // The backend stores note as a plain TEXT column; we wrap it here so the
        // rest of the frontend (EnergyEdge, NoteModal) sees a consistent shape.
        const restoredNote = e.note
          ? { id: `note-${edgeId}`, edgeId, content: e.note, createdAt: null, updatedAt: null }
          : null

        return {
          id:     edgeId,
          source: e.source_id,
          target: e.target_id,
          type:   'energy',
          data: {
            status:  e.status ?? (e.unlocked === false ? 'locked' : 'active'),
            router:  e.router_enabled
              ? {
                  id:           `router-${edgeId}`,
                  edgeId,
                  sourceNodeId: e.source_id,
                  targetNodeId: e.target_id,
                  sourceLabel:  labelMap[e.source_id] ?? e.source_id,
                  targetLabel:  labelMap[e.target_id] ?? e.target_id,
                  title:        `${labelMap[e.source_id] ?? e.source_id} → ${labelMap[e.target_id] ?? e.target_id}`,
                  createdAt:    null,
                }
              : (e.router ?? null),
            note:    restoredNote,
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

    return { rfNodes, rfEdges }
  }, [setRouterModal, setNoteModal])

  // ── Apply a set of RF nodes+edges to React Flow state ─────────────────────
  const applyRFArrays = useCallback(({ rfNodes, rfEdges }) => {
    setNodes(rfNodes)
    setEdges(rfEdges)
  }, [setNodes, setEdges])

  // ── Single effect handling both initial load and mastery re-sync ──────────
  // We distinguish the two cases by comparing node-ID sets:
  //   • Different ID set (or first load)  → brand-new graph → reset revealedDepth to 0
  //   • Same ID set                       → mastery re-sync → patch visible nodes only,
  //                                         preserve revealedDepth so revealed layers stay
  const prevNodeIdsRef = useRef(new Set())
  useEffect(() => {
    if (!graphData?.nodes?.length) return

    const newIds  = new Set(graphData.nodes.map((n) => n.id))
    const prevIds = prevNodeIdsRef.current

    const isSameGraph =
      prevIds.size > 0 &&
      newIds.size === prevIds.size &&
      [...newIds].every((id) => prevIds.has(id))

    prevNodeIdsRef.current = newIds

    if (isSameGraph) {
      // ── Mastery re-sync: only patch mastery/status on already-visible nodes
      setNodes((prev) =>
        prev.map((rfNode) => {
          const updated = graphData.nodes.find((n) => n.id === rfNode.id)
          if (!updated) return rfNode
          return {
            ...rfNode,
            data: {
              ...rfNode.data,
              mastery_score:         updated.mastery_score,
              status:                updated.status,
              master_light_unlocked: updated.master_light_unlocked ?? rfNode.data.master_light_unlocked,
              master_light_mastery:  updated.master_light_mastery  ?? rfNode.data.master_light_mastery,
            },
          }
        })
      )
      // Refresh stored raw nodes so future Grow reveals use fresh mastery data
      graphRef.current = {
        ...graphRef.current,
        nodes: graphData.nodes,
        edges: graphData.edges,
      }
      return
    }

    // ── Brand-new graph: restore persisted reveal depth (or start at 0) ───
    // graphData.revealed_depth is returned by GET /api/v1/graph (F-8E.3).
    // For a freshly generated tree this will be 0; for a refreshed session
    // it will be whatever depth the user had already revealed.
    const { depth } = computeLayout(graphData.nodes, graphData.edges)
    graphRef.current = { nodes: graphData.nodes, edges: graphData.edges, depth }

    const maxAvailable = Math.max(0, ...Object.values(depth))
    const restoredDepth = Math.min(
      typeof graphData.revealed_depth === 'number' ? graphData.revealed_depth : 0,
      maxAvailable,
    )

    setRevealedDepth(restoredDepth)
    setGrowingNodeId(null)

    const { rfNodes, rfEdges } = buildRFArrays(
      graphData.nodes, graphData.edges, depth, restoredDepth
    )
    applyRFArrays({ rfNodes, rfEdges })
  }, [graphData, buildRFArrays, applyRFArrays, setNodes])

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
  // default tool: node card opens inside NeonLampNode via its own onClick.
  // grow tool: reveal the next BFS depth layer.
  const onNodeClick = useCallback((_event, rfNode) => {
    if (activeTool !== 'grow') return
    if (growingNodeId !== null) return   // animation in progress — ignore

    const { nodes: apiNodes, edges: apiEdges, depth: depthMap } = graphRef.current
    if (!apiNodes.length) return

    // Only allow clicking a node that is in the currently visible set
    const nodeDepth = depthMap[rfNode.id] ?? 0
    if (nodeDepth > revealedDepth) return

    // Find the next depth level that actually has nodes
    const maxAvailableDepth = Math.max(0, ...Object.values(depthMap))
    const nextDepth = revealedDepth + 1
    if (nextDepth > maxAvailableDepth) return   // already fully revealed

    // 1. Show grow-pulse animation on the clicked node
    setGrowingNodeId(rfNode.id)
    setNodes((prev) =>
      prev.map((n) =>
        n.id === rfNode.id ? { ...n, data: { ...n.data, growing: true } } : n
      )
    )

    // 2. After pulse plays, reveal the next layer
    setTimeout(() => {
      setGrowingNodeId(null)
      setNodes((prev) =>
        prev.map((n) =>
          n.id === rfNode.id ? { ...n, data: { ...n.data, growing: false } } : n
        )
      )

      const newRevealedDepth = nextDepth
      setRevealedDepth(newRevealedDepth)

      const { rfNodes, rfEdges } = buildRFArrays(
        apiNodes, apiEdges, depthMap, newRevealedDepth
      )
      // lamp-mount + cable-draw CSS animations fire automatically on new
      // React Flow nodes/edges (they're applied via className in NeonLampNode
      // and EnergyEdge respectively).
      applyRFArrays({ rfNodes, rfEdges })

      // F-8E.3: persist reveal depth so a page refresh restores this state.
      // Fire-and-forget — a network failure does not affect the local UI.
      const sid = activeSession.id
      if (sid) {
        graphApi.updateRevealDepth(sid, newRevealedDepth).catch(() => {})
      }
    }, 420)   // matches growPulse duration (1s) with a comfortable lead-in
  }, [activeTool, revealedDepth, growingNodeId, buildRFArrays, applyRFArrays, setNodes])

  // ── Note save handler — persists to backend, updates local state ──────────
  const handleNoteSave = useCallback(async (edgeId, content) => {
    try {
      await edgeApi.annotate(edgeId, { note: content })
    } catch (err) {
      // Surface error visibly instead of silently pretending the save succeeded.
      // NoteModal has already closed its saving spinner at this point; re-open
      // with an error so the user knows to retry.
      console.error('[NeuroTree] Note save failed:', err)
      setNoteModal((prev) =>
        prev ? { ...prev, _saveError: err.message ?? 'Save failed — please retry.' } : prev
      )
      return   // do NOT update local state if the server rejected the save
    }

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

  // ── Note delete handler — clears on backend, then clears local state ──────
  const handleNoteDelete = useCallback(async (edgeId) => {
    try {
      await edgeApi.annotate(edgeId, { note: '' })  // empty string → backend stores NULL
    } catch (err) {
      console.error('[NeuroTree] Note delete failed:', err)
      setNoteModal((prev) =>
        prev ? { ...prev, _saveError: err.message ?? 'Delete failed — please retry.' } : prev
      )
      return
    }

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
