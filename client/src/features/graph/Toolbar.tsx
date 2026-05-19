import { useReactFlow } from '@xyflow/react';
import { LayoutDashboard, Link, Download, ChevronDown, ListChecks, CloudOff, Cloud, Loader, AlertCircle } from 'lucide-react';
import type { ReactElement } from 'react';
import { useState, useRef } from 'react';
import { useFlowStore, type SaveStatus } from '../../store/flowStore.ts';
import { useUIStore } from '../../store/uiStore.ts';
import { applyDagreLayout } from '../../lib/layout/index.ts';
import { exportAsJSON, exportAsPNG, exportAsMarkdown, exportAsMermaid } from '../export/exportUtils.ts';
import { api } from '../../lib/api.ts';
import type { Flow } from '@scf/shared';

const SAVE_STATUS_UI: Record<SaveStatus, { icon: ReactElement; label: string; color: string }> = {
  idle: { icon: <Cloud size={13} />, label: 'Saved', color: 'var(--color-text-muted)' },
  saving: { icon: <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} />, label: 'Saving…', color: 'var(--color-text-muted)' },
  saved: { icon: <Cloud size={13} />, label: 'Saved', color: 'var(--color-success)' },
  error: { icon: <CloudOff size={13} />, label: 'Save failed', color: 'var(--color-danger)' },
  conflict: { icon: <AlertCircle size={13} />, label: 'Conflict!', color: 'var(--color-warning)' },
};

interface Props {
  flowId: string;
  flowName: string;
  onNameChange: (name: string) => void;
}

export function Toolbar({ flowId, flowName, onNameChange }: Props) {
  const { getNodes, getEdges, setNodes } = useReactFlow();
  const storeSetNodes = useFlowStore((s) => s.setNodes);
  const openSnippetModal = useUIStore((s) => s.openSnippetModal);
  const todoOpen = useUIStore((s) => s.todoOpen);
  const setTodoOpen = useUIStore((s) => s.setTodoOpen);
  const saveStatus = useFlowStore((s) => s.saveStatus);
  const saveError = useFlowStore((s) => s.saveError);
  const flow = useFlowStore((s) => s.flow);
  const save = useFlowStore((s) => s.save);

  const [exportOpen, setExportOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(flowName);
  const exportRef = useRef<HTMLDivElement>(null);

  const handleAutoLayout = () => {
    const layouted = applyDagreLayout(getNodes(), getEdges());
    setNodes(layouted);
    storeSetNodes(layouted);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
  };

  const handleExport = async (type: 'json' | 'png' | 'md' | 'mermaid') => {
    if (!flow) return;
    setExportOpen(false);
    const nodes = getNodes();
    const edges = getEdges();
    if (type === 'json') exportAsJSON(flow);
    if (type === 'png') await exportAsPNG();
    if (type === 'md') exportAsMarkdown(flow, nodes, edges);
    if (type === 'mermaid') exportAsMermaid(flow, nodes, edges);
  };

  const statusUi = SAVE_STATUS_UI[saveStatus];

  return (
    <div style={{
      height: '52px', flexShrink: 0,
      background: 'var(--color-bg-secondary)',
      borderBottom: '1px solid var(--color-border)',
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '0 16px',
    }}>
      {/* Back */}
      <a href="/flows" style={{ color: 'var(--color-text-muted)', fontSize: '13px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
        ← Flows
      </a>

      <div style={{ width: '1px', height: '20px', background: 'var(--color-border)', margin: '0 4px' }} />

      {/* Flow name */}
      {editingName ? (
        <input
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          onBlur={() => { setEditingName(false); if (nameValue.trim()) onNameChange(nameValue.trim()); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { setEditingName(false); if (nameValue.trim()) onNameChange(nameValue.trim()); } if (e.key === 'Escape') { setEditingName(false); setNameValue(flowName); } }}
          autoFocus
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-accent)', borderRadius: '5px', color: 'var(--color-text)', fontSize: '14px', fontWeight: 600, padding: '3px 8px', outline: 'none', maxWidth: '260px' }}
        />
      ) : (
        <span
          onClick={() => { setEditingName(true); setNameValue(flowName); }}
          title="Click to rename"
          style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', cursor: 'text', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {flowName}
        </span>
      )}

      <div style={{ flex: 1 }} />

      {/* Save status */}
      <div
        onClick={saveStatus === 'conflict' ? () => window.location.reload() : saveStatus === 'error' ? () => save() : undefined}
        style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: statusUi.color, cursor: saveStatus === 'conflict' || saveStatus === 'error' ? 'pointer' : 'default' }}
        title={saveError ?? undefined}
      >
        {statusUi.icon} {statusUi.label}
        {saveStatus === 'conflict' && <span style={{ fontSize: '11px' }}>(click to reload)</span>}
      </div>

      <div style={{ width: '1px', height: '20px', background: 'var(--color-border)', margin: '0 4px' }} />

      {/* TODO toggle */}
      <button
        onClick={() => setTodoOpen(!todoOpen)}
        title="TODO / Stubs panel"
        style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 10px', background: todoOpen ? 'var(--color-accent)22' : 'none', border: todoOpen ? '1px solid var(--color-accent)44' : '1px solid transparent', borderRadius: '6px', color: todoOpen ? 'var(--color-accent)' : 'var(--color-text-muted)', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}
      >
        <ListChecks size={14} /> TODO
      </button>

      {/* Add node */}
      <button
        onClick={() => openSnippetModal()}
        style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', background: 'var(--color-accent)', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
      >
        + Add Node
      </button>

      {/* Auto layout */}
      <button
        onClick={handleAutoLayout}
        title="Auto layout"
        style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 10px', background: 'none', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '12px' }}
      >
        <LayoutDashboard size={14} />
      </button>

      {/* Share */}
      <button
        onClick={handleCopyLink}
        title="Copy share link"
        style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 10px', background: 'none', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '12px' }}
      >
        <Link size={14} />
      </button>

      {/* Export */}
      <div ref={exportRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setExportOpen((v) => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 10px', background: 'none', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '12px' }}
        >
          <Download size={14} /> <ChevronDown size={12} />
        </button>
        {exportOpen && (
          <div style={{ position: 'absolute', right: 0, top: '110%', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '6px', zIndex: 100, minWidth: '140px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
            {(['json', 'png', 'md', 'mermaid'] as const).map((type) => (
              <button
                key={type}
                onClick={() => handleExport(type)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', color: 'var(--color-text)', cursor: 'pointer', borderRadius: '5px', fontSize: '13px' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                {type === 'json' ? 'JSON (backup)' : type === 'png' ? 'PNG (image)' : type === 'md' ? 'Markdown report' : 'Mermaid diagram'}
              </button>
            ))}
            <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '4px 0' }} />
            <label
              style={{ display: 'block', padding: '8px 12px', color: 'var(--color-accent)', cursor: 'pointer', borderRadius: '5px', fontSize: '13px' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              Import JSON
              <input type="file" accept=".json" style={{ display: 'none' }} onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setExportOpen(false);
                const text = await file.text();
                try {
                  const data = JSON.parse(text);
                  const imported = await api_import(data, flowId);
                  if (imported) window.location.reload();
                } catch {
                  alert('Invalid JSON file');
                }
              }} />
            </label>
          </div>
        )}
      </div>
      {/* CSS for spin animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// inline import helper
async function api_import(data: unknown, flowId: string): Promise<boolean> {
  const flowVersion = useFlowStore.getState().flow?.version ?? 1;
  try {
    const payload = data as Record<string, unknown>;
    await api.updateFlow(flowId, { ...payload, id: flowId, version: flowVersion } as Flow);
    return true;
  } catch {
    alert('Import failed: version conflict or invalid data. Try reloading first.');
    return false;
  }
}
