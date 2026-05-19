import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATA_DIR = process.env.DB_PATH
  ? path.dirname(process.env.DB_PATH)
  : path.resolve(__dirname, '../../data');

const FLOWS_FILE = path.join(DATA_DIR, 'flows.json');

export interface FlowRow {
  id: string;
  name: string;
  data: string;  // JSON-stringified Flow
  deleted: boolean;
  created_at: string;
  updated_at: string;
}

type Store = Record<string, FlowRow>;

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore(): Store {
  ensureDir();
  if (!fs.existsSync(FLOWS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(FLOWS_FILE, 'utf8')) as Store;
  } catch {
    return {};
  }
}

function writeStore(store: Store): void {
  ensureDir();
  const tmp = FLOWS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store), 'utf8');
  // Atomic rename (works on Windows too when dest exists)
  try { fs.unlinkSync(FLOWS_FILE); } catch { /* first write */ }
  fs.renameSync(tmp, FLOWS_FILE);
}

export const db = {
  getAll(): FlowRow[] {
    const store = readStore();
    return Object.values(store).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  },

  getOne(id: string): FlowRow | undefined {
    return readStore()[id];
  },

  insert(row: FlowRow): void {
    const store = readStore();
    store[row.id] = row;
    writeStore(store);
  },

  update(id: string, patch: Partial<FlowRow>): boolean {
    const store = readStore();
    if (!store[id]) return false;
    store[id] = { ...store[id], ...patch };
    writeStore(store);
    return true;
  },

  softDelete(id: string): boolean {
    return db.update(id, { deleted: true });
  },
};

