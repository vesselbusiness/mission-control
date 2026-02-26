/**
 * GET /api/todos  — list todos with optional filters
 * POST /api/todos — create a new todo
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { getTodosDb } from '@/lib/vessel-db';
import { seedVesselData } from '@/lib/seed-vessel';

// Ensure DB + seed on first access
let initialized = false;
function init() {
  if (initialized) return;
  initialized = true;
  getTodosDb(); // creates the DB + tables
  seedVesselData();
}

// ─── Validators ───────────────────────────────────────────────────────────────

const CreateTodoSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  assignee: z.enum(['sarah', 'bobby', 'both', 'client']),
  priority: z.enum(['high', 'medium', 'low']),
  status: z.enum(['open', 'in_progress', 'done']).optional().default('open'),
  due_date: z.string().nullable().optional(),
  created_by: z.enum(['sarah', 'bobby', 'agent']).optional(),
  client_slug: z.string().nullable().optional(),
});

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    init();
    const db = getTodosDb();
    const { searchParams } = new URL(request.url);

    const assignee = searchParams.get('assignee');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const clientSlug = searchParams.get('client_slug');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (assignee) {
      conditions.push('assignee = ?');
      params.push(assignee);
    }
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (priority) {
      conditions.push('priority = ?');
      params.push(priority);
    }
    if (clientSlug) {
      conditions.push('client_slug = ?');
      params.push(clientSlug);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const total = (db.prepare(`SELECT COUNT(*) as n FROM todos ${where}`).get(...params) as { n: number }).n;
    const rows = db.prepare(`SELECT * FROM todos ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);

    return NextResponse.json({
      todos: rows,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    console.error('[todos] GET failed:', error);
    return NextResponse.json({ error: 'Failed to fetch todos' }, { status: 500 });
  }
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    init();
    const db = getTodosDb();
    const body: unknown = await request.json();

    const parsed = CreateTodoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const now = new Date().toISOString();
    const id = randomUUID();

    db.prepare(`
      INSERT INTO todos (id, title, description, assignee, priority, status, due_date, created_at, updated_at, created_by, client_slug)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.title,
      data.description ?? null,
      data.assignee,
      data.priority,
      data.status,
      data.due_date ?? null,
      now,
      now,
      data.created_by ?? null,
      data.client_slug ?? null
    );

    const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
    return NextResponse.json(todo, { status: 201 });
  } catch (error) {
    console.error('[todos] POST failed:', error);
    return NextResponse.json({ error: 'Failed to create todo' }, { status: 500 });
  }
}
