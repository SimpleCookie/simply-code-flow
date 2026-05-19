import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { GitBranch } from 'lucide-react'
import { BRANCH_HANDLE_COLORS } from '@scf/shared'

export interface SwitchNodeData extends Record<string, unknown> {
  label: string
  detail?: string
  cases?: string[]
}

export const SwitchNode = memo(function SwitchNode({ data, selected }: NodeProps) {
  const d = data as SwitchNodeData
  const accent = BRANCH_HANDLE_COLORS.case  // amber

  return (
    <div style={{
      minWidth: 200,
      background: '#1c1507',
      border: `2px solid ${selected ? accent : '#b45309'}`,
      borderRadius: '8px',
      boxShadow: selected
        ? `0 0 0 2px ${accent}55, 0 8px 24px rgba(0,0,0,0.5)`
        : '0 4px 16px rgba(0,0,0,0.4)',
      fontFamily: 'ui-monospace, monospace',
    }}>
      <div style={{
        background: '#b45309', padding: '4px 10px',
        display: 'flex', alignItems: 'center', gap: '6px',
        borderRadius: '6px 6px 0 0',
      }}>
        <GitBranch size={12} color="#fff" />
        <span style={{ color: '#fff', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>SWITCH</span>
      </div>
      <div style={{ padding: '8px 10px', fontSize: '11px', color: '#fcd34d', background: '#170f02', borderRadius: '0 0 6px 6px' }}>
        {d.label}
      </div>

      <Handle type="target" position={Position.Top} id="in"
        style={{ width: 10, height: 10, background: '#94a3b8', border: '2px solid #1c1507', top: -6, left: '50%', transform: 'translateX(-50%)' }} />

      {/* Multiple case outputs on the right; rendered at even vertical intervals */}
      <Handle type="source" position={Position.Right} id="case"
        style={{ width: 11, height: 11, background: BRANCH_HANDLE_COLORS.case, border: '2px solid #1c1507', right: -7, top: '40%' }} />
      <span style={{ position: 'absolute', right: 14, top: '32%', fontSize: '9px', color: BRANCH_HANDLE_COLORS.case, fontWeight: 700 }}>CASE ▶</span>

      <Handle type="source" position={Position.Right} id="default"
        style={{ width: 11, height: 11, background: BRANCH_HANDLE_COLORS.default, border: '2px solid #1c1507', right: -7, top: '65%' }} />
      <span style={{ position: 'absolute', right: 14, top: '57%', fontSize: '9px', color: BRANCH_HANDLE_COLORS.default, fontWeight: 700 }}>DEFAULT ▶</span>
    </div>
  )
})
