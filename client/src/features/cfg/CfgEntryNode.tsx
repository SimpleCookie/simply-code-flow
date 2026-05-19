import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'

export interface CfgEntryNodeData extends Record<string, unknown> {
  label: string
}

export const CfgEntryNode = memo(function CfgEntryNode({ data }: NodeProps) {
  const d = data as CfgEntryNodeData
  const isEnd = d.label === 'END'
  const color = isEnd ? '#64748b' : '#22c55e'
  const bg = isEnd ? '#0f1923' : '#052e16'

  return (
    <div style={{
      minWidth: 80,
      background: bg,
      border: `2px solid ${color}`,
      borderRadius: '20px',
      padding: '5px 18px',
      textAlign: 'center',
      fontFamily: 'ui-monospace, monospace',
      fontSize: '11px',
      fontWeight: 700,
      color,
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
    }}>
      {d.label}
      {!isEnd && (
        <Handle type="source" position={Position.Bottom} id="next"
          style={{ width: 10, height: 10, background: color, border: '2px solid #052e16', bottom: -6, left: '50%', transform: 'translateX(-50%)' }} />
      )}
      {isEnd && (
        <Handle type="target" position={Position.Top} id="in"
          style={{ width: 10, height: 10, background: color, border: '2px solid #0f1923', top: -6, left: '50%', transform: 'translateX(-50%)' }} />
      )}
    </div>
  )
})
