/**
 * stripe-client.ts
 * Stripe API wrapper with 10-minute cache and graceful fallback to mock data.
 * Set STRIPE_SECRET_KEY in .env to enable live data.
 */

export interface StripeSummary {
  activeSubscriptions: number;
  mrr: number;                // Monthly Recurring Revenue in dollars
  pendingPayout: number;      // Pending payout balance in dollars
  recentCharges: RecentCharge[];
  isLive: boolean;            // true = real Stripe data, false = mock
  cachedAt: string;
}

export interface RecentCharge {
  id: string;
  amount: number;             // in dollars
  currency: string;
  status: string;
  description: string | null;
  created: string;            // ISO date
  customerEmail: string | null;
}

// ─── Cache ────────────────────────────────────────────────────────────────────

interface CacheEntry {
  data: StripeSummary;
  ts: number;
}

let cache: CacheEntry | null = null;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// ─── Mock data (fallback when Stripe is not configured) ───────────────────────

function getMockData(): StripeSummary {
  const now = new Date();

  return {
    activeSubscriptions: 312,
    mrr: 39624,
    pendingPayout: 8450.75,
    recentCharges: [
      {
        id: 'mock_ch_001',
        amount: 127,
        currency: 'usd',
        status: 'succeeded',
        description: 'Magnetic Experience Engine — Monthly',
        created: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
        customerEmail: 'student@example.com',
      },
      {
        id: 'mock_ch_002',
        amount: 127,
        currency: 'usd',
        status: 'succeeded',
        description: 'Magnetic Experience Engine — Monthly',
        created: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
        customerEmail: 'creator@example.com',
      },
      {
        id: 'mock_ch_003',
        amount: 1000,
        currency: 'usd',
        status: 'succeeded',
        description: 'Message to Market — Core',
        created: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
        customerEmail: 'expert@example.com',
      },
      {
        id: 'mock_ch_004',
        amount: 47,
        currency: 'usd',
        status: 'succeeded',
        description: 'MATE — Core Calling Super Prompt',
        created: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(),
        customerEmail: 'newcomer@example.com',
      },
      {
        id: 'mock_ch_005',
        amount: 127,
        currency: 'usd',
        status: 'failed',
        description: 'Magnetic Experience Engine — Monthly',
        created: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        customerEmail: 'retry@example.com',
      },
    ],
    isLive: false,
    cachedAt: now.toISOString(),
  };
}

// ─── Live Stripe fetch ────────────────────────────────────────────────────────

async function fetchFromStripe(secretKey: string): Promise<StripeSummary> {
  // Diagnostic: log key type so we can confirm rk_ vs sk_
  console.log('[stripe-client] Key prefix:', secretKey.substring(0, 7));

  const headers = {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);

  // Fetch in parallel
  const [subsRes, balanceRes, chargesRes] = await Promise.all([
    fetch('https://api.stripe.com/v1/subscriptions?status=active&limit=1', { headers }),
    fetch('https://api.stripe.com/v1/balance', { headers }),
    fetch(`https://api.stripe.com/v1/charges?limit=10&created[gte]=${sevenDaysAgo}`, { headers }),
  ]);

  // Log individual failures with Stripe's error message
  if (!subsRes.ok) {
    const body = await subsRes.json().catch(() => ({}));
    console.error('[stripe-client] subscriptions.list failed:', subsRes.status, body?.error?.message ?? body);
    throw new Error(`Stripe subscriptions error: ${subsRes.status} — ${body?.error?.message ?? 'unknown'}`);
  }
  if (!balanceRes.ok) {
    const body = await balanceRes.json().catch(() => ({}));
    console.error('[stripe-client] balance.retrieve failed:', balanceRes.status, body?.error?.message ?? body);
    throw new Error(`Stripe balance error: ${balanceRes.status} — ${body?.error?.message ?? 'unknown'}`);
  }
  if (!chargesRes.ok) {
    const body = await chargesRes.json().catch(() => ({}));
    console.error('[stripe-client] charges.list failed:', chargesRes.status, body?.error?.message ?? body);
    throw new Error(`Stripe charges error: ${chargesRes.status} — ${body?.error?.message ?? 'unknown'}`);
  }

  const [subsJson, balanceJson, chargesJson] = await Promise.all([
    subsRes.json() as Promise<{ total_count: number }>,
    balanceRes.json() as Promise<{ pending: Array<{ amount: number; currency: string }> }>,
    chargesRes.json() as Promise<{
      data: Array<{
        id: string;
        amount: number;
        currency: string;
        status: string;
        description: string | null;
        created: number;
        receipt_email: string | null;
        billing_details: { email: string | null };
      }>;
    }>,
  ]);

  // Pending payout (sum of all pending balances, converted from cents)
  const pendingPayout = balanceJson.pending.reduce((sum, item) => {
    return item.currency === 'usd' ? sum + item.amount / 100 : sum;
  }, 0);

  // Estimate MRR: active subs × $127 (primary product price)
  // In production this should use Stripe's subscription line items
  const activeSubscriptions = subsJson.total_count ?? 0;
  const mrr = activeSubscriptions * 127;

  const recentCharges: RecentCharge[] = chargesJson.data
    .filter((charge) => !charge.description?.toLowerCase().includes('auto-recharge'))
    .map((charge) => ({
      id: charge.id,
      amount: charge.amount / 100,
      currency: charge.currency,
      status: charge.status,
      description: charge.description,
      created: new Date(charge.created * 1000).toISOString(),
      customerEmail: charge.billing_details?.email ?? charge.receipt_email ?? null,
    }));

  return {
    activeSubscriptions,
    mrr,
    pendingPayout,
    recentCharges,
    isLive: true,
    cachedAt: new Date().toISOString(),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * getStripeSummary
 * Returns live Stripe data (with 10-min cache) or mock data if not configured.
 */
export async function getStripeSummary(): Promise<StripeSummary> {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  // No API key → return mock data (no cache needed, it's instant)
  if (!secretKey) {
    console.warn('[stripe-client] No STRIPE_SECRET_KEY set — using mock data');
    return getMockData();
  }

  // Return cached data if still fresh
  if (cache && Date.now() - cache.ts < CACHE_DURATION) {
    return cache.data;
  }

  try {
    const data = await fetchFromStripe(secretKey);
    cache = { data, ts: Date.now() };
    return data;
  } catch (error) {
    console.error('[stripe-client] Failed to fetch from Stripe, using mock data:', error);

    // Return stale cache if we have it, otherwise mock
    if (cache) return cache.data;
    return getMockData();
  }
}

/** Clears the Stripe cache (useful for testing) */
export function clearStripeCache(): void {
  cache = null;
}
