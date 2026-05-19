import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'

export interface CfgBlockNodeData extends Record<string, unknown> {
  label: string
}

/** Thin connector / join node — rendered as a small diamond-shaped dot. */
export const CfgBlockNode = memo(function CfgBlockNode({ data }: NodeProps) {
  const d = data as CfgBlockNodeData
  // Hide purely structural join/block nodes — just show a small dot
  const isJoin = d.label.startsWith('(')

  if (isJoin) {
    return (
      <div style={{
        width: 10, height: 10,
        background: '#334155',
        borderRadius: '50%',
        border: '2px solid #475569',
      }}>
        <Handle type="target" position={Position.Top} id="in"
          style={{ width: 6, height: 6, background: '#475569', border: 'none', top: -4, left: '50%', transform: 'translateX(-50%)' }} />
        <Handle type="source" position={Position.Bottom} id="next"
          style={{ width: 6, height: 6, background: '#475569', border: 'none', bottom: -4, left: '50%', transform: 'translateX(-50%)' }} />
      </div>
    )
  }

  return (
    <div style={{
      minWidth: 140,
      background: '#111827',
      border: '1px solid #1e293b',
      borderRadius: '4px',
      padding: '5px 10px',
      fontFamily: 'ui-monospace, monospace',
      fontSize: '11px',
      color: '#64748b',
      fontStyle: 'italic',
    }}>
      {d.label}
      <Handle type="target" position={Position.Top} id="in"
        style={{ width: 8, height: 8, background: '#334155', border: 'none', top: -5, left: '50%', transform: 'translateX(-50%)' }} />
      <Handle type="source" position={Position.Bottom} id="next"
        style={{ width: 8, height: 8, background: '#334155', border: 'none', bottom: -5, left: '50%', transform: 'translateX(-50%)' }} />
    </div>
  )
})
