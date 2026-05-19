import { useMemo, useCallback } from 'react'
import { ReactFlow, ReactFlowProvider, Controls, Background, BackgroundVariant, type Node, type Edge } from '@xyflow/react'
import { extractCfg, layoutCfg } from '../../lib/cfg/index.ts'
import type { CfgNode, CfgEdge } from '../../lib/cfg/index.ts'
import { LoopNode } from './LoopNode.tsx'
import { SwitchNode } from './SwitchNode.tsx'
import { TryCatchNode } from './TryCatchNode.tsx'
import { ExitNode } from './ExitNode.tsx'
import { CfgCallNode } from './CfgCallNode.tsx'
import { CfgEntryNode } from './CfgEntryNode.tsx'
import { CfgBlockNode } from './CfgBlockNode.tsx'
import { CfgEdgeRenderer } from './CfgEdgeRenderer.tsx'
import { BRANCH_HANDLE_COLORS } from '@scf/shared'

// Node types registered OUTSIDE component (React Flow requirement)
const nodeTypes = {
  'cfg-entry': CfgEntryNode,
  'cfg-exit': ExitNode,
  'cfg-branch': CfgBlockNode,     // branch structural node (not BranchNode — that's call-graph)
  'cfg-loop': LoopNode,
  'cfg-switch': SwitchNode,
  'cfg-case': CfgBlockNode,
  'cfg-trycatch': TryCatchNode,
  'cfg-block': CfgBlockNode,
  'cfg-call': CfgCallNode,
}

const edgeTypes = {
  'cfg-edge': CfgEdgeRenderer,
}

interface CfgCanvasProps {
  code: string
  language: string
  nodeLabel: string
  onJumpTo?: (callee: string) => void
}

function cfgKindToRfType(kind: CfgNode['kind']): string {
  if (kind === 'entry' || kind === 'exit') return `cfg-${kind}`
  if (kind === 'loop') return 'cfg-loop'
  if (kind === 'switch') return 'cfg-switch'
  if (kind === 'trycatch') return 'cfg-trycatch'
  if (kind === 'call') return 'cfg-call'
  return 'cfg-block'
}

function toRfNode(n: CfgNode & { position: { x: number; y: number }; width: number; height: number }, onJumpTo?: (c: string) => void): Node {
  return {
    id: n.id,
    type: cfgKindToRfType(n.kind),
    position: n.position,
    data: {
      label: n.label,
      detail: n.detail,
      isAsync: n.isAsync,
      isReturn: n.isReturn,
      callTarget: n.callTarget,
      onJumpTo,
    },
    style: { width: n.width },
  }
}

function toRfEdge(e: CfgEdge): Edge {
  const handle = e.handle
  const colorMap: Record<string, string> = {
    true: BRANCH_HANDLE_COLORS.true,
    false: BRANCH_HANDLE_COLORS.false,
    body: BRANCH_HANDLE_COLORS.body,
    complete: BRANCH_HANDLE_COLORS.complete,
    try: BRANCH_HANDLE_COLORS.try,
    catch: BRANCH_HANDLE_COLORS.catch,
    finally: BRANCH_HANDLE_COLORS.finally,
    case: BRANCH_HANDLE_COLORS.case,
    default: BRANCH_HANDLE_COLORS.default,
    next: '#334155',
  }
  const color = colorMap[handle] ?? '#334155'

  return {
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: handle === 'next' ? null : handle,
    type: 'cfg-edge',
    data: { handle },
    label: e.label,
    style: { stroke: color, strokeWidth: 1.5 },
    animated: handle === 'body' || handle === 'try',
  }
}

export function CfgCanvas({ code, language: _language, nodeLabel, onJumpTo }: CfgCanvasProps) {
  const { nodes: rfNodes, edges: rfEdges, complexity, isEmpty } = useMemo(() => {
    if (!code.trim()) return { nodes: [], edges: [], complexity: 1, isEmpty: true }
    try {
      const graph = extractCfg(code)
      // If the graph has only entry + exit (no real structure), it's trivial
      const hasStructure = graph.nodes.some((n) => n.kind !== 'entry' && n.kind !== 'exit')
      if (!hasStructure) return { nodes: [], edges: [], complexity: 1, isEmpty: true }
      const { nodes: laid, edges } = layoutCfg(graph)
      return {
        nodes: laid.map((n) => toRfNode(n, onJumpTo)),
        edges: edges.map(toRfEdge),
        complexity: graph.cyclomaticComplexity,
        isEmpty: false,
      }
    } catch {
      return { nodes: [], edges: [], complexity: 1, isEmpty: true }
    }
  }, [code, onJumpTo])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const target = (node.data as { callTarget?: string }).callTarget
    if (target) onJumpTo?.(target)
  }, [onJumpTo])

  if (isEmpty) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: 'var(--color-text-muted)', gap: '8px',
      }}>
        <span style={{ fontSize: '32px', opacity: 0.3 }}>⛓</span>
        <span style={{ fontSize: '13px' }}>No control-flow structure detected in <code style={{ fontFamily: 'ui-monospace, monospace' }}>{nodeLabel}</code></span>
        <span style={{ fontSize: '11px', opacity: 0.6 }}>Paste code with if/else, loops, switch, or try/catch to see the flow graph.</span>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', background: '#080e14' }}>
      {/* Complexity badge */}
      <div style={{
        position: 'absolute', top: 10, right: 10, zIndex: 10,
        background: complexity > 10 ? '#7f1d1d' : complexity > 5 ? '#1c1507' : '#0f1a0f',
        border: `1px solid ${complexity > 10 ? '#ef4444' : complexity > 5 ? '#f59e0b' : '#22c55e'}`,
        borderRadius: '6px', padding: '4px 10px', fontSize: '11px',
        color: complexity > 10 ? '#ef4444' : complexity > 5 ? '#f59e0b' : '#22c55e',
        fontFamily: 'ui-monospace, monospace', fontWeight: 700,
      }}>
        Complexity: {complexity}{complexity > 10 ? ' ⚠' : ''}
      </div>

      <ReactFlowProvider>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={true}
          colorMode="dark"
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e293b" />
          <Controls showInteractive={false} style={{ background: '#1e293b', border: '1px solid #334155' }} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}
