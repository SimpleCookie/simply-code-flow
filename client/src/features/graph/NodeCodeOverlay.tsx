import { useState, useEffect, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import { X, Zap, AlertTriangle, GitBranch, Code2, GitMerge } from 'lucide-react'
import { useFlowStore } from '../../store/flowStore.ts'
import { useUIStore } from '../../store/uiStore.ts'
import { detectCode, SUPPORTED_LANGUAGES } from '../../lib/detect/index.ts'
import { computeComplexity } from '../../lib/cfg/index.ts'
import { CfgCanvas } from '../cfg/CfgCanvas.tsx'
import { NODE_KINDS, KIND_COLORS } from '@scf/shared'
import type { NodeKind, NodeStatus } from '@scf/shared'
import type { CustomNodeData } from './CustomNode.tsx'

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  background: 'var(--color-bg-primary)',
  border: '1px solid var(--color-border)',
  borderRadius: '5px',
  color: 'var(--color-text)',
  fontSize: '13px',
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: '4px',
}

export function NodeCodeOverlay() {
  const nodeId = useUIStore((s) => s.codeOverlayNodeId)
  const closeOverlay = useUIStore((s) => s.closeCodeOverlay)
  const lastLanguage = useUIStore((s) => s.lastLanguage)
  const setLastLanguage = useUIStore((s) => s.setLastLanguage)

  const nodes = useFlowStore((s) => s.nodes)
  const commitOverlay = useFlowStore((s) => s.commitOverlay)
  const addBranchNode = useFlowStore((s) => s.addBranchNode)

  const node = nodeId ? nodes.find((n) => n.id === nodeId) : null
  const nodeData = node ? (node.data as CustomNodeData) : null

  // Form state — initialised from nodeData when overlay opens
  const [code, setCode] = useState('')
  const [label, setLabel] = useState('')
  const [kind, setKind] = useState<NodeKind>('function')
  const [language, setLanguage] = useState('typescript')
  const [filePath, setFilePath] = useState('')
  const [lineStart, setLineStart] = useState('')
  const [lineEnd, setLineEnd] = useState('')
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState('')
  const [status, setStatus] = useState<NodeStatus>('confirmed')
  const [detection, setDetection] = useState(detectCode(''))
  const [selectedCallees, setSelectedCallees] = useState<Set<string>>(new Set())
  const [selectedBranches, setSelectedBranches] = useState<Set<number>>(new Set())
  const [activeTab, setActiveTab] = useState<'code' | 'flow'>('code')

  // Seed form from node when overlay opens
  useEffect(() => {
    if (!nodeData) return
    setCode(nodeData.code ?? '')
    setLabel(nodeData.label ?? '')
    setKind(nodeData.kind ?? 'function')
    setLanguage(nodeData.language ?? lastLanguage)
    setFilePath(nodeData.filePath ?? '')
    setLineStart(nodeData.lineRange ? String(nodeData.lineRange[0]) : '')
    setLineEnd(nodeData.lineRange ? String(nodeData.lineRange[1]) : '')
    setNotes(nodeData.notes ?? '')
    setTags(nodeData.tags?.join(', ') ?? '')
    setStatus(nodeData.status ?? 'confirmed')
    const det = detectCode(nodeData.code ?? '')
    setDetection(det)
    setSelectedCallees(new Set())
    setSelectedBranches(new Set())
  }, [nodeId]) // eslint-disable-line react-hooks/exhaustive-deps

  const runDetection = useCallback(
    (value: string) => {
      const result = detectCode(value)
      setDetection(result)
      if (result.language && result.language !== 'plaintext') {
        setLanguage(result.language)
      }
    },
    [],
  )

  const handleCodeChange = useCallback(
    (value: string | undefined) => {
      const v = value ?? ''
      setCode(v)
      const timer = setTimeout(() => runDetection(v), 400)
      return () => clearTimeout(timer)
    },
    [runDetection],
  )

  const toggleCallee = (name: string) => {
    setSelectedCallees((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  const toggleBranch = (idx: number) => {
    setSelectedBranches((prev) => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  const handleSave = useCallback(() => {
    if (!nodeId) return
    commitOverlay(
      nodeId,
      {
        code,
        label: label || nodeData?.label || 'unlabelled',
        kind,
        language,
        filePath: filePath || undefined,
        lineRange: lineStart
          ? [parseInt(lineStart, 10), parseInt(lineEnd || lineStart, 10)]
          : undefined,
        notes: notes || undefined,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        status,
        isAsync: detection.isAsync,
      },
      Array.from(selectedCallees),
    )
    selectedBranches.forEach((idx) => {
      const b = detection.detectedBranches[idx]
      if (b && nodeId) {
        addBranchNode({
          parentNodeId: nodeId,
          condition: b.condition,
          thenCallees: b.thenCallees,
          elseCallees: b.elseCallees,
        })
      }
    })
    setLastLanguage(language)
    closeOverlay()
  }, [nodeId, code, label, nodeData, kind, language, filePath, lineStart, lineEnd, notes, tags, status, detection, selectedCallees, selectedBranches, commitOverlay, addBranchNode, setLastLanguage, closeOverlay])

  // Ctrl+Enter to save, Escape to close
  useEffect(() => {
    if (!nodeId) return
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault()
        handleSave()
      } else if (e.key === 'Escape') {
        closeOverlay()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [nodeId, handleSave, closeOverlay])

  if (!nodeId || !nodeData) return null

  const kindColor = KIND_COLORS[kind] ?? '#475569'
  const complexity = code.trim() ? computeComplexity(code) : 1

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        zIndex: 1001,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) closeOverlay() }}
    >
      <div
        style={{
          width: '90vw',
          height: '90vh',
          background: 'var(--color-bg-secondary)',
          borderRadius: '12px',
          border: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 20px',
            borderBottom: '1px solid var(--color-border)',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              background: kindColor + '22',
              color: kindColor,
              border: `1px solid ${kindColor}44`,
              borderRadius: '4px',
              fontSize: '10px',
              padding: '2px 8px',
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            {nodeData.kind}
          </span>
          <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--color-text)', fontFamily: 'ui-monospace, monospace' }}>
            {nodeData.label || 'untitled'}
          </span>
          {nodeData.filePath && (
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontFamily: 'ui-monospace, monospace' }}>
              {nodeData.filePath}
              {nodeData.lineRange && ` :${nodeData.lineRange[0]}–${nodeData.lineRange[1]}`}
            </span>
          )}
          {detection.isAsync && <Zap size={14} color="#f59e0b" />}
          <div style={{ flex: 1 }} />
          {/* ── Tab bar ── */}
          <div style={{ display: 'flex', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '2px', gap: '2px' }}>
            {(['code', 'flow'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '4px 12px', borderRadius: '4px', border: 'none',
                  cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                  background: activeTab === tab ? 'var(--color-bg-secondary)' : 'transparent',
                  color: activeTab === tab ? 'var(--color-text)' : 'var(--color-text-muted)',
                  boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
                  transition: 'all 0.1s',
                }}
              >
                {tab === 'code' ? <Code2 size={12} /> : <GitMerge size={12} />}
                {tab === 'code' ? 'Code' : 'Flow'}
                {tab === 'flow' && complexity > 1 && (
                  <span style={{
                    background: complexity > 10 ? '#ef4444' : complexity > 5 ? '#f59e0b' : '#22c55e',
                    color: '#fff', borderRadius: '10px', fontSize: '9px',
                    padding: '0 5px', fontWeight: 700, minWidth: '16px', textAlign: 'center',
                  }}>{complexity}</span>
                )}
              </button>
            ))}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Ctrl+Enter to save</span>
          <button
            onClick={closeOverlay}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '4px', borderRadius: '4px' }}
            title="Discard & close (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left: Monaco or CFG */}
          {activeTab === 'code' ? (
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <Editor
                height="100%"
                language={language}
                value={code}
                onChange={handleCodeChange}
                theme="vs-dark"
                options={{
                  fontSize: 14,
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  wordWrap: 'off',
                  lineNumbers: 'on',
                  padding: { top: 16 },
                  renderLineHighlight: 'all',
                }}
              />
            </div>
          ) : (
            <CfgCanvas
              code={code}
              language={language}
              nodeLabel={nodeData.label || 'untitled'}
              onJumpTo={(callee) => {
                // Find a node in the graph matching the callee name and open its overlay
                const target = nodes.find((n) => {
                  const d = n.data as CustomNodeData
                  return d.label === callee || d.label?.toLowerCase() === callee.toLowerCase()
                })
                if (target) {
                  closeOverlay()
                  setTimeout(() => useUIStore.getState().openCodeOverlay(target.id), 50)
                }
              }}
            />
          )}

          {/* Right: metadata */}
          <div
            style={{
              width: '300px',
              flexShrink: 0,
              borderLeft: '1px solid var(--color-border)',
              overflow: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            {/* Label */}
            <div>
              <label style={labelStyle}>Label</label>
              <input
                style={inputStyle}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Function / class name"
              />
            </div>

            {/* Kind + Status */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={labelStyle}>Kind</label>
                <select style={inputStyle} value={kind} onChange={(e) => setKind(e.target.value as NodeKind)}>
                  {NODE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value as NodeStatus)}>
                  <option value="confirmed">Confirmed</option>
                  <option value="suspected">Suspected</option>
                  <option value="todo">TODO</option>
                </select>
              </div>
            </div>

            {/* Language */}
            <div>
              <label style={labelStyle}>Language</label>
              <select style={inputStyle} value={language} onChange={(e) => { setLanguage(e.target.value); setLastLanguage(e.target.value) }}>
                {SUPPORTED_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            {/* File path */}
            <div>
              <label style={labelStyle}>File Path</label>
              <input
                style={inputStyle}
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="src/services/order.ts"
              />
            </div>

            {/* Line range */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={labelStyle}>Line Start</label>
                <input style={inputStyle} type="number" value={lineStart} onChange={(e) => setLineStart(e.target.value)} placeholder="1" />
              </div>
              <div>
                <label style={labelStyle}>Line End</label>
                <input style={inputStyle} type="number" value={lineEnd} onChange={(e) => setLineEnd(e.target.value)} placeholder="50" />
              </div>
            </div>

            {/* Tags */}
            <div>
              <label style={labelStyle}>Tags</label>
              <input
                style={inputStyle}
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="auth, payment, legacy"
              />
            </div>

            {/* Notes */}
            <div>
              <label style={labelStyle}>Notes</label>
              <textarea
                style={{ ...inputStyle, height: '80px', resize: 'vertical', fontFamily: 'inherit' }}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Markdown supported…"
              />
            </div>

            {/* Detected callees */}
            {detection.detectedCallees.length > 0 && (
              <div>
                <label style={labelStyle}>Expand → Create Stubs</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '160px', overflow: 'auto' }}>
                  {detection.detectedCallees.map((name) => (
                    <label
                      key={name}
                      style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '12px', color: 'var(--color-text)' }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedCallees.has(name)}
                        onChange={() => toggleCallee(name)}
                        style={{ accentColor: KIND_COLORS.stub }}
                      />
                      <code style={{ fontFamily: 'ui-monospace, monospace' }}>{name}()</code>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Detected branch nodes */}
            {detection.detectedBranches.length > 0 && (
              <div>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <GitBranch size={11} /> Branch nodes
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '130px', overflow: 'auto' }}>
                  {detection.detectedBranches.map((b, i) => (
                    <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', cursor: 'pointer', fontSize: '12px', color: 'var(--color-text)' }}>
                      <input
                        type="checkbox"
                        checked={selectedBranches.has(i)}
                        onChange={() => toggleBranch(i)}
                        style={{ marginTop: '2px', accentColor: '#f59e0b' }}
                      />
                      <span>
                        <code style={{ fontFamily: 'ui-monospace, monospace', color: '#f59e0b' }}>{b.condition}</code>
                        <span style={{ marginLeft: '5px', color: 'var(--color-text-muted)', fontSize: '11px' }}>
                          {b.thenCallees.length > 0 && `T: ${b.thenCallees.slice(0, 2).join(', ')}`}
                          {b.hasElse && b.elseCallees.length > 0 && ` F: ${b.elseCallees.slice(0, 2).join(', ')}`}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Signals */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {detection.hasSQL && (
                <span style={{ background: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b44', borderRadius: '4px', fontSize: '10px', padding: '2px 7px' }}>SQL</span>
              )}
              {detection.hasHTTP && (
                <span style={{ background: '#06b6d422', color: '#06b6d4', border: '1px solid #06b6d444', borderRadius: '4px', fontSize: '10px', padding: '2px 7px' }}>HTTP</span>
              )}
              {detection.hasEvents && (
                <span style={{ background: '#ec489922', color: '#ec4899', border: '1px solid #ec489944', borderRadius: '4px', fontSize: '10px', padding: '2px 7px' }}>Events</span>
              )}
              {detection.isAsync && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', background: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b44', borderRadius: '4px', fontSize: '10px', padding: '2px 7px' }}>
                  <Zap size={10} /> async
                </span>
              )}
            </div>

            {/* Duplicate warning */}
            {detection.confidence < 5 && code.trim().length > 10 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#f59e0b', fontSize: '11px' }}>
                <AlertTriangle size={12} /> Low language confidence
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            padding: '12px 20px',
            borderTop: '1px solid var(--color-border)',
            flexShrink: 0,
          }}
        >
          <button
            onClick={closeOverlay}
            style={{
              padding: '8px 18px',
              background: 'none',
              border: '1px solid var(--color-border)',
              borderRadius: '7px',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Discard (Esc)
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '8px 22px',
              background: 'var(--color-accent)',
              border: 'none',
              borderRadius: '7px',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Save & Close (Ctrl+Enter)
          </button>
        </div>
      </div>
    </div>
  )
}
