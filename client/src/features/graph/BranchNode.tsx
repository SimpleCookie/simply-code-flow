import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { GitBranch } from 'lucide-react'
import { BRANCH_HANDLE_COLORS } from '@scf/shared'

export interface BranchNodeData extends Record<string, unknown> {
  label: string      // condition expression e.g. "user.age >= 18"
  notes?: string
  status?: string
}

/**
 * Blueprint-style branch node (inspired by Unreal Engine 5).
 * Has one input handle (left), and two output handles: True (top-right, green)
 * and False (bottom-right, red).
 */
export const BranchNode = memo(function BranchNode({ data, selected }: NodeProps) {
  const d = data as BranchNodeData
  const borderColor = selected ? BRANCH_HANDLE_COLORS.true : '#f59e0b'

  return (
    <div
      style={{
        minWidth: 220,
        background: '#1a1814',
        border: `2px solid ${borderColor}`,
        borderRadius: '8px',
        boxShadow: selected
          ? `0 0 0 2px ${BRANCH_HANDLE_COLORS.true}55, 0 8px 24px rgba(0,0,0,0.5)`
          : '0 4px 16px rgba(0,0,0,0.4)',
        overflow: 'visible',
        position: 'relative',
        fontFamily: 'ui-monospace, monospace',
      }}
    >
      {/* Input handle (left) */}
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        style={{
          width: 12,
          height: 12,
          background: '#94a3b8',
          border: '2px solid #1e293b',
          borderRadius: '50%',
          left: -7,
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      />

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          padding: '8px 14px 6px',
          borderBottom: '1px solid #2d2a20',
          background: '#221f14',
          borderRadius: '6px 6px 0 0',
        }}
      >
        <GitBranch size={13} color="#f59e0b" />
        <span style={{ fontSize: '10px', fontWeight: 700, color: '#f59e0b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Branch
        </span>
      </div>

      {/* Condition body */}
      <div style={{ padding: '10px 14px 12px' }}>
        <div
          style={{
            fontSize: '13px',
            color: '#e2e8f0',
            background: '#0f0e0c',
            border: '1px solid #2d2a20',
            borderRadius: '5px',
            padding: '6px 10px',
            lineHeight: 1.4,
            wordBreak: 'break-all',
          }}
        >
          {d.label || 'condition'}
        </div>
        {d.notes && (
          <div style={{ marginTop: '6px', fontSize: '11px', color: '#64748b', fontFamily: 'sans-serif' }}>
            {d.notes}
          </div>
        )}
      </div>

      {/* True output handle (top-right) */}
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        style={{
          width: 14,
          height: 14,
          background: BRANCH_HANDLE_COLORS.true,
          border: '2px solid #1e293b',
          borderRadius: '50%',
          right: -8,
          top: '35%',
          transform: 'translateY(-50%)',
        }}
      >
        <span
          style={{
            position: 'absolute',
            right: 18,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '9px',
            fontWeight: 700,
            color: BRANCH_HANDLE_COLORS.true,
            letterSpacing: '0.05em',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          TRUE ▶
        </span>
      </Handle>

      {/* False output handle (bottom-right) */}
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        style={{
          width: 14,
          height: 14,
          background: BRANCH_HANDLE_COLORS.false,
          border: '2px solid #1e293b',
          borderRadius: '50%',
          right: -8,
          top: '65%',
          transform: 'translateY(-50%)',
        }}
      >
        <span
          style={{
            position: 'absolute',
            right: 18,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '9px',
            fontWeight: 700,
            color: BRANCH_HANDLE_COLORS.false,
            letterSpacing: '0.05em',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          FALSE ▶
        </span>
      </Handle>
    </div>
  )
})
