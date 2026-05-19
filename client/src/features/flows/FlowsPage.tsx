import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, GitBranch, Trash2, Clock, Circle } from 'lucide-react'
import type { FlowSummary } from '@scf/shared'
import { api } from '../../lib/api.ts'
import { CreateFlowModal } from './CreateFlowModal.tsx'

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function FlowsPage() {
  const navigate = useNavigate()
  const [flows, setFlows] = useState<FlowSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadFlows = async () => {
    setLoading(true)
    setError('')
    try {
      setFlows(await api.listFlows())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadFlows() }, [])

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this flow? This cannot be undone.')) return
    setDeletingId(id)
    try {
      await api.deleteFlow(id)
      setFlows((prev) => prev.filter((f) => f.id !== id))
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div style={{ minHeight: '100%', background: 'var(--color-bg-primary)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '32px 40px 0', maxWidth: '960px', width: '100%', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <GitBranch size={28} color="var(--color-accent)" />
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'var(--color-text)' }}>Code Flows</h1>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '9px 18px', background: 'var(--color-accent)',
              color: '#fff', border: 'none', borderRadius: '8px',
              fontWeight: 600, fontSize: '14px', cursor: 'pointer',
            }}
          >
            <Plus size={16} /> New Flow
          </button>
        </div>
        <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '14px' }}>
          Visualise and document code flows from legacy systems.
        </p>
        <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '24px 0 0' }} />
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '24px 40px', maxWidth: '960px', width: '100%', margin: '0 auto' }}>
        {loading && (
          <div style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Loading…</div>
        )}
        {error && (
          <div style={{ color: 'var(--color-danger)', fontSize: '14px' }}>{error}
            <button onClick={loadFlows} style={{ marginLeft: '12px', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}>Retry</button>
          </div>
        )}
        {!loading && !error && flows.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: '80px', color: 'var(--color-text-muted)' }}>
            <GitBranch size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
            <p style={{ margin: 0, fontSize: '16px' }}>No flows yet.</p>
            <p style={{ margin: '8px 0 0', fontSize: '14px' }}>Create your first flow to start visualising code.</p>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {flows.map((flow) => (
            <div
              key={flow.id}
              onClick={() => navigate(`/flows/${flow.id}`)}
              style={{
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: '10px', padding: '20px',
                cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-accent)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 1px var(--color-accent)22'
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                  {flow.name}
                </h3>
                <button
                  onClick={(e) => handleDelete(flow.id, e)}
                  disabled={deletingId === flow.id}
                  title="Delete flow"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '2px', borderRadius: '4px', opacity: 0.6 }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {flow.description && (
                <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--color-text-muted)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {flow.description}
                </p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Circle size={10} /> {flow.nodeCount} node{flow.nodeCount !== 1 ? 's' : ''}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={10} /> {formatDate(flow.updatedAt)}
                </span>
              </div>
              {flow.tags.length > 0 && (
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '10px' }}>
                  {flow.tags.slice(0, 4).map((t) => (
                    <span key={t} style={{ background: 'var(--color-border)', color: 'var(--color-text-muted)', borderRadius: '3px', fontSize: '10px', padding: '1px 6px' }}>{t}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <CreateFlowModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(id) => { setCreateOpen(false); navigate(`/flows/${id}`) }}
      />
    </div>
  )
}
