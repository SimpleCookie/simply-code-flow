import { useState, useEffect, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import { nanoid } from 'nanoid'
import { Modal } from '../../components/Modal.tsx'
import { detectCode, SUPPORTED_LANGUAGES } from '../../lib/detect/index.ts'
import { extractFunctions, buildInternalEdges } from '../../lib/extract/index.ts'
import { hashCode } from '../../lib/hash/index.ts'
import { useFlowStore } from '../../store/flowStore.ts'
import { useUIStore } from '../../store/uiStore.ts'
import { NODE_KINDS, KIND_COLORS } from '@scf/shared'
import type { NodeKind, NodeStatus, FlowEdge } from '@scf/shared'
import { Zap, AlertTriangle, ChevronRight, GitBranch } from 'lucide-react'
import type { ExtractedFunction } from '../../lib/extract/index.ts'

// ─── style helpers ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px',
  background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)',
  borderRadius: '6px', color: 'var(--color-text)', fontSize: '13px', outline: 'none',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 600,
  color: 'var(--color-text-muted)', textTransform: 'uppercase',
  letterSpacing: '0.06em', marginBottom: '5px',
}

// ─── preview row type ─────────────────────────────────────────────────────────

interface PreviewRow {
  fn: ExtractedFunction
  tempId: string
  label: string
  kind: NodeKind
  included: boolean
}

// ─── component ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: NodeStatus; label: string }[] = [
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'suspected', label: 'Suspected' },
  { value: 'todo', label: 'TODO' },
]

export function SnippetModal() {
  const open = useUIStore((s) => s.snippetModalOpen)
  const parentId = useUIStore((s) => s.snippetModalParentId)
  const closeModal = useUIStore((s) => s.closeSnippetModal)
  const lastLanguage = useUIStore((s) => s.lastLanguage)
  const setLastLanguage = useUIStore((s) => s.setLastLanguage)

  const commitSnippet = useFlowStore((s) => s.commitSnippet)
  const commitMultiSnippet = useFlowStore((s) => s.commitMultiSnippet)
  const addBranchNode = useFlowStore((s) => s.addBranchNode)
  const nodes = useFlowStore((s) => s.nodes)

  // ── Paste-step state ──
  const [step, setStep] = useState<'paste' | 'preview'>('paste')
  const [code, setCode] = useState('')
  const [label, setLabel] = useState('')
  const [kind, setKind] = useState<NodeKind>('function')
  const [language, setLanguage] = useState(lastLanguage)
  const [filePath, setFilePath] = useState('')
  const [lineStart, setLineStart] = useState('')
  const [lineEnd, setLineEnd] = useState('')
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState('')
  const [status, setStatus] = useState<NodeStatus>('confirmed')
  const [selectedCallees, setSelectedCallees] = useState<Set<string>>(new Set())
  const [selectedBranches, setSelectedBranches] = useState<Set<number>>(new Set())
  const [detection, setDetection] = useState(detectCode(''))
  const [dupWarning, setDupWarning] = useState(false)

  // ── Multi-function preview state ──
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])

  // Seed language from store on open
  useEffect(() => {
    if (open) {
      setCode(''); setLabel(''); setKind('function'); setLanguage(lastLanguage)
      setFilePath(''); setLineStart(''); setLineEnd(''); setNotes(''); setTags('')
      setStatus('confirmed'); setSelectedCallees(new Set()); setSelectedBranches(new Set())
      setDetection(detectCode('')); setDupWarning(false); setStep('paste'); setPreviewRows([])
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const runDetection = useCallback(
    (value: string) => {
      const result = detectCode(value)
      setDetection(result)
      if (!label) setLabel(result.suggestedLabel)
      setKind(result.suggestedKind)
      if (result.confidence >= 5 && result.language !== 'plaintext') setLanguage(result.language)
      if (result.filePath) setFilePath(result.filePath)
      if (result.lineRange) { setLineStart(String(result.lineRange[0])); setLineEnd(String(result.lineRange[1])) }
      const hash = hashCode(value)
      setDupWarning(nodes.some((n) => (n.data as { contentHash?: string }).contentHash === hash))
    },
    [label, nodes],
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

  const handleLanguageChange = (lang: string) => { setLanguage(lang); setLastLanguage(lang) }

  const toggleCallee = (name: string) => setSelectedCallees((prev) => {
    const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next
  })
  const toggleBranch = (idx: number) => setSelectedBranches((prev) => {
    const next = new Set(prev); next.has(idx) ? next.delete(idx) : next.add(idx); return next
  })

  const goToPreview = () => {
    const fns = extractFunctions(code, language)
    setPreviewRows(fns.map((fn) => ({ fn, tempId: nanoid(), label: fn.label || 'unlabelled', kind: fn.kind, included: true })))
    setStep('preview')
  }

  const extractedCount = code.trim() ? extractFunctions(code, language).length : 0
  const isMulti = extractedCount > 1

  // ── Submit single ──
  const handleSubmitSingle = () => {
    const nodeId = nanoid()
    const parentNode = parentId ? nodes.find((n) => n.id === parentId) : null
    const offsetX = parentNode ? parentNode.position.x + 280 : 100 + Math.random() * 200
    const offsetY = parentNode ? parentNode.position.y + 150 : 100 + Math.random() * 200

    commitSnippet(
      {
        id: nodeId, label: label || detection.suggestedLabel || 'unlabelled', kind, language, code,
        filePath: filePath || undefined,
        lineRange: lineStart ? [parseInt(lineStart, 10), parseInt(lineEnd || lineStart, 10)] : undefined,
        notes: notes || undefined, tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        status, isAsync: detection.isAsync, contentHash: hashCode(code),
        position: { x: offsetX, y: offsetY },
      },
      parentId ?? null,
      Array.from(selectedCallees),
    )

    selectedBranches.forEach((idx) => {
      const b = detection.detectedBranches[idx]
      if (b) addBranchNode({ parentNodeId: nodeId, condition: b.condition, thenCallees: b.thenCallees, elseCallees: b.elseCallees, position: { x: offsetX + 280, y: offsetY + idx * 160 } })
    })

    setLastLanguage(language)
    closeModal()
  }

  // ── Submit multi ──
  const handleSubmitMulti = () => {
    const includedRows = previewRows.filter((r) => r.included)
    if (includedRows.length === 0) return
    const parentNode = parentId ? nodes.find((n) => n.id === parentId) : null
    const baseX = parentNode ? parentNode.position.x + 280 : 120 + Math.random() * 100
    const baseY = parentNode ? parentNode.position.y : 120 + Math.random() * 100
    const COLS = 3

    const flowNodes = includedRows.map((row, i) => ({
      id: row.tempId, label: row.label, kind: row.kind, language, code: row.fn.code,
      tags: [], status: 'confirmed' as NodeStatus, isAsync: row.fn.isAsync,
      contentHash: hashCode(row.fn.code),
      position: { x: baseX + (i % COLS) * 300, y: baseY + Math.floor(i / COLS) * 200 },
    }))

    const labelToId = new Map(includedRows.map((r) => [r.label, r.tempId]))
    const internalEdges: FlowEdge[] = buildInternalEdges(includedRows.map((r) => ({ ...r.fn, label: r.label })))
      .filter((e) => labelToId.has(e.source) && labelToId.has(e.target))
      .map((e) => ({ id: nanoid(), source: labelToId.get(e.source)!, target: labelToId.get(e.target)!, kind: 'calls', confidence: 'suspected' }))

    commitMultiSnippet(flowNodes, internalEdges, parentId ?? null)
    setLastLanguage(language)
    closeModal()
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: preview step
  // ─────────────────────────────────────────────────────────────────────────────

  if (step === 'preview') {
    const includedCount = previewRows.filter((r) => r.included).length
    const internalEdges = buildInternalEdges(previewRows.filter((r) => r.included).map((r) => ({ ...r.fn, label: r.label })))
    return (
      <Modal open={open} onClose={closeModal} title={`Review ${extractedCount} Detected Functions`} width="760px">
        <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '70vh', overflow: 'auto' }}>
          <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--color-border)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
            Uncheck functions you don't want to add. Labels and kinds are editable.
          </div>
          {previewRows.map((row, i) => {
            const color = KIND_COLORS[row.kind] ?? '#475569'
            return (
              <div key={row.tempId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 16px', borderBottom: '1px solid var(--color-border)', opacity: row.included ? 1 : 0.4, background: i % 2 === 0 ? 'transparent' : 'var(--color-bg-primary)' }}>
                <input type="checkbox" checked={row.included} onChange={() => setPreviewRows((p) => p.map((r, j) => j === i ? { ...r, included: !r.included } : r))} style={{ accentColor: 'var(--color-accent)' }} />
                <span style={{ flexShrink: 0, fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'ui-monospace, monospace', minWidth: '60px' }}>L{row.fn.lineRange[0]}–{row.fn.lineRange[1]}</span>
                <input style={{ ...inputStyle, flex: 1, padding: '5px 8px' }} value={row.label} disabled={!row.included} onChange={(e) => setPreviewRows((p) => p.map((r, j) => j === i ? { ...r, label: e.target.value } : r))} />
                <select style={{ ...inputStyle, width: 128, padding: '5px 8px', fontSize: '12px', color }} value={row.kind} disabled={!row.included} onChange={(e) => setPreviewRows((p) => p.map((r, j) => j === i ? { ...r, kind: e.target.value as NodeKind } : r))}>
                  {NODE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
                {row.fn.callees.length > 0 && <span style={{ flexShrink: 0, fontSize: '11px', color: 'var(--color-text-muted)' }}>{row.fn.callees.length}c</span>}
                {row.fn.isAsync && <Zap size={12} color="#f59e0b" />}
              </div>
            )
          })}
          {internalEdges.length > 0 && (
            <div style={{ padding: '8px 16px', fontSize: '11px', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
              <strong>Internal links: </strong>
              {internalEdges.map((e, i) => <span key={i} style={{ marginRight: '8px', fontFamily: 'ui-monospace, monospace' }}>{e.source}→{e.target}</span>)}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px' }}>
            <button onClick={() => setStep('paste')} style={{ padding: '7px 14px', background: 'none', border: '1px solid var(--color-border)', borderRadius: '7px', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '13px' }}>← Back</button>
            <button disabled={includedCount === 0} onClick={handleSubmitMulti} style={{ padding: '8px 20px', background: 'var(--color-accent)', border: 'none', borderRadius: '7px', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: includedCount > 0 ? 'pointer' : 'not-allowed', opacity: includedCount > 0 ? 1 : 0.5 }}>
              Add {includedCount} Node{includedCount !== 1 ? 's' : ''} to Graph
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: paste step
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <Modal open={open} onClose={closeModal} title="Add Node" width="820px">
      <div style={{ display: 'flex', height: 'min(75vh, 620px)' }}>
        {/* Left: code editor */}
        <div style={{ flex: '1 1 55%', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--color-border)' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ ...labelStyle, marginBottom: 0 }}>Code</span>
            {detection.isAsync && <Zap size={13} color="#f59e0b" />}
            {dupWarning && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b', fontSize: '11px' }}><AlertTriangle size={12} /> Duplicate</span>}
            {isMulti && <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--color-accent)', fontWeight: 600 }}>{extractedCount} functions detected</span>}
          </div>
          <div style={{ flex: 1 }}>
            <Editor height="100%" language={language} value={code} onChange={handleCodeChange} theme="vs-dark"
              options={{ fontSize: 13, minimap: { enabled: false }, scrollBeyondLastLine: false, wordWrap: 'on', lineNumbers: 'on', padding: { top: 12 } }} />
          </div>
        </div>

        {/* Right: metadata */}
        <div style={{ flex: '0 0 320px', overflow: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Label</label>
            <input style={inputStyle} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={detection.suggestedLabel || 'Function / class name'} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={labelStyle}>Kind</label>
              <select style={inputStyle} value={kind} onChange={(e) => setKind(e.target.value as NodeKind)}>
                {NODE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Language</label>
              <select style={inputStyle} value={language} onChange={(e) => handleLanguageChange(e.target.value)}>
                {SUPPORTED_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>File Path</label>
            <input style={inputStyle} value={filePath} onChange={(e) => setFilePath(e.target.value)} placeholder="src/services/Order.java" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><label style={labelStyle}>Line Start</label><input style={inputStyle} type="number" value={lineStart} onChange={(e) => setLineStart(e.target.value)} placeholder="1" /></div>
            <div><label style={labelStyle}>Line End</label><input style={inputStyle} type="number" value={lineEnd} onChange={(e) => setLineEnd(e.target.value)} placeholder="50" /></div>
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value as NodeStatus)}>
              {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Tags</label>
            <input style={inputStyle} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="auth, payment" />
          </div>
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea style={{ ...inputStyle, height: '56px', resize: 'vertical', fontFamily: 'inherit' }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Markdown supported…" />
          </div>

          {/* Callees — single mode only */}
          {!isMulti && detection.detectedCallees.length > 0 && (
            <div>
              <label style={labelStyle}>Calls → Stubs</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '110px', overflow: 'auto' }}>
                {detection.detectedCallees.map((name) => (
                  <label key={name} style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '12px', color: 'var(--color-text)' }}>
                    <input type="checkbox" checked={selectedCallees.has(name)} onChange={() => toggleCallee(name)} style={{ accentColor: KIND_COLORS.stub }} />
                    <code style={{ fontFamily: 'ui-monospace, monospace' }}>{name}()</code>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Branch nodes — single mode only */}
          {!isMulti && detection.detectedBranches.length > 0 && (
            <div>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <GitBranch size={11} /> Branch nodes
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '120px', overflow: 'auto' }}>
                {detection.detectedBranches.map((b, i) => (
                  <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', cursor: 'pointer', fontSize: '12px', color: 'var(--color-text)' }}>
                    <input type="checkbox" checked={selectedBranches.has(i)} onChange={() => toggleBranch(i)} style={{ marginTop: '2px', accentColor: '#f59e0b' }} />
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
            {detection.hasSQL && <span style={{ background: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b44', borderRadius: '4px', fontSize: '10px', padding: '2px 7px' }}>SQL</span>}
            {detection.hasHTTP && <span style={{ background: '#06b6d422', color: '#06b6d4', border: '1px solid #06b6d444', borderRadius: '4px', fontSize: '10px', padding: '2px 7px' }}>HTTP</span>}
            {detection.hasEvents && <span style={{ background: '#ec489922', color: '#ec4899', border: '1px solid #ec489944', borderRadius: '4px', fontSize: '10px', padding: '2px 7px' }}>Events</span>}
          </div>

          {isMulti ? (
            <button onClick={goToPreview} style={{ marginTop: 'auto', padding: '10px', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: '7px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              Review {extractedCount} Functions <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={handleSubmitSingle} style={{ marginTop: 'auto', padding: '10px', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: '7px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
              Add to Graph
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

