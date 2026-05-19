import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { Node, Edge } from '@xyflow/react'
import type { Flow, FlowNode, FlowEdge } from '@scf/shared'
import { api } from '../lib/api.ts'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict'

type HistorySnapshot = { nodes: Node[]; edges: Edge[]; flow: Flow | null }

interface FlowStore {
  flow: Flow | null
  nodes: Node[]
  edges: Edge[]
  past: HistorySnapshot[]
  future: HistorySnapshot[]
  saveStatus: SaveStatus
  saveError: string | null
  _saveTimer: ReturnType<typeof setTimeout> | null

  loadFlow: (id: string) => Promise<void>
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  /** Capture current state into undo history. Call before any semantic mutation. */
  pushHistory: () => void
  undo: () => void
  redo: () => void
  addNode: (node: FlowNode) => void
  updateNode: (id: string, patch: Partial<FlowNode>) => void
  deleteNode: (id: string) => void
  /** Validates no self-loops / exact duplicates; pushes history on success. */
  addEdge: (edge: FlowEdge) => void
  updateEdge: (id: string, patch: Partial<FlowEdge>) => void
  deleteEdge: (id: string) => void
  reconnectEdge: (edgeId: string, newSource: string, newTarget: string) => void
  swapEdgeDirection: (edgeId: string) => void
  /** Additive: creates stub nodes + edges for calleeNames not yet in graph. No history push. */
  expandNodeCallees: (nodeId: string, calleeNames: string[]) => void
  /** One atomic commit for the code overlay: pushes history, updates node fields, expands callees. */
  commitOverlay: (nodeId: string, patch: Partial<FlowNode>, calleeNames: string[]) => void
  /** One atomic commit for SnippetModal: pushes history, adds node, optional parent edge, expands callees. */
  commitSnippet: (node: FlowNode, parentId: string | null, calleeNames: string[]) => void
  updateFlowMeta: (patch: Partial<Pick<Flow, 'name' | 'description' | 'tags'>>) => void
  save: () => Promise<void>
  scheduleSave: () => void
  reset: () => void
}

function toRfNode(n: FlowNode): Node {
  return {
    id: n.id,
    type: 'codeNode',
    position: n.position,
    data: {
      label: n.label,
      kind: n.kind,
      language: n.language,
      code: n.code,
      filePath: n.filePath,
      lineRange: n.lineRange,
      notes: n.notes,
      tags: n.tags,
      status: n.status,
      isAsync: n.isAsync,
      contentHash: n.contentHash,
    },
  }
}

function toRfEdge(e: FlowEdge): Edge {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    type: 'codeEdge',
    label: e.label,
    data: {
      kind: e.kind,
      label: e.label,
      condition: e.condition,
      confidence: e.confidence,
      notes: e.notes,
    },
  }
}

function fromRfNode(n: Node): FlowNode {
  const d = n.data as Record<string, unknown>
  return {
    id: n.id,
    label: d.label as string,
    kind: d.kind as FlowNode['kind'],
    language: d.language as string | undefined,
    code: d.code as string,
    filePath: d.filePath as string | undefined,
    lineRange: d.lineRange as [number, number] | undefined,
    notes: d.notes as string | undefined,
    tags: d.tags as string[],
    status: d.status as FlowNode['status'],
    isAsync: d.isAsync as boolean | undefined,
    contentHash: d.contentHash as string | undefined,
    position: n.position,
  }
}

function fromRfEdge(e: Edge): FlowEdge {
  const d = (e.data ?? {}) as Record<string, unknown>
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    kind: d.kind as FlowEdge['kind'],
    label: d.label as string | undefined,
    condition: d.condition as string | undefined,
    confidence: (d.confidence as FlowEdge['confidence']) ?? 'suspected',
    notes: d.notes as string | undefined,
  }
}

export const useFlowStore = create<FlowStore>((set, get) => ({
  flow: null,
  nodes: [],
  edges: [],
  past: [],
  future: [],
  saveStatus: 'idle',
  saveError: null,
  _saveTimer: null,

  async loadFlow(id) {
    const flow = await api.getFlow(id)
    set({
      flow,
      nodes: flow.nodes.map(toRfNode),
      edges: flow.edges.map(toRfEdge),
      past: [],
      future: [],
      saveStatus: 'idle',
      saveError: null,
    })
  },

  setNodes(nodes) {
    set({ nodes })
    get().scheduleSave()
  },

  setEdges(edges) {
    set({ edges })
    get().scheduleSave()
  },

  pushHistory() {
    const { nodes, edges, flow } = get()
    set((s) => ({
      past: [...s.past.slice(-49), { nodes, edges, flow }],
      future: [],
    }))
  },

  undo() {
    const { past, nodes, edges, flow, future } = get()
    if (!past.length) return
    const prev = past[past.length - 1]
    set({
      past: past.slice(0, -1),
      future: [{ nodes, edges, flow }, ...future.slice(0, 49)],
      nodes: prev.nodes,
      edges: prev.edges,
      flow: prev.flow,
    })
    get().scheduleSave()
  },

  redo() {
    const { past, nodes, edges, flow, future } = get()
    if (!future.length) return
    const next = future[0]
    set({
      past: [...past.slice(-49), { nodes, edges, flow }],
      future: future.slice(1),
      nodes: next.nodes,
      edges: next.edges,
      flow: next.flow,
    })
    get().scheduleSave()
  },

  addNode(node) {
    get().pushHistory()
    set((s) => ({ nodes: [...s.nodes, toRfNode(node)] }))
    get().scheduleSave()
  },

  updateNode(id, patch) {
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...patch } } : n,
      ),
    }))
    get().scheduleSave()
  },

  deleteNode(id) {
    get().pushHistory()
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
    }))
    get().scheduleSave()
  },

  addEdge(edge) {
    const { edges } = get()
    if (edge.source === edge.target) return
    const isDup = edges.some(
      (e) =>
        e.source === edge.source &&
        e.target === edge.target &&
        (e.data as { kind?: string })?.kind === edge.kind,
    )
    if (isDup) return
    get().pushHistory()
    set((s) => ({ edges: [...s.edges, toRfEdge(edge)] }))
    get().scheduleSave()
  },

  updateEdge(id, patch) {
    set((s) => ({
      edges: s.edges.map((e) =>
        e.id === id ? { ...e, data: { ...e.data, ...patch } } : e,
      ),
    }))
    get().scheduleSave()
  },

  deleteEdge(id) {
    get().pushHistory()
    set((s) => ({ edges: s.edges.filter((e) => e.id !== id) }))
    get().scheduleSave()
  },

  reconnectEdge(edgeId, newSource, newTarget) {
    if (newSource === newTarget) return
    get().pushHistory()
    set((s) => ({
      edges: s.edges.map((e) =>
        e.id === edgeId ? { ...e, source: newSource, target: newTarget } : e,
      ),
    }))
    get().scheduleSave()
  },

  swapEdgeDirection(edgeId) {
    get().pushHistory()
    set((s) => ({
      edges: s.edges.map((e) =>
        e.id === edgeId ? { ...e, source: e.target, target: e.source } : e,
      ),
    }))
    get().scheduleSave()
  },

  expandNodeCallees(nodeId, calleeNames) {
    if (!calleeNames.length) return
    const { nodes, edges } = get()
    const parentNode = nodes.find((n) => n.id === nodeId)
    if (!parentNode) return

    const newNodes: Node[] = []
    const newEdges: Edge[] = []

    calleeNames.forEach((name, i) => {
      const existing = nodes.find(
        (n) => (n.data as { label?: string }).label === name,
      )
      const targetId = existing?.id ?? nanoid()

      if (!existing) {
        newNodes.push(
          toRfNode({
            id: targetId,
            label: name,
            kind: 'stub',
            code: '',
            tags: [],
            status: 'todo',
            position: {
              x: parentNode.position.x + (i - calleeNames.length / 2) * 260,
              y: parentNode.position.y + 200,
            },
          }),
        )
      }

      const edgeExists =
        edges.some((e) => e.source === nodeId && e.target === targetId) ||
        newEdges.some((e) => e.source === nodeId && e.target === targetId)
      if (!edgeExists) {
        newEdges.push(
          toRfEdge({
            id: nanoid(),
            source: nodeId,
            target: targetId,
            kind: 'calls',
            confidence: 'suspected',
          }),
        )
      }
    })

    if (newNodes.length || newEdges.length) {
      set((s) => ({
        nodes: [...s.nodes, ...newNodes],
        edges: [...s.edges, ...newEdges],
      }))
      get().scheduleSave()
    }
  },

  commitOverlay(nodeId, patch, calleeNames) {
    get().pushHistory()
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n,
      ),
    }))
    get().expandNodeCallees(nodeId, calleeNames)
    get().scheduleSave()
  },

  commitSnippet(node, parentId, calleeNames) {
    const { edges } = get()
    get().pushHistory()
    set((s) => ({ nodes: [...s.nodes, toRfNode(node)] }))
    if (parentId) {
      const isDup = edges.some(
        (e) => e.source === parentId && e.target === node.id,
      )
      if (!isDup) {
        set((s) => ({
          edges: [
            ...s.edges,
            toRfEdge({
              id: nanoid(),
              source: parentId,
              target: node.id,
              kind: 'calls',
              confidence: 'suspected',
            }),
          ],
        }))
      }
    }
    get().expandNodeCallees(node.id, calleeNames)
    get().scheduleSave()
  },

  updateFlowMeta(patch) {
    set((s) => (s.flow ? { flow: { ...s.flow, ...patch } } : {}))
    get().scheduleSave()
  },

  async save() {
    const { flow, nodes, edges } = get()
    if (!flow) return
    set({ saveStatus: 'saving', saveError: null })
    const updated: Flow = {
      ...flow,
      nodes: nodes.map(fromRfNode),
      edges: edges.map(fromRfEdge),
    }
    try {
      const saved = await api.updateFlow(flow.id, updated)
      set({ flow: saved, saveStatus: 'saved' })
      setTimeout(() => set((s) => (s.saveStatus === 'saved' ? { saveStatus: 'idle' } : {})), 2000)
    } catch (e) {
      const err = e as Error & { status?: number }
      if (err.status === 409) {
        set({ saveStatus: 'conflict', saveError: err.message })
      } else {
        set({ saveStatus: 'error', saveError: err.message })
      }
    }
  },

  scheduleSave() {
    const { _saveTimer } = get()
    if (_saveTimer) clearTimeout(_saveTimer)
    const timer = setTimeout(() => get().save(), 1500)
    set({ _saveTimer: timer })
  },

  reset() {
    const { _saveTimer } = get()
    if (_saveTimer) clearTimeout(_saveTimer)
    set({
      flow: null,
      nodes: [],
      edges: [],
      past: [],
      future: [],
      saveStatus: 'idle',
      saveError: null,
      _saveTimer: null,
    })
  },
}))
