import type { Flow, FlowSummary } from '@scf/shared';

const BASE = '/api';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    const err = new Error(body.error ?? `HTTP ${res.status}`);
    (err as Error & { status: number }).status = res.status;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  listFlows: () => request<FlowSummary[]>('/flows'),
  getFlow: (id: string) => request<Flow>(`/flows/${id}`),
  createFlow: (data: { name: string; description?: string; tags?: string[] }) =>
    request<Flow>('/flows', { method: 'POST', body: JSON.stringify(data) }),
  updateFlow: (id: string, flow: Flow) =>
    request<Flow>(`/flows/${id}`, { method: 'PUT', body: JSON.stringify(flow) }),
  deleteFlow: (id: string) => request<void>(`/flows/${id}`, { method: 'DELETE' }),
};
