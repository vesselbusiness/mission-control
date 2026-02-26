/**
 * GET /api/metrics/snapshot  — latest metrics snapshot
 * POST /api/metrics/snapshot — save a daily snapshot
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

const CreateSnapshotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  mrr: z.number().nullable().optional(),
  active_members: z.number().int().nullable().optional(),
  new_members: z.number().int().nullable().optional(),
  churned_members: z.number().int().nullable().optional(),
  mate_launches: z.number().int().nullable().optional(),
  mtm_waitlist: z.number().int().nullable().optional(),
  wins_count: z.number().int().nullable().optional(),
  friction_open: z.number().int().nullable().optional(),
  stripe_payout_pending: z.number().nullable().optional(),
});

export async function GET() {
  try {
    init();
    const db = getVesselDb();

    const snapshot = db.prepare(
      'SELECT * FROM metrics_snapshots ORDER BY date DESC, created_at DESC LIMIT 1'
    ).get();

    if (!snapshot) {
      return NextResponse.json({ snapshot: null });
    }

    return NextResponse.json({ snapshot });
  } catch (error) {
    console.error('[metrics/snapshot] GET failed:', error);
    return NextResponse.json({ error: 'Failed to fetch snapshot' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    init();
    const db = getVesselDb();
    const body: unknown = await request.json();

    const parsed = CreateSnapshotSchema.safeParse(body);
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
      INSERT INTO metrics_snapshots (id, date, mrr, active_members, new_members, churned_members, mate_launches, mtm_waitlist, wins_count, friction_open, stripe_payout_pending, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.date,
      data.mrr ?? null,
      data.active_members ?? null,
      data.new_members ?? null,
      data.churned_members ?? null,
      data.mate_launches ?? null,
      data.mtm_waitlist ?? null,
      data.wins_count ?? null,
      data.friction_open ?? null,
      data.stripe_payout_pending ?? null,
      now
    );

    const snapshot = db.prepare('SELECT * FROM metrics_snapshots WHERE id = ?').get(id);
    return NextResponse.json(snapshot, { status: 201 });
  } catch (error) {
    console.error('[metrics/snapshot] POST failed:', error);
    return NextResponse.json({ error: 'Failed to save snapshot' }, { status: 500 });
  }
}
