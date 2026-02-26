/**
 * GET /api/metrics/history?days=30 — last N days of metric snapshots
 */
import { NextRequest, NextResponse } from 'next/server';
import { getVesselDb } from '@/lib/vessel-db';

export async function GET(request: NextRequest) {
  try {
    const db = getVesselDb();
    const { searchParams } = new URL(request.url);

    const days = Math.min(parseInt(searchParams.get('days') || '30'), 365);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const rows = db.prepare(`
      SELECT * FROM metrics_snapshots
      WHERE date >= ?
      ORDER BY date ASC
    `).all(cutoff);

    return NextResponse.json({ snapshots: rows, days, count: rows.length });
  } catch (error) {
    console.error('[metrics/history] GET failed:', error);
    return NextResponse.json({ error: 'Failed to fetch metrics history' }, { status: 500 });
  }
}
