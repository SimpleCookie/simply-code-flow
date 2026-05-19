import { memo, type ReactElement } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { KIND_COLORS } from '@scf/shared'
import type { NodeKind, NodeStatus } from '@scf/shared'
import { Zap, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { computeComplexity } from '../../lib/cfg/index.ts'

export interface CustomNodeData extends Record<string, unknown> {
  label: string
  kind: NodeKind
  language?: string
  code: string
  filePath?: string
  lineRange?: [number, number]
  notes?: string
  tags: string[]
  status: NodeStatus
  isAsync?: boolean
}

const STATUS_ICONS: Record<NodeStatus, ReactElement> = {
  confirmed: <CheckCircle size={12} color="#22c55e" />,
  suspected: <AlertCircle size={12} color="#f59e0b" />,
  todo: <Clock size={12} color="#ef4444" />,
}

const KIND_LABELS: Record<NodeKind, string> = {
  function: 'fn',
  method: 'method',
  class: 'class',
  endpoint: 'endpoint',
  sql: 'SQL',
  event: 'event',
  'external-api': 'ext-api',
  ui: 'UI',
  job: 'job',
  config: 'config',
  stub: 'stub',
  unknown: '?',
  branch: 'branch',
  loop: 'loop',
}

export const CustomNode = memo(function CustomNode({ data, selected }: NodeProps) {
  const d = data as CustomNodeData
  const color = KIND_COLORS[d.kind] ?? '#475569'
  const isStub = d.kind === 'stub' || !d.code
  const complexity = d.code && !isStub ? computeComplexity(d.code) : 0

  return (
    <div
      style={{
        background: 'var(--color-bg-card)',
        border: `1.5px ${isStub ? 'dashed' : 'solid'} ${selected ? color : 'var(--color-border)'}`,
        borderRadius: '8px',
        padding: '10px 14px',
        minWidth: '180px',
        maxWidth: '220px',
        boxShadow: selected ? `0 0 0 2px ${color}33` : '0 2px 8px rgba(0,0,0,0.3)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        cursor: 'pointer',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: color, border: 'none' }} />

      {/* Top row: kind badge + status + async */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
        <span
          style={{
            background: color + '22',
            color,
            border: `1px solid ${color}44`,
            borderRadius: '4px',
            fontSize: '10px',
            padding: '1px 6px',
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          {KIND_LABELS[d.kind]}
        </span>
        {d.isAsync && (
          <span title="async">
            <Zap size={11} color="#f59e0b" />
          </span>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '5px' }}>
          {complexity > 1 && (
            <span
              title={`Cyclomatic complexity: ${complexity}`}
              style={{
                background: complexity > 10 ? '#ef4444' : complexity > 5 ? '#f59e0b' : '#22c55e',
                color: '#fff', borderRadius: '10px', fontSize: '9px',
                padding: '0 5px', fontWeight: 700, lineHeight: '14px',
                minWidth: '16px', textAlign: 'center',
              }}
            >
              {complexity}
            </span>
          )}
          <span title={d.status}>{STATUS_ICONS[d.status]}</span>
        </span>
      </div>

      {/* Label */}
      <div
        style={{
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--color-text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: 'ui-monospace, monospace',
        }}
        title={d.label}
      >
        {d.label || <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>unlabelled</span>}
      </div>

      {/* File path */}
      {d.filePath && (
        <div
          style={{
            fontSize: '10px',
            color: 'var(--color-text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginTop: '4px',
          }}
          title={d.filePath}
        >
          {d.filePath}
          {d.lineRange && ` :${d.lineRange[0]}–${d.lineRange[1]}`}
        </div>
      )}

      {/* Tags */}
      {d.tags?.length > 0 && (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
          {d.tags.slice(0, 3).map((t) => (
            <span
              key={t}
              style={{
                background: 'var(--color-border)',
                color: 'var(--color-text-muted)',
                borderRadius: '3px',
                fontSize: '9px',
                padding: '1px 5px',
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: color, border: 'none' }} />
    </div>
  )
})
