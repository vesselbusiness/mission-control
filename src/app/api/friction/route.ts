/**
 * GET /api/friction  — list friction log entries with optional filters
 * POST /api/friction — log a new friction entry
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

const CreateFrictionSchema = z.object({
  student_id: z.string().nullable().optional(),
  issue_title: z.string().min(1, 'issue_title is required'),
  description: z.string().min(1, 'description is required'),
  tool_involved: z.string().nullable().optional(),
  phase: z.enum(['mate_build', 'icp', 'vsl', 'community', 'technical', 'other']).nullable().optional(),
  priority: z.enum(['high', 'medium', 'low']),
  status: z.enum(['open', 'in_progress', 'resolved']).optional().default('open'),
  occurrence_count: z.number().int().min(1).optional().default(1),
  suggested_fix: z.string().nullable().optional(),
  module_to_update: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  try {
    init();
    const db = getVesselDb();
    const { searchParams } = new URL(request.url);

    const priority = searchParams.get('priority');
    const status = searchParams.get('status');
    const phase = searchParams.get('phase');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (priority) { conditions.push('priority = ?'); params.push(priority); }
    if (status) { conditions.push('status = ?'); params.push(status); }
    if (phase) { conditions.push('phase = ?'); params.push(phase); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const total = (db.prepare(`SELECT COUNT(*) as n FROM friction_log ${where}`).get(...params) as { n: number }).n;
    const rows = db.prepare(
      `SELECT * FROM friction_log ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    return NextResponse.json({ friction: rows, total, limit, offset, hasMore: offset + limit < total });
  } catch (error) {
    console.error('[friction] GET failed:', error);
    return NextResponse.json({ error: 'Failed to fetch friction log' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    init();
    const db = getVesselDb();
    const body: unknown = await request.json();

    const parsed = CreateFrictionSchema.safeParse(body);
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
      INSERT INTO friction_log (id, student_id, issue_title, description, tool_involved, phase, priority, status, occurrence_count, suggested_fix, module_to_update, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.student_id ?? null,
      data.issue_title,
      data.description,
      data.tool_involved ?? null,
      data.phase ?? null,
      data.priority,
      data.status,
      data.occurrence_count,
      data.suggested_fix ?? null,
      data.module_to_update ?? null,
      now
    );

    const entry = db.prepare('SELECT * FROM friction_log WHERE id = ?').get(id);
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error('[friction] POST failed:', error);
    return NextResponse.json({ error: 'Failed to log friction entry' }, { status: 500 });
  }
}
