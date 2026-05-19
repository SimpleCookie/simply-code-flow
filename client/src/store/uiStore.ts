import { create } from 'zustand'

interface UIStore {
  selectedNodeId: string | null
  selectedEdgeId: string | null
  inspectorOpen: boolean
  todoOpen: boolean
  snippetModalOpen: boolean
  snippetModalParentId: string | null
  codeOverlayNodeId: string | null

  selectNode: (id: string | null) => void
  selectEdge: (id: string | null) => void
  clearSelection: () => void
  setInspectorOpen: (open: boolean) => void
  setTodoOpen: (open: boolean) => void
  openSnippetModal: (parentId?: string) => void
  closeSnippetModal: () => void
  openCodeOverlay: (nodeId: string) => void
  closeCodeOverlay: () => void
}

export const useUIStore = create<UIStore>((set) => ({
  selectedNodeId: null,
  selectedEdgeId: null,
  inspectorOpen: false,
  todoOpen: false,
  snippetModalOpen: false,
  snippetModalParentId: null,
  codeOverlayNodeId: null,

  selectNode: (id) => set({ selectedNodeId: id, selectedEdgeId: null, inspectorOpen: id !== null }),
  selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null, inspectorOpen: id !== null }),
  clearSelection: () => set({ selectedNodeId: null, selectedEdgeId: null, inspectorOpen: false }),
  setInspectorOpen: (open) => set({ inspectorOpen: open }),
  setTodoOpen: (open) => set({ todoOpen: open }),
  openSnippetModal: (parentId) =>
    set({ snippetModalOpen: true, snippetModalParentId: parentId ?? null }),
  closeSnippetModal: () => set({ snippetModalOpen: false, snippetModalParentId: null }),
  openCodeOverlay: (nodeId) => set({ codeOverlayNodeId: nodeId }),
  closeCodeOverlay: () => set({ codeOverlayNodeId: null }),
}))
