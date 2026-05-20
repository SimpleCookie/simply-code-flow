import { useCallback, useRef } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  SelectionMode,
  applyNodeChanges,
  applyEdgeChanges,
  type Connection,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  type OnNodesChange,
  type OnEdgesChange,
  type OnReconnect,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { nanoid } from 'nanoid'
import { CustomNode } from './CustomNode.tsx'
import { CustomEdge } from './CustomEdge.tsx'
import { BranchNode } from './BranchNode.tsx'
import { useFlowStore } from '../../store/flowStore.ts'
import { useUIStore } from '../../store/uiStore.ts'
import { KIND_COLORS } from '@scf/shared'
import type { CustomNodeData } from './CustomNode.tsx'

// Defined outside component to avoid React Flow re-registration warnings
const nodeTypes: NodeTypes = { codeNode: CustomNode, branch: BranchNode }
const edgeTypes: EdgeTypes = { codeEdge: CustomEdge }

export function GraphCanvas() {
  const nodes = useFlowStore((s) => s.nodes)
  const edges = useFlowStore((s) => s.edges)
  const setNodes = useFlowStore((s) => s.setNodes)
  const setEdges = useFlowStore((s) => s.setEdges)
  const addEdgeToStore = useFlowStore((s) => s.addEdge)
  const reconnectEdgeStore = useFlowStore((s) => s.reconnectEdge)
  const pushHistory = useFlowStore((s) => s.pushHistory)

  const selectNode = useUIStore((s) => s.selectNode)
  const selectEdge = useUIStore((s) => s.selectEdge)
  const clearSelection = useUIStore((s) => s.clearSelection)
  const openCodeOverlay = useUIStore((s) => s.openCodeOverlay)

  // Track whether a reconnect drag completed successfully
  const reconnectSuccessful = useRef(false)

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      const hasRemovals = changes.some((c) => c.type === 'remove')
      if (hasRemovals) pushHistory()
      setNodes(applyNodeChanges(changes, nodes))
    },
    [nodes, setNodes, pushHistory],
  )

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setEdges(applyEdgeChanges(changes, edges))
    },
    [edges, setEdges],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return
      if (connection.source === connection.target) return
      addEdgeToStore({
        id: nanoid(),
        source: connection.source,
        target: connection.target,
        kind: 'calls',
        confidence: 'suspected',
      })
    },
    [addEdgeToStore],
  )

  const onReconnectStart = useCallback(() => {
    reconnectSuccessful.current = false
  }, [])

  const onReconnect: OnReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      reconnectSuccessful.current = true
      if (!newConnection.source || !newConnection.target) return
      reconnectEdgeStore(oldEdge.id, newConnection.source, newConnection.target)
    },
    [reconnectEdgeStore],
  )

  const onReconnectEnd = useCallback(
    (_: MouseEvent | TouchEvent, _edge: Edge) => {
      // If drop landed in empty space, snap back by doing nothing (edge still in store)
      if (!reconnectSuccessful.current) {
        // Force re-render by touching edges — no-op needed, store is source of truth
        setEdges([...edges])
      }
      reconnectSuccessful.current = false
    },
    [edges, setEdges],
  )

  const onNodeDragStart = useCallback(() => {
    pushHistory()
  }, [pushHistory])

  // Multi-node drag also needs a history entry
  const onSelectionDragStart = useCallback(() => {
    pushHistory()
  }, [pushHistory])

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      selectNode(node.id)
    },
    [selectNode],
  )

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      openCodeOverlay(node.id)
    },
    [openCodeOverlay],
  )

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: { id: string }) => {
      selectEdge(edge.id)
    },
    [selectEdge],
  )

  const onPaneClick = useCallback(() => {
    clearSelection()
  }, [clearSelection])

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
        onReconnectStart={onReconnectStart}
        onReconnectEnd={onReconnectEnd}
        onNodeDragStart={onNodeDragStart}
        onSelectionDragStart={onSelectionDragStart}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        defaultEdgeOptions={{ type: 'codeEdge', reconnectable: true }}
        deleteKeyCode="Delete"
        multiSelectionKeyCode="Shift"
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        panOnDrag={[1, 2]}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--color-border)" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(n) => {
            const d = n.data as CustomNodeData
            return KIND_COLORS[d?.kind] ?? '#475569'
          }}
          maskColor="rgba(15,17,23,0.7)"
          style={{ bottom: 56 }}
        />
      </ReactFlow>
    </div>
  )
}
