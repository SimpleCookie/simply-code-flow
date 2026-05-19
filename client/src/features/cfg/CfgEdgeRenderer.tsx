import { memo } from 'react'
import { getBezierPath } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'
import { BRANCH_HANDLE_COLORS } from '@scf/shared'
import type { CfgEdgeHandle } from '../../lib/cfg/index.ts'

const HANDLE_COLORS: Record<CfgEdgeHandle, string> = {
  true: BRANCH_HANDLE_COLORS.true,
  false: BRANCH_HANDLE_COLORS.false,
  body: BRANCH_HANDLE_COLORS.body,
  complete: BRANCH_HANDLE_COLORS.complete,
  try: BRANCH_HANDLE_COLORS.try,
  catch: BRANCH_HANDLE_COLORS.catch,
  finally: BRANCH_HANDLE_COLORS.finally,
  case: BRANCH_HANDLE_COLORS.case,
  default: BRANCH_HANDLE_COLORS.default,
  next: '#334155',
}

export const CfgEdgeRenderer = memo(function CfgEdgeRenderer({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data, label,
}: EdgeProps) {
  const handle = (data as { handle?: CfgEdgeHandle })?.handle ?? 'next'
  const color = HANDLE_COLORS[handle] ?? '#334155'
  const edgeLabel = (label ?? '') as string

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  })

  return (
    <>
      <path id={id} className="react-flow__edge-path" d={edgePath}
        stroke={color} strokeWidth={1.5} fill="none" strokeOpacity={0.8} />
      {edgeLabel && (
        <foreignObject x={labelX - 20} y={labelY - 9} width={40} height={18} overflow="visible">
          <div style={{
            background: '#0f172a', border: `1px solid ${color}55`,
            borderRadius: '3px', fontSize: '9px', color,
            fontWeight: 700, textAlign: 'center', padding: '1px 3px',
            fontFamily: 'ui-monospace, monospace', whiteSpace: 'nowrap',
          }}>
            {edgeLabel}
          </div>
        </foreignObject>
      )}
    </>
  )
})
