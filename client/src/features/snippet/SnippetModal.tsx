import { useState, useEffect, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import { nanoid } from 'nanoid'
import { Modal } from '../../components/Modal.tsx'
import { detectCode, SUPPORTED_LANGUAGES } from '../../lib/detect/index.ts'
import { hashCode } from '../../lib/hash/index.ts'
import { useFlowStore } from '../../store/flowStore.ts'
import { useUIStore } from '../../store/uiStore.ts'
import { NODE_KINDS, KIND_COLORS } from '@scf/shared'
import type { NodeKind, NodeStatus } from '@scf/shared'
import { Zap, AlertTriangle } from 'lucide-react'

const STATUS_OPTIONS: { value: NodeStatus; label: string }[] = [
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'suspected', label: 'Suspected' },
  { value: 'todo', label: 'TODO' },
]

export function SnippetModal() {
  const open = useUIStore((s) => s.snippetModalOpen)
  const parentId = useUIStore((s) => s.snippetModalParentId)
  const closeModal = useUIStore((s) => s.closeSnippetModal)
  const commitSnippet = useFlowStore((s) => s.commitSnippet)
  const nodes = useFlowStore((s) => s.nodes)

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
  const [selectedCallees, setSelectedCallees] = useState<Set<string>>(new Set())
  const [detection, setDetection] = useState(detectCode(''))
  const [dupWarning, setDupWarning] = useState(false)

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setCode(''); setLabel(''); setKind('function'); setLanguage('typescript')
      setFilePath(''); setLineStart(''); setLineEnd(''); setNotes(''); setTags('')
      setStatus('confirmed'); setSelectedCallees(new Set()); setDetection(detectCode('')); setDupWarning(false)
    }
  }, [open])

  const runDetection = useCallback((value: string) => {
    const result = detectCode(value)
    setDetection(result)
    if (!label) setLabel(result.suggestedLabel)
    setKind(result.suggestedKind)
    setLanguage(result.language || 'typescript')
    if (result.filePath) setFilePath(result.filePath)
    if (result.lineRange) {
      setLineStart(String(result.lineRange[0]))
      setLineEnd(String(result.lineRange[1]))
    }
    // Duplicate check
    const hash = hashCode(value)
    const isDup = nodes.some((n) => (n.data as { contentHash?: string }).contentHash === hash)
    setDupWarning(isDup)
  }, [label, nodes])

  const handleCodeChange = useCallback((value: string | undefined) => {
    const v = value ?? ''
    setCode(v)
    const debounce = setTimeout(() => runDetection(v), 400)
    return () => clearTimeout(debounce)
  }, [runDetection])

  const toggleCallee = (name: string) => {
    setSelectedCallees((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  const handleSubmit = () => {
    const nodeId = nanoid()
    const hash = hashCode(code)
    const parentNode = parentId ? nodes.find((n) => n.id === parentId) : null
    const offsetX = parentNode ? parentNode.position.x + 280 : 100 + Math.random() * 200
    const offsetY = parentNode ? parentNode.position.y + 150 : 100 + Math.random() * 200

    commitSnippet(
      {
        id: nodeId,
        label: label || detection.suggestedLabel || 'unlabelled',
        kind,
        language,
        code,
        filePath: filePath || undefined,
        lineRange: lineStart ? [parseInt(lineStart, 10), parseInt(lineEnd || lineStart, 10)] : undefined,
        notes: notes || undefined,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        status,
        isAsync: detection.isAsync,
        contentHash: hash,
        position: { x: offsetX, y: offsetY },
      },
      parentId ?? null,
      Array.from(selectedCallees),
    )

    closeModal()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px',
    background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)',
    borderRadius: '6px', color: 'var(--color-text)', fontSize: '13px',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '11px', fontWeight: 600,
    color: 'var(--color-text-muted)', textTransform: 'uppercase',
    letterSpacing: '0.06em', marginBottom: '5px',
  }

  return (
    <Modal open={open} onClose={closeModal} title="Add Node" width="820px">
      <div style={{ display: 'flex', height: 'min(75vh, 620px)' }}>
        {/* Left: code editor */}
        <div style={{ flex: '1 1 55%', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--color-border)' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={labelStyle}>Code</span>
            {detection.isAsync && <span title="Async detected"><Zap size={13} color="#f59e0b" /></span>}
            {dupWarning && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b', fontSize: '11px' }}>
                <AlertTriangle size={12} /> Possible duplicate
              </span>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <Editor
              height="100%"
              language={language}
              value={code}
              onChange={handleCodeChange}
              theme="vs-dark"
              options={{
                fontSize: 13, minimap: { enabled: false },
                scrollBeyondLastLine: false, wordWrap: 'on',
                lineNumbers: 'on', padding: { top: 12 },
              }}
            />
          </div>
        </div>

        {/* Right: metadata form */}
        <div style={{ flex: '0 0 320px', overflow: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Label */}
          <div>
            <label style={labelStyle}>Label</label>
            <input style={inputStyle} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={detection.suggestedLabel || 'Function / class name'} />
          </div>

          {/* Kind + Language */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={labelStyle}>Kind</label>
              <select style={inputStyle} value={kind} onChange={(e) => setKind(e.target.value as NodeKind)}>
                {NODE_KINDS.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Language</label>
              <select style={inputStyle} value={language} onChange={(e) => setLanguage(e.target.value)}>
                {SUPPORTED_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* File path + line range */}
          <div>
            <label style={labelStyle}>File Path</label>
            <input style={inputStyle} value={filePath} onChange={(e) => setFilePath(e.target.value)} placeholder="src/services/order.ts" />
          </div>
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

          {/* Status */}
          <div>
            <label style={labelStyle}>Status</label>
            <select style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value as NodeStatus)}>
              {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label style={labelStyle}>Tags (comma separated)</label>
            <input style={inputStyle} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="auth, payment, deprecated" />
          </div>

          {/* Notes */}
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea
              style={{ ...inputStyle, height: '70px', resize: 'vertical', fontFamily: 'inherit' }}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Markdown supported…"
            />
          </div>

          {/* Detected callees */}
          {detection.detectedCallees.length > 0 && (
            <div>
              <label style={labelStyle}>Detected Calls → Create Stubs</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '140px', overflow: 'auto' }}>
                {detection.detectedCallees.map((name) => (
                  <label key={name} style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '12px', color: 'var(--color-text)' }}>
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

          {/* Auto-detected signals */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {detection.hasSQL && <span style={{ background: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b44', borderRadius: '4px', fontSize: '10px', padding: '2px 7px' }}>SQL</span>}
            {detection.hasHTTP && <span style={{ background: '#06b6d422', color: '#06b6d4', border: '1px solid #06b6d444', borderRadius: '4px', fontSize: '10px', padding: '2px 7px' }}>HTTP</span>}
            {detection.hasEvents && <span style={{ background: '#ec489922', color: '#ec4899', border: '1px solid #ec489944', borderRadius: '4px', fontSize: '10px', padding: '2px 7px' }}>Events</span>}
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            style={{
              marginTop: 'auto', padding: '10px', background: 'var(--color-accent)',
              color: '#fff', border: 'none', borderRadius: '7px', fontWeight: 600,
              fontSize: '14px', cursor: 'pointer',
            }}
          >
            Add to Graph
          </button>
        </div>
      </div>
    </Modal>
  )
}
