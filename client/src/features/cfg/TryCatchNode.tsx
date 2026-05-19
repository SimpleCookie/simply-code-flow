import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Shield } from 'lucide-react'
import { BRANCH_HANDLE_COLORS } from '@scf/shared'

export interface TryCatchNodeData extends Record<string, unknown> {
  label: string
}

export const TryCatchNode = memo(function TryCatchNode({ data, selected }: NodeProps) {
  const d = data as TryCatchNodeData
  const accent = BRANCH_HANDLE_COLORS.try   // indigo

  return (
    <div style={{
      minWidth: 200,
      background: '#0f0f1a',
      border: `2px solid ${selected ? accent : '#4338ca'}`,
      borderRadius: '8px',
      boxShadow: selected
        ? `0 0 0 2px ${accent}55, 0 8px 24px rgba(0,0,0,0.5)`
        : '0 4px 16px rgba(0,0,0,0.4)',
      fontFamily: 'ui-monospace, monospace',
    }}>
      <div style={{
        background: '#4338ca', padding: '4px 10px',
        display: 'flex', alignItems: 'center', gap: '6px',
        borderRadius: '6px 6px 0 0',
      }}>
        <Shield size={12} color="#fff" />
        <span style={{ color: '#fff', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>TRY / CATCH</span>
      </div>
      <div style={{ padding: '8px 10px', fontSize: '11px', color: '#a5b4fc', background: '#0b0b16', borderRadius: '0 0 6px 6px' }}>
        {d.label}
      </div>

      <Handle type="target" position={Position.Top} id="in"
        style={{ width: 10, height: 10, background: '#94a3b8', border: '2px solid #0f0f1a', top: -6, left: '50%', transform: 'translateX(-50%)' }} />

      <Handle type="source" position={Position.Right} id="try"
        style={{ width: 11, height: 11, background: BRANCH_HANDLE_COLORS.try, border: '2px solid #0f0f1a', right: -7, top: '30%' }} />
      <span style={{ position: 'absolute', right: 14, top: '22%', fontSize: '9px', color: BRANCH_HANDLE_COLORS.try, fontWeight: 700 }}>TRY ▶</span>

      <Handle type="source" position={Position.Right} id="catch"
        style={{ width: 11, height: 11, background: BRANCH_HANDLE_COLORS.catch, border: '2px solid #0f0f1a', right: -7, top: '60%' }} />
      <span style={{ position: 'absolute', right: 14, top: '52%', fontSize: '9px', color: BRANCH_HANDLE_COLORS.catch, fontWeight: 700 }}>CATCH ▶</span>

      <Handle type="source" position={Position.Right} id="finally"
        style={{ width: 11, height: 11, background: BRANCH_HANDLE_COLORS.finally, border: '2px solid #0f0f1a', right: -7, top: '85%' }} />
      <span style={{ position: 'absolute', right: 14, top: '77%', fontSize: '9px', color: BRANCH_HANDLE_COLORS.finally, fontWeight: 700 }}>FINALLY ▶</span>
    </div>
  )
})
