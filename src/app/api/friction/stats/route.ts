/**
 * GET /api/friction/stats — counts by priority, phase, and trending issues
 */
import { NextResponse } from 'next/server';
import { getVesselDb } from '@/lib/vessel-db';

export async function GET() {
  try {
    const db = getVesselDb();

    const total = (db.prepare('SELECT COUNT(*) as n FROM friction_log').get() as { n: number }).n;

    // By priority
    const priorityRows = db.prepare(
      "SELECT priority, COUNT(*) as n FROM friction_log GROUP BY priority"
    ).all() as Array<{ priority: string; n: number }>;
    const byPriority: Record<string, number> = {};
    for (const r of priorityRows) byPriority[r.priority] = r.n;

    // By status
    const statusRows = db.prepare(
      "SELECT status, COUNT(*) as n FROM friction_log GROUP BY status"
    ).all() as Array<{ status: string; n: number }>;
    const byStatus: Record<string, number> = {};
    for (const r of statusRows) byStatus[r.status] = r.n;

    // By phase
    const phaseRows = db.prepare(
      "SELECT phase, COUNT(*) as n FROM friction_log GROUP BY phase"
    ).all() as Array<{ phase: string | null; n: number }>;
    const byPhase: Record<string, number> = {};
    for (const r of phaseRows) byPhase[r.phase ?? 'unphased'] = r.n;

    // Trending issues (open/in_progress, sorted by occurrence_count desc)
    const trending = db.prepare(`
      SELECT id, issue_title, priority, phase, status, occurrence_count
      FROM friction_log
      WHERE status != 'resolved'
      ORDER BY occurrence_count DESC
      LIMIT 5
    `).all();

    // High priority open count
    const highPriorityOpen = (db.prepare(
      "SELECT COUNT(*) as n FROM friction_log WHERE priority = 'high' AND status != 'resolved'"
    ).get() as { n: number }).n;

    return NextResponse.json({
      total,
      highPriorityOpen,
      byPriority,
      byStatus,
      byPhase,
      trending,
    });
  } catch (error) {
    console.error('[friction/stats] GET failed:', error);
    return NextResponse.json({ error: 'Failed to fetch friction stats' }, { status: 500 });
  }
}
