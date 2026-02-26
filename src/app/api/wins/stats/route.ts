/**
 * GET /api/wins/stats — win counts by category, weekly and monthly totals
 */
import { NextResponse } from 'next/server';
import { getVesselDb } from '@/lib/vessel-db';

export async function GET() {
  try {
    const db = getVesselDb();

    const total = (db.prepare('SELECT COUNT(*) as n FROM wins').get() as { n: number }).n;
    const featured = (db.prepare('SELECT COUNT(*) as n FROM wins WHERE featured = 1').get() as { n: number }).n;

    // By category
    const categoryRows = db.prepare(
      "SELECT category, COUNT(*) as n FROM wins GROUP BY category"
    ).all() as Array<{ category: string | null; n: number }>;
    const byCategory: Record<string, number> = {};
    for (const r of categoryRows) byCategory[r.category ?? 'uncategorized'] = r.n;

    // Weekly total (last 7 days)
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thisWeek = (db.prepare(
      "SELECT COUNT(*) as n FROM wins WHERE posted_at >= ?"
    ).get(weekStart) as { n: number }).n;

    // Monthly total (last 30 days)
    const monthStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const thisMonth = (db.prepare(
      "SELECT COUNT(*) as n FROM wins WHERE posted_at >= ?"
    ).get(monthStart) as { n: number }).n;

    // By source
    const sourceRows = db.prepare(
      "SELECT source, COUNT(*) as n FROM wins GROUP BY source"
    ).all() as Array<{ source: string | null; n: number }>;
    const bySource: Record<string, number> = {};
    for (const r of sourceRows) bySource[r.source ?? 'unknown'] = r.n;

    return NextResponse.json({
      total,
      featured,
      thisWeek,
      thisMonth,
      byCategory,
      bySource,
    });
  } catch (error) {
    console.error('[wins/stats] GET failed:', error);
    return NextResponse.json({ error: 'Failed to fetch win stats' }, { status: 500 });
  }
}
