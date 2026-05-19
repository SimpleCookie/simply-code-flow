import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ReactFlowProvider } from '@xyflow/react'
import { useFlowStore } from '../../store/flowStore.ts'
import { useUIStore } from '../../store/uiStore.ts'
import { GraphCanvas } from './GraphCanvas.tsx'
import { Toolbar } from './Toolbar.tsx'
import { InspectorPanel } from '../inspector/InspectorPanel.tsx'
import { TodoPanel } from '../todo/TodoPanel.tsx'
import { SnippetModal } from '../snippet/SnippetModal.tsx'
import { NodeCodeOverlay } from './NodeCodeOverlay.tsx'

export function FlowEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const flow = useFlowStore((s) => s.flow)
  const loadFlow = useFlowStore((s) => s.loadFlow)
  const updateFlowMeta = useFlowStore((s) => s.updateFlowMeta)
  const reset = useFlowStore((s) => s.reset)

  const clearSelection = useUIStore((s) => s.clearSelection)
  const undo = useFlowStore((s) => s.undo)
  const redo = useFlowStore((s) => s.redo)

  // Global keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('.monaco-editor') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo() }
      else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  useEffect(() => {
    if (!id) return
    clearSelection()
    loadFlow(id).catch((e: Error) => {
      if ((e as Error & { status?: number }).status === 404) {
        navigate('/flows')
      }
    })
    return () => reset()
  }, [id, loadFlow, reset, navigate, clearSelection])

  if (!flow) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-primary)', color: 'var(--color-text-muted)', fontSize: '14px' }}>
        Loading flow…
      </div>
    )
  }

  return (
    <ReactFlowProvider>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--color-bg-primary)', overflow: 'hidden' }}>
        {/* Toolbar */}
        <Toolbar
          flowId={flow.id}
          flowName={flow.name}
          onNameChange={(name) => updateFlowMeta({ name })}
        />

        {/* Main area */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
          {/* Left: TODO panel */}
          <TodoPanel />

          {/* Center: Graph */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <GraphCanvas />
          </div>

          {/* Right: Inspector */}
          <InspectorPanel />
        </div>

        {/* Snippet modal (portal) */}
        <SnippetModal />

        {/* Code overlay (double-click on node) */}
        <NodeCodeOverlay />
      </div>
    </ReactFlowProvider>
  )
}
