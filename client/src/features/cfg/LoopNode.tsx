import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { RefreshCw } from 'lucide-react'
import { BRANCH_HANDLE_COLORS } from '@scf/shared'

export interface LoopNodeData extends Record<string, unknown> {
  label: string
  detail?: string
  isAsync?: boolean
}

export const LoopNode = memo(function LoopNode({ data, selected }: NodeProps) {
  const d = data as LoopNodeData
  const accent = BRANCH_HANDLE_COLORS.body  // cyan

  return (
    <div style={{
      minWidth: 200,
      background: '#0f1d21',
      border: `2px solid ${selected ? accent : '#0e7490'}`,
      borderRadius: '8px',
      boxShadow: selected
        ? `0 0 0 2px ${accent}55, 0 8px 24px rgba(0,0,0,0.5)`
        : '0 4px 16px rgba(0,0,0,0.4)',
      fontFamily: 'ui-monospace, monospace',
      overflow: 'visible',
    }}>
      {/* Header */}
      <div style={{
        background: '#0e7490', padding: '4px 10px',
        display: 'flex', alignItems: 'center', gap: '6px',
        borderRadius: '6px 6px 0 0',
      }}>
        <RefreshCw size={12} color="#fff" />
        <span style={{ color: '#fff', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {d.isAsync ? 'ASYNC LOOP' : 'LOOP'}
        </span>
      </div>
      {/* Condition */}
      <div style={{ padding: '8px 10px', fontSize: '11px', color: '#67e8f9', background: '#0c1c20', borderRadius: '0 0 6px 6px' }}>
        {d.label}
      </div>

      {/* Input */}
      <Handle type="target" position={Position.Top} id="in"
        style={{ width: 10, height: 10, background: '#94a3b8', border: '2px solid #1e293b', top: -6, left: '50%', transform: 'translateX(-50%)' }} />

      {/* Body output — right */}
      <Handle type="source" position={Position.Right} id="body"
        style={{ width: 11, height: 11, background: BRANCH_HANDLE_COLORS.body, border: '2px solid #0f1d21', right: -7, top: '38%' }} />
      <span style={{ position: 'absolute', right: 14, top: '29%', fontSize: '9px', color: BRANCH_HANDLE_COLORS.body, fontWeight: 700, letterSpacing: '0.05em' }}>BODY ▶</span>

      {/* Complete output — bottom */}
      <Handle type="source" position={Position.Bottom} id="complete"
        style={{ width: 11, height: 11, background: BRANCH_HANDLE_COLORS.complete, border: '2px solid #0f1d21', bottom: -7, left: '50%', transform: 'translateX(-50%)' }} />
      <span style={{ position: 'absolute', bottom: -18, left: '50%', transform: 'translateX(-50%)', fontSize: '9px', color: BRANCH_HANDLE_COLORS.complete, fontWeight: 700, whiteSpace: 'nowrap' }}>DONE ▶</span>
    </div>
  )
})
