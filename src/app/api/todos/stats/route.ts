/**
 * GET /api/todos/stats — counts by assignee, status, and priority
 */
import { NextResponse } from 'next/server';
import { getTodosDb } from '@/lib/vessel-db';

export async function GET() {
  try {
    const db = getTodosDb();

    const total = (db.prepare('SELECT COUNT(*) as n FROM todos').get() as { n: number }).n;

    // By assignee
    const assigneeRows = db.prepare(
      "SELECT assignee, COUNT(*) as n FROM todos GROUP BY assignee"
    ).all() as Array<{ assignee: string; n: number }>;
    const byAssignee: Record<string, number> = {};
    for (const r of assigneeRows) byAssignee[r.assignee] = r.n;

    // By status
    const statusRows = db.prepare(
      "SELECT status, COUNT(*) as n FROM todos GROUP BY status"
    ).all() as Array<{ status: string; n: number }>;
    const byStatus: Record<string, number> = {};
    for (const r of statusRows) byStatus[r.status] = r.n;

    // By priority
    const priorityRows = db.prepare(
      "SELECT priority, COUNT(*) as n FROM todos GROUP BY priority"
    ).all() as Array<{ priority: string; n: number }>;
    const byPriority: Record<string, number> = {};
    for (const r of priorityRows) byPriority[r.priority] = r.n;

    // Overdue (due_date < today and status != 'done')
    const today = new Date().toISOString().split('T')[0];
    const overdue = (db.prepare(
      "SELECT COUNT(*) as n FROM todos WHERE due_date IS NOT NULL AND due_date < ? AND status != 'done'"
    ).get(today) as { n: number }).n;

    return NextResponse.json({
      total,
      byAssignee,
      byStatus,
      byPriority,
      overdue,
    });
  } catch (error) {
    console.error('[todos/stats] GET failed:', error);
    return NextResponse.json({ error: 'Failed to fetch todo stats' }, { status: 500 });
  }
}
