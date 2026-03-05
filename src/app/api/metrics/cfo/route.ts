import { NextResponse } from "next/server";
import { getBusinessFacts } from "@/lib/business-metrics";

export async function GET() {
  try {
    const f = await getBusinessFacts();

    const toolCostsMtd = null as number | null;
    const grossMarginPct =
      f.revenueMtdCents != null && toolCostsMtd != null && f.revenueMtdCents > 0
        ? Math.round((((f.revenueMtdCents - toolCostsMtd) / f.revenueMtdCents) * 100) * 10) / 10
        : null;

    const revenuePerMember =
      f.revenueMtdCents != null && f.activeMembers && f.activeMembers > 0
        ? Math.round(f.revenueMtdCents / f.activeMembers)
        : null;

    const revenuePerCall =
      f.revenueMtdCents != null && f.callsThisMonth > 0
        ? Math.round(f.revenueMtdCents / f.callsThisMonth)
        : null;

    return NextResponse.json({
      total_revenue_mtd: f.revenueMtdCents,
      tool_costs_mtd: toolCostsMtd,
      gross_margin_pct: grossMarginPct,
      revenue_per_member: revenuePerMember,
      revenue_per_call: revenuePerCall,
    });
  } catch (error) {
    console.error("[metrics/cfo] GET failed:", error);
    return NextResponse.json({ error: "Failed to load CFO metrics" }, { status: 500 });
  }
}
