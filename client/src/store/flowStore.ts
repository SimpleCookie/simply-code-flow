import { create } from 'zustand';
import type { Node, Edge } from '@xyflow/react';
import type { Flow, FlowNode, FlowEdge } from '@scf/shared';
import { api } from '../lib/api.ts';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

interface FlowStore {
  flow: Flow | null;
  nodes: Node[];
  edges: Edge[];
  saveStatus: SaveStatus;
  saveError: string | null;
  _saveTimer: ReturnType<typeof setTimeout> | null;

  loadFlow: (id: string) => Promise<void>;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: FlowNode) => void;
  updateNode: (id: string, patch: Partial<FlowNode>) => void;
  deleteNode: (id: string) => void;
  addEdge: (edge: FlowEdge) => void;
  updateEdge: (id: string, patch: Partial<FlowEdge>) => void;
  deleteEdge: (id: string) => void;
  updateFlowMeta: (patch: Partial<Pick<Flow, 'name' | 'description' | 'tags'>>) => void;
  save: () => Promise<void>;
  scheduleSave: () => void;
  reset: () => void;
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
  };
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
  };
}

function fromRfNode(n: Node): FlowNode {
  const d = n.data as Record<string, unknown>;
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
  };
}

function fromRfEdge(e: Edge): FlowEdge {
  const d = (e.data ?? {}) as Record<string, unknown>;
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    kind: d.kind as FlowEdge['kind'],
    label: d.label as string | undefined,
    condition: d.condition as string | undefined,
    confidence: (d.confidence as FlowEdge['confidence']) ?? 'suspected',
    notes: d.notes as string | undefined,
  };
}

export const useFlowStore = create<FlowStore>((set, get) => ({
  flow: null,
  nodes: [],
  edges: [],
  saveStatus: 'idle',
  saveError: null,
  _saveTimer: null,

  async loadFlow(id) {
    const flow = await api.getFlow(id);
    set({
      flow,
      nodes: flow.nodes.map(toRfNode),
      edges: flow.edges.map(toRfEdge),
      saveStatus: 'idle',
      saveError: null,
    });
  },

  setNodes(nodes) {
    set({ nodes });
    get().scheduleSave();
  },

  setEdges(edges) {
    set({ edges });
    get().scheduleSave();
  },

  addNode(node) {
    set((s) => ({ nodes: [...s.nodes, toRfNode(node)] }));
    get().scheduleSave();
  },

  updateNode(id, patch) {
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...patch } } : n,
      ),
    }));
    get().scheduleSave();
  },

  deleteNode(id) {
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
    }));
    get().scheduleSave();
  },

  addEdge(edge) {
    set((s) => ({ edges: [...s.edges, toRfEdge(edge)] }));
    get().scheduleSave();
  },

  updateEdge(id, patch) {
    set((s) => ({
      edges: s.edges.map((e) =>
        e.id === id ? { ...e, data: { ...e.data, ...patch } } : e,
      ),
    }));
    get().scheduleSave();
  },

  deleteEdge(id) {
    set((s) => ({ edges: s.edges.filter((e) => e.id !== id) }));
    get().scheduleSave();
  },

  updateFlowMeta(patch) {
    set((s) => (s.flow ? { flow: { ...s.flow, ...patch } } : {}));
    get().scheduleSave();
  },

  async save() {
    const { flow, nodes, edges } = get();
    if (!flow) return;
    set({ saveStatus: 'saving', saveError: null });
    const updated: Flow = {
      ...flow,
      nodes: nodes.map(fromRfNode),
      edges: edges.map(fromRfEdge),
    };
    try {
      const saved = await api.updateFlow(flow.id, updated);
      set({ flow: saved, saveStatus: 'saved' });
      setTimeout(() => set((s) => (s.saveStatus === 'saved' ? { saveStatus: 'idle' } : {})), 2000);
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 409) {
        set({ saveStatus: 'conflict', saveError: err.message });
      } else {
        set({ saveStatus: 'error', saveError: err.message });
      }
    }
  },

  scheduleSave() {
    const { _saveTimer } = get();
    if (_saveTimer) clearTimeout(_saveTimer);
    const timer = setTimeout(() => get().save(), 1500);
    set({ _saveTimer: timer });
  },

  reset() {
    const { _saveTimer } = get();
    if (_saveTimer) clearTimeout(_saveTimer);
    set({ flow: null, nodes: [], edges: [], saveStatus: 'idle', saveError: null, _saveTimer: null });
  },
}));
