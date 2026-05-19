import { Router } from 'express';
import { nanoid } from 'nanoid';
import { db } from '../db.js';
import type { Flow, FlowSummary } from '@scf/shared';

export const flowsRouter = Router();

const MAX_CODE_BYTES = 200_000; // 200 KB per node

function validatePayloadSize(flow: Flow): void {
  for (const node of flow.nodes) {
    if (Buffer.byteLength(node.code, 'utf8') > MAX_CODE_BYTES) {
      throw new Error(`Node "${node.label}" exceeds the 200 KB code size limit.`);
    }
  }
}

// GET /api/flows — list summaries
flowsRouter.get('/', (_req, res) => {
  const rows = db.getAll().filter((r) => !r.deleted);
  const summaries: FlowSummary[] = rows.map((r) => {
    const flow = JSON.parse(r.data) as Flow;
    return {
      id: r.id,
      name: flow.name,
      description: flow.description,
      tags: flow.tags,
      nodeCount: flow.nodes.length,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });
  res.json(summaries);
});

// GET /api/flows/:id — full flow
flowsRouter.get('/:id', (req, res) => {
  const row = db.getOne(req.params.id);
  if (!row || row.deleted) {
    res.status(404).json({ error: 'Flow not found' });
    return;
  }
  res.json(JSON.parse(row.data));
});

// POST /api/flows — create
flowsRouter.post('/', (req, res) => {
  const body = req.body as Partial<Flow>;
  const now = new Date().toISOString();
  const id = nanoid();

  const flow: Flow = {
    id,
    name: (body.name ?? 'Untitled Flow').slice(0, 200),
    description: body.description?.slice(0, 1000),
    tags: Array.isArray(body.tags) ? body.tags.slice(0, 20) : [],
    nodes: [],
    edges: [],
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  db.insert({ id, name: flow.name, data: JSON.stringify(flow), deleted: false, created_at: now, updated_at: now });
  res.status(201).json(flow);
});

// PUT /api/flows/:id — update with optimistic concurrency
flowsRouter.put('/:id', (req, res) => {
  const incoming = req.body as Flow;
  const row = db.getOne(req.params.id);

  if (!row || row.deleted) {
    res.status(404).json({ error: 'Flow not found' });
    return;
  }

  const stored = JSON.parse(row.data) as Flow;

  if (stored.version !== incoming.version) {
    res.status(409).json({
      error: 'Conflict: this flow was updated by someone else. Please reload.',
      serverVersion: stored.version,
    });
    return;
  }

  try {
    validatePayloadSize(incoming);
  } catch (e) {
    res.status(413).json({ error: (e as Error).message });
    return;
  }

  const now = new Date().toISOString();
  const updated: Flow = {
    ...incoming,
    id: req.params.id,
    version: stored.version + 1,
    createdAt: stored.createdAt,
    updatedAt: now,
  };

  db.update(req.params.id, { name: updated.name, data: JSON.stringify(updated), updated_at: now });
  res.json(updated);
});

// DELETE /api/flows/:id — soft delete
flowsRouter.delete('/:id', (req, res) => {
  const ok = db.softDelete(req.params.id);
  if (!ok) {
    res.status(404).json({ error: 'Flow not found' });
    return;
  }
  res.status(204).end();
});

