import { NextResponse } from "next/server";
import { getBusinessFacts } from "@/lib/business-metrics";

export async function GET() {
  try {
    const f = await getBusinessFacts();

    const mtmDone = f.mtmDone;
    const mtmTotal = f.mtmTotal;
    const closeRate = mtmTotal > 0 ? Math.round((mtmDone / mtmTotal) * 1000) / 10 : null;

    return NextResponse.json({
      mate: {
        visits: null,
        opt_ins: null,
        purchases: null,
        conversion_pct: null,
      },
      mee: {
        new_members_7d: null,
        new_members_30d: null,
        active_members: f.activeMembers,
        retention_30d: null,
      },
      mtm: {
        applications: mtmTotal || null,
        booked_calls: null,
        closes: mtmDone || null,
        close_rate: closeRate,
        collected_revenue: f.revenueMtdCents,
      },
    });
  } catch (error) {
    console.error("[metrics/funnel] GET failed:", error);
    return NextResponse.json({ error: "Failed to load funnel metrics" }, { status: 500 });
  }
}
