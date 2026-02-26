/**
 * GET /api/wins  — list wins with optional filters
 * POST /api/wins — log a new student win
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

const CreateWinSchema = z.object({
  student_name: z.string().nullable().optional(),
  win_text: z.string().min(1, 'win_text is required'),
  category: z.enum(['first_client', 'mate_launch', 'revenue', 'breakthrough', 'other']).nullable().optional(),
  source: z.enum(['discord', 'email', 'manual']).nullable().optional(),
  featured: z.boolean().optional().default(false),
});

export async function GET(request: NextRequest) {
  try {
    init();
    const db = getVesselDb();
    const { searchParams } = new URL(request.url);

    const featured = searchParams.get('featured');
    const category = searchParams.get('category');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (featured === 'true') {
      conditions.push('featured = 1');
    }
    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const total = (db.prepare(`SELECT COUNT(*) as n FROM wins ${where}`).get(...params) as { n: number }).n;
    const rows = db.prepare(`SELECT * FROM wins ${where} ORDER BY posted_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);

    return NextResponse.json({ wins: rows, total, limit, offset, hasMore: offset + limit < total });
  } catch (error) {
    console.error('[wins] GET failed:', error);
    return NextResponse.json({ error: 'Failed to fetch wins' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    init();
    const db = getVesselDb();
    const body: unknown = await request.json();

    const parsed = CreateWinSchema.safeParse(body);
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
      INSERT INTO wins (id, student_name, win_text, category, source, posted_at, featured)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.student_name ?? null,
      data.win_text,
      data.category ?? null,
      data.source ?? null,
      now,
      data.featured ? 1 : 0
    );

    const win = db.prepare('SELECT * FROM wins WHERE id = ?').get(id);
    return NextResponse.json(win, { status: 201 });
  } catch (error) {
    console.error('[wins] POST failed:', error);
    return NextResponse.json({ error: 'Failed to log win' }, { status: 500 });
  }
}
