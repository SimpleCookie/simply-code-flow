import { Clock, PlusCircle } from 'lucide-react'
import { useFlowStore } from '../../store/flowStore.ts'
import { useUIStore } from '../../store/uiStore.ts'
import type { CustomNodeData } from '../graph/CustomNode.tsx'

export function TodoPanel() {
  const todoOpen = useUIStore((s) => s.todoOpen)
  const selectNode = useUIStore((s) => s.selectNode)
  const openSnippetModal = useUIStore((s) => s.openSnippetModal)
  const nodes = useFlowStore((s) => s.nodes)

  if (!todoOpen) return null

  const stubs = nodes.filter((n) => {
    const d = n.data as CustomNodeData
    return d.kind === 'stub' || d.status === 'todo' || !d.code
  })

  return (
    <div style={{
      width: '240px', flexShrink: 0,
      background: 'var(--color-bg-secondary)',
      borderRight: '1px solid var(--color-border)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '7px' }}>
        <Clock size={14} color="var(--color-warning)" />
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          TODO / Stubs
        </span>
        <span style={{ marginLeft: 'auto', background: 'var(--color-warning)22', color: 'var(--color-warning)', borderRadius: '10px', fontSize: '11px', padding: '1px 7px', fontWeight: 600 }}>
          {stubs.length}
        </span>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {stubs.length === 0 ? (
          <div style={{ padding: '20px 8px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '12px' }}>
            No stubs or TODOs. Great shape!
          </div>
        ) : (
          stubs.map((n) => {
            const d = n.data as CustomNodeData
            return (
              <div
                key={n.id}
                onClick={() => selectNode(n.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 10px', borderRadius: '6px', cursor: 'pointer',
                  marginBottom: '4px', background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)55')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
              >
                <PlusCircle size={13} color={d.kind === 'stub' ? '#f59e0b' : '#ef4444'} style={{ flexShrink: 0 }} />
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'ui-monospace, monospace' }}>
                    {d.label || '(unlabelled)'}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                    {d.kind} · {d.status}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); openSnippetModal(n.id) }}
                  title="Fill in this stub"
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent)', padding: '2px', flexShrink: 0, display: 'flex' }}
                >
                  <PlusCircle size={13} />
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
