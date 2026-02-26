/**
 * GET /api/stripe/summary
 * Returns live Stripe data (active subs, MRR, pending payout, recent charges).
 * Falls back to mock data if STRIPE_SECRET_KEY is not set.
 * Cached for 10 minutes.
 */
import { NextResponse } from 'next/server';
import { getStripeSummary } from '@/lib/stripe-client';

export async function GET() {
  try {
    const summary = await getStripeSummary();
    return NextResponse.json(summary);
  } catch (error) {
    console.error('[stripe/summary] Failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Stripe summary' },
      { status: 500 }
    );
  }
}
