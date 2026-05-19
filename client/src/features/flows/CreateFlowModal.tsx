import { useState } from 'react'
import { Modal } from '../../components/Modal.tsx'
import { api } from '../../lib/api.ts'

interface Props {
  open: boolean
  onClose: () => void
  onCreate: (id: string) => void
}

export function CreateFlowModal({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    setLoading(true)
    setError('')
    try {
      const flow = await api.createFlow({
        name: name.trim(),
        description: description.trim() || undefined,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      })
      setName(''); setDescription(''); setTags('')
      onCreate(flow.id)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px',
    background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)',
    borderRadius: '6px', color: 'var(--color-text)', fontSize: '14px', outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '12px', fontWeight: 600,
    color: 'var(--color-text-muted)', textTransform: 'uppercase',
    letterSpacing: '0.06em', marginBottom: '6px',
  }

  return (
    <Modal open={open} onClose={onClose} title="New Flow">
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={labelStyle}>Name *</label>
          <input
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
            placeholder="Legacy Order Processing"
            autoFocus
          />
        </div>
        <div>
          <label style={labelStyle}>Description</label>
          <textarea
            style={{ ...inputStyle, height: '80px', resize: 'vertical', fontFamily: 'inherit' }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this flow…"
          />
        </div>
        <div>
          <label style={labelStyle}>Tags (comma separated)</label>
          <input style={inputStyle} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="payments, auth, v1" />
        </div>
        {error && <p style={{ margin: 0, color: 'var(--color-danger)', fontSize: '13px' }}>{error}</p>}
        <button
          onClick={handleCreate}
          disabled={loading}
          style={{
            padding: '10px', background: loading ? '#4f46e5aa' : 'var(--color-accent)',
            color: '#fff', border: 'none', borderRadius: '7px',
            fontWeight: 600, fontSize: '14px', cursor: loading ? 'default' : 'pointer',
          }}
        >
          {loading ? 'Creating…' : 'Create Flow'}
        </button>
      </div>
    </Modal>
  )
}
