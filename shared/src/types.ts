export type NodeKind =
  | 'function'
  | 'method'
  | 'class'
  | 'endpoint'
  | 'sql'
  | 'event'
  | 'external-api'
  | 'ui'
  | 'job'
  | 'config'
  | 'stub'
  | 'branch'
  | 'loop'
  | 'unknown'

export type EdgeKind =
  | 'calls'
  | 'async-calls'
  | 'emits'
  | 'listens'
  | 'reads'
  | 'writes'
  | 'http'
  | 'renders'
  | 'inherits'
  | 'branches'
  | 'unknown'

export type NodeStatus = 'confirmed' | 'suspected' | 'todo'
export type EdgeConfidence = 'confirmed' | 'suspected'

export interface FlowNode {
  id: string
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
  position: { x: number; y: number }
  contentHash?: string
}

export interface FlowEdge {
  id: string
  source: string
  target: string
  kind: EdgeKind
  label?: string
  condition?: string
  confidence: EdgeConfidence
  notes?: string
  sourceHandle?: string
  targetHandle?: string
  /** 1-based order of this call within the source function body (extraction-only; undefined for manual edges) */
  callOrder?: number
  /** Line within the source function body where the call appears */
  callLine?: number
}

export interface Flow {
  id: string
  name: string
  description?: string
  tags: string[]
  nodes: FlowNode[]
  edges: FlowEdge[]
  version: number
  createdAt: string
  updatedAt: string
}

export interface FlowSummary {
  id: string
  name: string
  description?: string
  tags: string[]
  nodeCount: number
  updatedAt: string
  createdAt: string
}

export const NODE_KINDS: NodeKind[] = [
  'function', 'method', 'class', 'endpoint', 'sql',
  'event', 'external-api', 'ui', 'job', 'config', 'stub',
  'branch', 'loop', 'unknown',
]

export const EDGE_KINDS: EdgeKind[] = [
  'calls', 'async-calls', 'emits', 'listens', 'reads',
  'writes', 'http', 'renders', 'inherits', 'branches', 'unknown',
]

export const KIND_COLORS: Record<NodeKind, string> = {
  function: '#6366f1',
  method: '#8b5cf6',
  class: '#a78bfa',
  endpoint: '#22c55e',
  sql: '#f59e0b',
  event: '#ec4899',
  'external-api': '#06b6d4',
  ui: '#3b82f6',
  job: '#f97316',
  config: '#94a3b8',
  stub: '#475569',
  branch: '#f59e0b',
  loop: '#06b6d4',
  unknown: '#475569',
}

export const BRANCH_HANDLE_COLORS = {
  true: '#22c55e',
  false: '#ef4444',
  body: '#06b6d4',
  complete: '#a855f7',
  // try-catch handles
  try: '#6366f1',
  catch: '#f97316',
  finally: '#94a3b8',
  // switch handles
  case: '#f59e0b',
  default: '#64748b',
  // sequential
  next: '#475569',
}

export const EDGE_KIND_COLORS: Record<EdgeKind, string> = {
  calls: '#6366f1',
  'async-calls': '#8b5cf6',
  emits: '#ec4899',
  listens: '#f472b6',
  reads: '#f59e0b',
  writes: '#ef4444',
  http: '#06b6d4',
  renders: '#3b82f6',
  inherits: '#94a3b8',
  branches: '#22c55e',
  unknown: '#475569',
}
