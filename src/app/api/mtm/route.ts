/**
 * GET /api/mtm  — all tracker items with completion percentage
 * POST /api/mtm — add a tracker item
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { getVesselDb } from '@/lib/vessel-db';
import { seedVesselData } from '@/lib/seed-vessel';

let initialized = false;
function init() {
  if (initialized) return;
  initialized = true;
  getVesselDb();
  seedVesselData();
}

const CreateMtmSchema = z.object({
  item_name: z.string().min(1, 'item_name is required'),
  category: z.enum(['vsl', 'copy', 'landing_page', 'email', 'other']),
  status: z.enum(['not_started', 'in_progress', 'done']).optional().default('not_started'),
  owner: z.enum(['sarah', 'bobby', 'agent']).nullable().optional(),
  notes: z.string().nullable().optional(),
});

interface MtmRow {
  id: string;
  item_name: string;
  category: string;
  status: string;
  owner: string | null;
  notes: string | null;
  updated_at: string;
}

function computeCompletion(rows: MtmRow[]) {
  if (rows.length === 0) return 0;
  const done = rows.filter((r) => r.status === 'done').length;
  return Math.round((done / rows.length) * 100);
}

export async function GET(request: NextRequest) {
  try {
    init();
    const db = getVesselDb();
    const { searchParams } = new URL(request.url);

    const category = searchParams.get('category');
    const status = searchParams.get('status');

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (category) { conditions.push('category = ?'); params.push(category); }
    if (status) { conditions.push('status = ?'); params.push(status); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = db.prepare(
      `SELECT * FROM mtm_tracker ${where} ORDER BY updated_at DESC`
    ).all(...params) as MtmRow[];

    // All items (for global completion %)
    const all = db.prepare('SELECT * FROM mtm_tracker').all() as MtmRow[];
    const completionPct = computeCompletion(all);

    // By category breakdown
    const categoryRows = db.prepare(
      "SELECT category, status, COUNT(*) as n FROM mtm_tracker GROUP BY category, status"
    ).all() as Array<{ category: string; status: string; n: number }>;

    const byCategory: Record<string, { total: number; done: number; pct: number }> = {};
    for (const r of categoryRows) {
      if (!byCategory[r.category]) byCategory[r.category] = { total: 0, done: 0, pct: 0 };
      byCategory[r.category].total += r.n;
      if (r.status === 'done') byCategory[r.category].done += r.n;
    }
    for (const cat of Object.keys(byCategory)) {
      const c = byCategory[cat];
      c.pct = c.total > 0 ? Math.round((c.done / c.total) * 100) : 0;
    }

    return NextResponse.json({
      items: rows,
      total: all.length,
      completionPct,
      byCategory,
    });
  } catch (error) {
    console.error('[mtm] GET failed:', error);
    return NextResponse.json({ error: 'Failed to fetch MTM tracker' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    init();
    const db = getVesselDb();
    const body: unknown = await request.json();

    const parsed = CreateMtmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const id = randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO mtm_tracker (id, item_name, category, status, owner, notes, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.item_name, data.category, data.status, data.owner ?? null, data.notes ?? null, now);

    const item = db.prepare('SELECT * FROM mtm_tracker WHERE id = ?').get(id);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('[mtm] POST failed:', error);
    return NextResponse.json({ error: 'Failed to add MTM item' }, { status: 500 });
  }
}
