import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'

export interface ExitNodeData extends Record<string, unknown> {
  label: string
  isReturn?: boolean
  detail?: string
}

export const ExitNode = memo(function ExitNode({ data, selected }: NodeProps) {
  const d = data as ExitNodeData
  const isReturn = d.isReturn !== false
  const color = isReturn ? '#22c55e' : '#ef4444'
  const bg = isReturn ? '#052e16' : '#2d0a0a'
  const borderColor = selected ? color : (isReturn ? '#15803d' : '#991b1b')
  const keyword = d.label.match(/^(return|throw|break|continue)/)?.[1] ?? 'exit'

  return (
    <div style={{
      minWidth: 160,
      maxWidth: 240,
      background: bg,
      border: `2px solid ${borderColor}`,
      borderRadius: '20px',
      padding: '6px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      boxShadow: selected ? `0 0 0 2px ${color}44` : '0 2px 8px rgba(0,0,0,0.4)',
      fontFamily: 'ui-monospace, monospace',
    }}>
      <span style={{
        background: color + '33', color, border: `1px solid ${color}55`,
        borderRadius: '4px', fontSize: '9px', padding: '1px 6px', fontWeight: 700,
        textTransform: 'uppercase', flexShrink: 0,
      }}>
        {keyword}
      </span>
      <span style={{ fontSize: '11px', color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {d.label.slice(keyword.length).trim() || ''}
      </span>

      <Handle type="target" position={Position.Top} id="in"
        style={{ width: 10, height: 10, background: color, border: '2px solid #1e293b', top: -6, left: '50%', transform: 'translateX(-50%)' }} />
    </div>
  )
})
