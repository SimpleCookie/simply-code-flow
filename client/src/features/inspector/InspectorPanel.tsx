import { useState } from 'react'
import { nanoid } from 'nanoid'
import Editor from '@monaco-editor/react'
import { X, Trash2, Plus, ExternalLink, ChevronRight, ChevronLeft, ArrowLeftRight } from 'lucide-react'
import { useFlowStore } from '../../store/flowStore.ts'
import { useUIStore } from '../../store/uiStore.ts'
import { NODE_KINDS, EDGE_KINDS, KIND_COLORS, EDGE_KIND_COLORS } from '@scf/shared'
import type { NodeKind, NodeStatus, EdgeKind, EdgeConfidence } from '@scf/shared'
import type { CustomNodeData } from '../graph/CustomNode.tsx'
import type { CustomEdgeData } from '../graph/CustomEdge.tsx'
import { SUPPORTED_LANGUAGES } from '../../lib/detect/index.ts'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 10px',
  background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)',
  borderRadius: '5px', color: 'var(--color-text)', fontSize: '13px', outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 600,
  color: 'var(--color-text-muted)', textTransform: 'uppercase',
  letterSpacing: '0.06em', marginBottom: '4px',
}

const sectionStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderBottom: '1px solid var(--color-border)',
}

export function InspectorPanel() {
  const selectedNodeId = useUIStore((s) => s.selectedNodeId)
  const selectedEdgeId = useUIStore((s) => s.selectedEdgeId)
  const inspectorOpen = useUIStore((s) => s.inspectorOpen)
  const setInspectorOpen = useUIStore((s) => s.setInspectorOpen)
  const clearSelection = useUIStore((s) => s.clearSelection)
  const selectNode = useUIStore((s) => s.selectNode)
  const openSnippetModal = useUIStore((s) => s.openSnippetModal)

  const nodes = useFlowStore((s) => s.nodes)
  const edges = useFlowStore((s) => s.edges)
  const updateNode = useFlowStore((s) => s.updateNode)
  const deleteNode = useFlowStore((s) => s.deleteNode)
  const updateEdge = useFlowStore((s) => s.updateEdge)
  const deleteEdge = useFlowStore((s) => s.deleteEdge)
  const addEdge = useFlowStore((s) => s.addEdge)
  const reconnectEdge = useFlowStore((s) => s.reconnectEdge)
  const setEdgeSourceHandle = useFlowStore((s) => s.setEdgeSourceHandle)
  const swapEdgeDirection = useFlowStore((s) => s.swapEdgeDirection)

  const [codeExpanded, setCodeExpanded] = useState(false)
  // "Add Connection" form state (node inspector)
  const [addConnOpen, setAddConnOpen] = useState(false)
  const [addConnTarget, setAddConnTarget] = useState('')
  const [addConnKind, setAddConnKind] = useState<EdgeKind>('calls')
  const [addConnConf, setAddConnConf] = useState<EdgeConfidence>('suspected')
  const [addConnCond, setAddConnCond] = useState('')

  const node = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null
  const edge = selectedEdgeId ? edges.find((e) => e.id === selectedEdgeId) : null
  const nodeData = node ? (node.data as CustomNodeData) : null
  const edgeData = edge ? (edge.data as CustomEdgeData) : null

  if (!inspectorOpen) {
    return (
      <button
        onClick={() => setInspectorOpen(true)}
        style={{
          position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
          background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
          borderRight: 'none', borderRadius: '6px 0 0 6px',
          padding: '8px 4px', cursor: 'pointer', color: 'var(--color-text-muted)',
          zIndex: 10,
        }}
        title="Open inspector"
      >
        <ChevronLeft size={16} />
      </button>
    )
  }

  const panelStyle: React.CSSProperties = {
    width: '320px',
    flexShrink: 0,
    background: 'var(--color-bg-secondary)',
    borderLeft: '1px solid var(--color-border)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', borderBottom: '1px solid var(--color-border)', flexShrink: 0,
  }

  // ——— NODE INSPECTOR ———
  if (nodeData && node) {
    const color = KIND_COLORS[nodeData.kind] ?? '#475569'
    const nodeEdges = edges.filter((e) => e.source === node.id || e.target === node.id)

    return (
      <div style={panelStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ background: color + '22', color, border: `1px solid ${color}44`, borderRadius: '4px', fontSize: '10px', padding: '2px 7px', fontWeight: 600, textTransform: 'uppercase' }}>
              {nodeData.kind}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={() => openSnippetModal(node.id)} title="Add callee" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '4px', borderRadius: '4px' }}>
              <Plus size={15} />
            </button>
            <button onClick={() => { deleteNode(node.id); clearSelection() }} title="Delete node" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '4px', borderRadius: '4px' }}>
              <Trash2 size={15} />
            </button>
            <button onClick={() => { setInspectorOpen(false) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '4px', borderRadius: '4px' }}>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {/* Label */}
          <div style={sectionStyle}>
            <label style={labelStyle}>Label</label>
            <input
              style={inputStyle}
              value={nodeData.label}
              onChange={(e) => updateNode(node.id, { label: e.target.value })}
            />
          </div>

          {/* Kind + Language + Status */}
          <div style={{ ...sectionStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={labelStyle}>Kind</label>
              <select style={inputStyle} value={nodeData.kind} onChange={(e) => updateNode(node.id, { kind: e.target.value as NodeKind })}>
                {NODE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select style={inputStyle} value={nodeData.status} onChange={(e) => updateNode(node.id, { status: e.target.value as NodeStatus })}>
                <option value="confirmed">Confirmed</option>
                <option value="suspected">Suspected</option>
                <option value="todo">TODO</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Language</label>
              <select style={inputStyle} value={nodeData.language ?? 'plaintext'} onChange={(e) => updateNode(node.id, { language: e.target.value })}>
                {SUPPORTED_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* File path */}
          <div style={sectionStyle}>
            <label style={labelStyle}>File Path</label>
            <input style={inputStyle} value={nodeData.filePath ?? ''} onChange={(e) => updateNode(node.id, { filePath: e.target.value || undefined })} placeholder="src/…" />
          </div>

          {/* Code */}
          <div style={sectionStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Code</label>
              <button onClick={() => setCodeExpanded((v) => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent)', fontSize: '11px' }}>
                {codeExpanded ? 'Collapse' : 'Expand'} <ExternalLink size={11} style={{ verticalAlign: 'middle' }} />
              </button>
            </div>
            <div style={{ height: codeExpanded ? '400px' : '180px', border: '1px solid var(--color-border)', borderRadius: '6px', overflow: 'hidden' }}>
              <Editor
                height="100%"
                language={nodeData.language ?? 'plaintext'}
                value={nodeData.code}
                onChange={(v) => updateNode(node.id, { code: v ?? '' })}
                theme="vs-dark"
                options={{ fontSize: 12, minimap: { enabled: false }, scrollBeyondLastLine: false, wordWrap: 'on', lineNumbers: 'on', padding: { top: 8 } }}
              />
            </div>
          </div>

          {/* Notes */}
          <div style={sectionStyle}>
            <label style={labelStyle}>Notes (markdown)</label>
            <textarea
              style={{ ...inputStyle, height: '80px', resize: 'vertical', fontFamily: 'inherit' }}
              value={nodeData.notes ?? ''}
              onChange={(e) => updateNode(node.id, { notes: e.target.value || undefined })}
              placeholder="Add notes…"
            />
          </div>

          {/* Tags */}
          <div style={sectionStyle}>
            <label style={labelStyle}>Tags</label>
            <input
              style={inputStyle}
              value={nodeData.tags?.join(', ') ?? ''}
              onChange={(e) => updateNode(node.id, { tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
              placeholder="auth, payment, legacy"
            />
          </div>

          {/* Connected edges */}
          <div style={sectionStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Connections ({nodeEdges.length})</label>
              <button
                onClick={() => { setAddConnOpen((v) => !v); setAddConnTarget(''); setAddConnKind('calls'); setAddConnConf('suspected'); setAddConnCond('') }}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-accent)', cursor: 'pointer', fontSize: '11px', padding: '2px 7px' }}
                title="Add connection"
              >
                <Plus size={11} /> Add
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {nodeEdges.map((e) => {
                const d = (e.data ?? {}) as CustomEdgeData
                const isOut = e.source === node.id
                const otherId = isOut ? e.target : e.source
                const otherNode = nodes.find((n) => n.id === otherId)
                const otherLabel = otherNode ? (otherNode.data as CustomNodeData).label : otherId
                const edgeColor = EDGE_KIND_COLORS[d.kind] ?? '#475569'
                return (
                  <div
                    key={e.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: 'var(--color-bg-card)', borderRadius: '5px', fontSize: '12px' }}
                  >
                    <span
                      onClick={() => selectNode(otherId)}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1, cursor: 'pointer', overflow: 'hidden' }}
                    >
                      <span style={{ color: isOut ? edgeColor : 'var(--color-text-muted)', fontSize: '10px', flexShrink: 0 }}>{isOut ? '→' : '←'}</span>
                      <span style={{ background: edgeColor + '22', color: edgeColor, borderRadius: '3px', fontSize: '9px', padding: '1px 5px', fontWeight: 600, flexShrink: 0 }}>{d.kind}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{otherLabel}</span>
                    </span>
                    <button
                      onClick={() => deleteEdge(e.id)}
                      title="Disconnect"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '2px', borderRadius: '3px', flexShrink: 0, opacity: 0.7 }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Add Connection form */}
            {addConnOpen && (
              <div style={{ marginTop: '8px', padding: '10px', background: 'var(--color-bg-primary)', borderRadius: '6px', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <label style={labelStyle}>Target Node</label>
                  <select
                    style={inputStyle}
                    value={addConnTarget}
                    onChange={(e) => setAddConnTarget(e.target.value)}
                  >
                    <option value="">— select —</option>
                    {nodes
                      .filter((n) => n.id !== node.id)
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {(n.data as CustomNodeData).label || n.id}
                        </option>
                      ))}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <div>
                    <label style={labelStyle}>Kind</label>
                    <select style={inputStyle} value={addConnKind} onChange={(e) => setAddConnKind(e.target.value as EdgeKind)}>
                      {EDGE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Confidence</label>
                    <select style={inputStyle} value={addConnConf} onChange={(e) => setAddConnConf(e.target.value as EdgeConfidence)}>
                      <option value="confirmed">Confirmed</option>
                      <option value="suspected">Suspected</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Condition / Label</label>
                  <input style={inputStyle} value={addConnCond} onChange={(e) => setAddConnCond(e.target.value)} placeholder="optional" />
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    disabled={!addConnTarget}
                    onClick={() => {
                      if (!addConnTarget) return
                      addEdge({ id: nanoid(), source: node.id, target: addConnTarget, kind: addConnKind, confidence: addConnConf, condition: addConnCond || undefined })
                      setAddConnOpen(false)
                    }}
                    style={{ flex: 1, padding: '6px', background: 'var(--color-accent)', border: 'none', borderRadius: '5px', color: '#fff', cursor: addConnTarget ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: 600, opacity: addConnTarget ? 1 : 0.5 }}
                  >
                    Connect
                  </button>
                  <button
                    onClick={() => setAddConnOpen(false)}
                    style={{ padding: '6px 10px', background: 'none', border: '1px solid var(--color-border)', borderRadius: '5px', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '12px' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ——— EDGE INSPECTOR ———
  if (edgeData && edge) {
    const color = EDGE_KIND_COLORS[edgeData.kind] ?? '#475569'
    const sourceNode = nodes.find((n) => n.id === edge.source)
    const isSourceBranch = (sourceNode?.data as CustomNodeData | undefined)?.kind === 'branch'

    return (
      <div style={panelStyle}>
        <div style={headerStyle}>
          <span style={{ color, fontWeight: 600, fontSize: '14px' }}>Edge</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={() => { deleteEdge(edge.id); clearSelection() }} title="Delete edge" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '4px', borderRadius: '4px' }}>
              <Trash2 size={15} />
            </button>
            <button onClick={() => setInspectorOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '4px', borderRadius: '4px' }}>
              <X size={15} />
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {/* Source / Target selects + Swap */}
          <div style={sectionStyle}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '6px' }}>
              <div>
                <label style={labelStyle}>Source</label>
                <select
                  style={inputStyle}
                  value={edge.source}
                  onChange={(e) => reconnectEdge(edge.id, e.target.value, edge.target)}
                >
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {(n.data as CustomNodeData).label || n.id}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => swapEdgeDirection(edge.id)}
                title="Swap direction"
                style={{ alignSelf: 'flex-end', marginBottom: '2px', background: 'none', border: '1px solid var(--color-border)', borderRadius: '5px', cursor: 'pointer', color: color, padding: '5px 7px' }}
              >
                <ArrowLeftRight size={13} />
              </button>
              <div>
                <label style={labelStyle}>Target</label>
                <select
                  style={inputStyle}
                  value={edge.target}
                  onChange={(e) => reconnectEdge(edge.id, edge.source, e.target.value)}
                >
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {(n.data as CustomNodeData).label || n.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          {isSourceBranch && (
            <div style={sectionStyle}>
              <label style={labelStyle}>Branch Handle</label>
              <select
                style={inputStyle}
                value={edge.sourceHandle ?? ''}
                onChange={(e) => setEdgeSourceHandle(edge.id, e.target.value || undefined)}
              >
                <option value="">— none —</option>
                <option value="true">✅ TRUE</option>
                <option value="false">❌ FALSE</option>
              </select>
            </div>
          )}
          <div style={{ ...sectionStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={labelStyle}>Kind</label>
              <select style={inputStyle} value={edgeData.kind} onChange={(e) => updateEdge(edge.id, { kind: e.target.value as EdgeKind })}>
                {EDGE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Confidence</label>
              <select style={inputStyle} value={edgeData.confidence} onChange={(e) => updateEdge(edge.id, { confidence: e.target.value as EdgeConfidence })}>
                <option value="confirmed">Confirmed</option>
                <option value="suspected">Suspected</option>
              </select>
            </div>
          </div>
          <div style={sectionStyle}>
            <label style={labelStyle}>Label / Condition</label>
            <input style={inputStyle} value={edgeData.condition ?? edgeData.label ?? ''} onChange={(e) => updateEdge(edge.id, { condition: e.target.value || undefined, label: e.target.value || undefined })} placeholder="if user.isAdmin, etc." />
          </div>
          <div style={sectionStyle}>
            <label style={labelStyle}>Notes</label>
            <textarea style={{ ...inputStyle, height: '80px', resize: 'vertical', fontFamily: 'inherit' }} value={edgeData.notes ?? ''} onChange={(e) => updateEdge(edge.id, { notes: e.target.value || undefined })} placeholder="Add notes…" />
          </div>
        </div>
      </div>
    )
  }

  // Empty state (panel open but nothing selected)
  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Inspector</span>
        <button onClick={() => setInspectorOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '4px' }}>
          <ChevronRight size={15} />
        </button>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '13px', padding: '24px', textAlign: 'center' }}>
        Click a node or edge to inspect it.
      </div>
    </div>
  )
}
