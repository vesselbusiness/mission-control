/**
 * vessel-db.ts
 * Initializes and provides access to vessel.db and todos.db (SQLite).
 * Call getTodosDb() or getVesselDb() anywhere — lazy singleton pattern.
 */
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// ─── Paths ────────────────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), 'data');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// ─── Todos DB ─────────────────────────────────────────────────────────────────

let _todosDb: Database.Database | null = null;

export function getTodosDb(): Database.Database {
  if (_todosDb) return _todosDb;

  ensureDataDir();

  _todosDb = new Database(path.join(DATA_DIR, 'todos.db'));
  _todosDb.pragma('journal_mode = WAL');
  _todosDb.pragma('synchronous = NORMAL');

  _todosDb.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      assignee TEXT NOT NULL,
      priority TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      due_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      created_by TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_assignee ON todos(assignee);
    CREATE INDEX IF NOT EXISTS idx_status ON todos(status);
    CREATE INDEX IF NOT EXISTS idx_priority ON todos(priority);
  `);

  // Idempotent migration: add client_slug column if it doesn't exist yet
  const cols = _todosDb.pragma('table_info(todos)') as Array<{ name: string }>;
  if (!cols.some((c) => c.name === 'client_slug')) {
    _todosDb.exec(`
      ALTER TABLE todos ADD COLUMN client_slug TEXT DEFAULT NULL;
      CREATE INDEX IF NOT EXISTS idx_client_slug ON todos(client_slug);
    `);
  }

  return _todosDb;
}

// ─── Vessel DB ────────────────────────────────────────────────────────────────

let _vesselDb: Database.Database | null = null;

export function getVesselDb(): Database.Database {
  if (_vesselDb) return _vesselDb;

  ensureDataDir();

  _vesselDb = new Database(path.join(DATA_DIR, 'vessel.db'));
  _vesselDb.pragma('journal_mode = WAL');
  _vesselDb.pragma('synchronous = NORMAL');

  _vesselDb.exec(`
    -- Student wins feed
    CREATE TABLE IF NOT EXISTS wins (
      id TEXT PRIMARY KEY,
      student_name TEXT,
      win_text TEXT NOT NULL,
      category TEXT,
      source TEXT,
      posted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      featured BOOLEAN DEFAULT 0
    );

    -- Friction log (from Community Support agent)
    CREATE TABLE IF NOT EXISTS friction_log (
      id TEXT PRIMARY KEY,
      student_id TEXT,
      issue_title TEXT NOT NULL,
      description TEXT NOT NULL,
      tool_involved TEXT,
      phase TEXT,
      priority TEXT NOT NULL,
      status TEXT DEFAULT 'open',
      occurrence_count INTEGER DEFAULT 1,
      suggested_fix TEXT,
      module_to_update TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME
    );

    -- Business metrics snapshots (stored daily)
    CREATE TABLE IF NOT EXISTS metrics_snapshots (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      mrr REAL,
      active_members INTEGER,
      new_members INTEGER,
      churned_members INTEGER,
      mate_launches INTEGER,
      mtm_waitlist INTEGER,
      wins_count INTEGER,
      friction_open INTEGER,
      stripe_payout_pending REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_date ON metrics_snapshots(date);

    -- MTM launch tracker
    CREATE TABLE IF NOT EXISTS mtm_tracker (
      id TEXT PRIMARY KEY,
      item_name TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT DEFAULT 'not_started',
      owner TEXT,
      notes TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return _vesselDb;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type TodoAssignee = 'sarah' | 'bobby' | 'both';
export type TodoPriority = 'high' | 'medium' | 'low';
export type TodoStatus = 'open' | 'in_progress' | 'done';

export interface Todo {
  id: string;
  title: string;
  description: string | null;
  assignee: TodoAssignee;
  priority: TodoPriority;
  status: TodoStatus;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  created_by: string | null;
  client_slug: string | null;
}

export type WinCategory = 'first_client' | 'mate_launch' | 'revenue' | 'breakthrough' | 'other';
export type WinSource = 'discord' | 'email' | 'manual';

export interface Win {
  id: string;
  student_name: string | null;
  win_text: string;
  category: WinCategory | null;
  source: WinSource | null;
  posted_at: string;
  featured: number; // 0 | 1 (SQLite BOOLEAN)
}

export type FrictionPhase = 'mate_build' | 'icp' | 'vsl' | 'community' | 'technical' | 'other';
export type FrictionPriority = 'high' | 'medium' | 'low';
export type FrictionStatus = 'open' | 'in_progress' | 'resolved';

export interface FrictionEntry {
  id: string;
  student_id: string | null;
  issue_title: string;
  description: string;
  tool_involved: string | null;
  phase: FrictionPhase | null;
  priority: FrictionPriority;
  status: FrictionStatus;
  occurrence_count: number;
  suggested_fix: string | null;
  module_to_update: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface MetricsSnapshot {
  id: string;
  date: string;
  mrr: number | null;
  active_members: number | null;
  new_members: number | null;
  churned_members: number | null;
  mate_launches: number | null;
  mtm_waitlist: number | null;
  wins_count: number | null;
  friction_open: number | null;
  stripe_payout_pending: number | null;
  created_at: string;
}

export type MtmCategory = 'vsl' | 'copy' | 'landing_page' | 'email' | 'other';
export type MtmStatus = 'not_started' | 'in_progress' | 'done';

export interface MtmItem {
  id: string;
  item_name: string;
  category: MtmCategory;
  status: MtmStatus;
  owner: string | null;
  notes: string | null;
  updated_at: string;
}
