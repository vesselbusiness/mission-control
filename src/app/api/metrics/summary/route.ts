/**
 * GET /api/metrics/summary — calculated MRR, churn rate, CLV, growth rate
 */
import { NextResponse } from 'next/server';
import { getVesselDb } from '@/lib/vessel-db';

interface SnapshotRow {
  date: string;
  mrr: number | null;
  active_members: number | null;
  new_members: number | null;
  churned_members: number | null;
}

export async function GET() {
  try {
    const db = getVesselDb();

    // Get last 2 snapshots for comparison
    const snapshots = db.prepare(`
      SELECT date, mrr, active_members, new_members, churned_members
      FROM metrics_snapshots
      ORDER BY date DESC
      LIMIT 2
    `).all() as SnapshotRow[];

    if (snapshots.length === 0) {
      return NextResponse.json({
        mrr: 0,
        mrrGrowthRate: 0,
        churnRate: 0,
        clv: 0,
        activeMembers: 0,
        newMembers: 0,
        churnedMembers: 0,
        netMemberGrowth: 0,
        snapshotDate: null,
      });
    }

    const latest = snapshots[0];
    const previous = snapshots[1] ?? null;

    const mrr = latest.mrr ?? 0;
    const activeMembers = latest.active_members ?? 0;
    const newMembers = latest.new_members ?? 0;
    const churnedMembers = latest.churned_members ?? 0;

    // Churn rate: churned / (active + churned) as a percentage
    const churnRate =
      activeMembers + churnedMembers > 0
        ? (churnedMembers / (activeMembers + churnedMembers)) * 100
        : 0;

    // CLV (simplified): MRR per member / monthly churn rate
    // If churn rate is 0, use a 24-month default retention
    const mrrPerMember = activeMembers > 0 ? mrr / activeMembers : 0;
    const monthlyChurnRate = churnRate / 100;
    const clv = monthlyChurnRate > 0 ? mrrPerMember / monthlyChurnRate : mrrPerMember * 24;

    // MRR growth rate (vs previous snapshot)
    const mrrGrowthRate =
      previous && previous.mrr && previous.mrr > 0
        ? ((mrr - previous.mrr) / previous.mrr) * 100
        : 0;

    // Net member growth
    const netMemberGrowth = newMembers - churnedMembers;

    return NextResponse.json({
      mrr: Math.round(mrr * 100) / 100,
      mrrGrowthRate: Math.round(mrrGrowthRate * 10) / 10,
      churnRate: Math.round(churnRate * 10) / 10,
      clv: Math.round(clv * 100) / 100,
      activeMembers,
      newMembers,
      churnedMembers,
      netMemberGrowth,
      snapshotDate: latest.date,
    });
  } catch (error) {
    console.error('[metrics/summary] GET failed:', error);
    return NextResponse.json({ error: 'Failed to calculate metrics summary' }, { status: 500 });
  }
}
