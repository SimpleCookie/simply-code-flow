import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ExternalLink, Zap } from 'lucide-react'

export interface CfgCallNodeData extends Record<string, unknown> {
  label: string
  callTarget?: string
  isAsync?: boolean
  onJumpTo?: (target: string) => void
}

export const CfgCallNode = memo(function CfgCallNode({ data, selected }: NodeProps) {
  const d = data as CfgCallNodeData
  const accent = d.isAsync ? '#f59e0b' : '#6366f1'

  return (
    <div style={{
      minWidth: 180,
      background: '#10101a',
      border: `1px solid ${selected ? accent : '#334155'}`,
      borderRadius: '6px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '7px 10px',
      boxShadow: selected ? `0 0 0 2px ${accent}44` : '0 2px 8px rgba(0,0,0,0.3)',
      fontFamily: 'ui-monospace, monospace',
      cursor: d.callTarget ? 'pointer' : 'default',
    }}
      onClick={() => d.callTarget && d.onJumpTo?.(d.callTarget)}
    >
      {d.isAsync && <Zap size={11} color="#f59e0b" style={{ flexShrink: 0 }} />}
      <span style={{ fontSize: '12px', color: accent, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {d.label}
      </span>
      {d.callTarget && (
        <ExternalLink size={10} color="#475569" style={{ flexShrink: 0 }} />
      )}

      <Handle type="target" position={Position.Top} id="in"
        style={{ width: 9, height: 9, background: '#475569', border: '2px solid #10101a', top: -5, left: '50%', transform: 'translateX(-50%)' }} />
      <Handle type="source" position={Position.Bottom} id="next"
        style={{ width: 9, height: 9, background: '#475569', border: '2px solid #10101a', bottom: -5, left: '50%', transform: 'translateX(-50%)' }} />
    </div>
  )
})
