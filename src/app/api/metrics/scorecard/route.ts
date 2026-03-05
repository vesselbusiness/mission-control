import { NextResponse } from "next/server";
import { getBusinessFacts } from "@/lib/business-metrics";

export async function GET() {
  try {
    const f = await getBusinessFacts();
    return NextResponse.json({
      mrr: f.mrrDollars != null ? Math.round(f.mrrDollars * 100) : null,
      net_mrr_change_7d: f.netMrr7Dollars != null ? Math.round(f.netMrr7Dollars * 100) : null,
      net_mrr_change_30d: f.netMrr30Dollars != null ? Math.round(f.netMrr30Dollars * 100) : null,
      active_members: f.activeMembers,
      churn_rate: f.churnRate != null ? Math.round(f.churnRate * 10) / 10 : null,
      cash_collected_mtd: f.cashCollectedMtdCents,
      pipeline_velocity_7d: f.pipelineVelocity7d,
    });
  } catch (error) {
    console.error("[metrics/scorecard] GET failed:", error);
    return NextResponse.json({ error: "Failed to load scorecard" }, { status: 500 });
  }
}
