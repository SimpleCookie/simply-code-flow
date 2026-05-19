import { useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
  type OnNodesChange,
  type OnEdgesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nanoid } from 'nanoid';
import { CustomNode } from './CustomNode.tsx';
import { CustomEdge } from './CustomEdge.tsx';
import { useFlowStore } from '../../store/flowStore.ts';
import { useUIStore } from '../../store/uiStore.ts';
import { KIND_COLORS } from '@scf/shared';
import type { CustomNodeData } from './CustomNode.tsx';

// Defined outside component to avoid React Flow re-registration warnings
const nodeTypes: NodeTypes = { codeNode: CustomNode };
const edgeTypes: EdgeTypes = { codeEdge: CustomEdge };

export function GraphCanvas() {
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const setNodes = useFlowStore((s) => s.setNodes);
  const setEdges = useFlowStore((s) => s.setEdges);
  const addEdgeToStore = useFlowStore((s) => s.addEdge);

  const selectNode = useUIStore((s) => s.selectNode);
  const selectEdge = useUIStore((s) => s.selectEdge);
  const clearSelection = useUIStore((s) => s.clearSelection);

  const containerRef = useRef<HTMLDivElement>(null);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      // Imperatively apply changes while keeping store in sync
      import('@xyflow/react').then(({ applyNodeChanges }) => {
        setNodes(applyNodeChanges(changes, nodes));
      });
    },
    [nodes, setNodes],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      import('@xyflow/react').then(({ applyEdgeChanges }) => {
        setEdges(applyEdgeChanges(changes, edges));
      });
    },
    [edges, setEdges],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge = {
        id: nanoid(),
        source: connection.source,
        target: connection.target,
        kind: 'calls' as const,
        confidence: 'suspected' as const,
      };
      addEdgeToStore(newEdge);
      setEdges(addEdge({ ...connection, id: newEdge.id, type: 'codeEdge' }, edges));
    },
    [edges, setEdges, addEdgeToStore],
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      selectNode(node.id);
    },
    [selectNode],
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: { id: string }) => {
      selectEdge(edge.id);
    },
    [selectEdge],
  );

  const onPaneClick = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        defaultEdgeOptions={{ type: 'codeEdge' }}
        deleteKeyCode="Delete"
        multiSelectionKeyCode="Shift"
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--color-border)" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(n) => {
            const d = n.data as CustomNodeData;
            return KIND_COLORS[d?.kind] ?? '#475569';
          }}
          maskColor="rgba(15,17,23,0.7)"
          style={{ bottom: 56 }}
        />
      </ReactFlow>
    </div>
  );
}
