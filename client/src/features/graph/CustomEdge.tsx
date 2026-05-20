import { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react'
import { EDGE_KIND_COLORS, BRANCH_HANDLE_COLORS } from '@scf/shared'
import type { EdgeKind } from '@scf/shared'

export interface CustomEdgeData extends Record<string, unknown> {
  kind: EdgeKind
  label?: string
  condition?: string
  confidence: 'confirmed' | 'suspected'
  notes?: string
  callOrder?: number
  callLine?: number
}

export const CustomEdge = memo(function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
  sourceHandleId,
}: EdgeProps) {
  const d = (data ?? {}) as CustomEdgeData

  // Handle-specific override: true=green, false=red
  let color = EDGE_KIND_COLORS[d.kind ?? 'unknown'] ?? '#475569'
  let handleBadge: string | null = null
  if (sourceHandleId === 'true') { color = BRANCH_HANDLE_COLORS.true; handleBadge = 'T' }
  else if (sourceHandleId === 'false') { color = BRANCH_HANDLE_COLORS.false; handleBadge = 'F' }
  else if (sourceHandleId === 'body') { color = BRANCH_HANDLE_COLORS.body; handleBadge = '↻' }
  else if (sourceHandleId === 'complete') { color = BRANCH_HANDLE_COLORS.complete; handleBadge = '✓' }

  const displayLabel = handleBadge ?? d.condition ?? d.label ?? d.kind ?? 'unknown'

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  })

  // Place order badge ~15% along the edge (30% toward midpoint from source)
  const badgeX = sourceX + (labelX - sourceX) * 0.3
  const badgeY = sourceY + (labelY - sourceY) * 0.3

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: color,
          strokeWidth: selected ? 2.5 : 1.5,
          strokeDasharray: d.confidence === 'suspected' ? '6 3' : undefined,
          opacity: selected ? 1 : 0.75,
        }}
      />
      {displayLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              background: 'var(--color-bg-secondary)',
              border: `1px solid ${color}55`,
              color,
              borderRadius: '4px',
              fontSize: '10px',
              padding: '1px 6px',
              fontWeight: handleBadge ? 700 : 500,
              maxWidth: '120px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
            className="nodrag nopan"
          >
            {displayLabel}
          </div>
        </EdgeLabelRenderer>
      )}
      {d.callOrder != null && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${badgeX}px,${badgeY}px)`,
              pointerEvents: 'none',
              width: 17,
              height: 17,
              borderRadius: '50%',
              background: '#0f172a',
              border: '1px solid #475569',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '9px',
              fontFamily: 'ui-monospace, monospace',
              fontWeight: 700,
            }}
            title={`Call #${d.callOrder}${d.callLine != null ? ` · line ${d.callLine}` : ''}`}
          >
            {d.callOrder}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
})
