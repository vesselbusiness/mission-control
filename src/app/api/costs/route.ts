import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import {
  getAllUsageRecords,
  computeSummary,
  computeByAgent,
  computeByModel,
  computeDaily,
  computeHourly,
} from "@/lib/session-cost-parser";

const DEFAULT_BUDGET = 100.0;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const timeframe = searchParams.get("timeframe") || "30d";
  const days = parseInt(timeframe.replace(/\D/g, ""), 10) || 30;

  try {
    const records = await getAllUsageRecords();

    if (records.length === 0) {
      return NextResponse.json({
        today: 0,
        yesterday: 0,
        thisMonth: 0,
        lastMonth: 0,
        projected: 0,
        budget: DEFAULT_BUDGET,
        byAgent: [],
        byModel: [],
        daily: [],
        hourly: [],
        message: "No usage data found yet. Sessions accumulate over time.",
      });
    }

    const summary = computeSummary(records);
    const byAgent = computeByAgent(records, days);
    const byModel = computeByModel(records, days);
    const daily = computeDaily(records, days);
    const hourly = computeHourly(records);

    return NextResponse.json({
      ...summary,
      budget: DEFAULT_BUDGET,
      byAgent,
      byModel,
      daily,
      hourly,
    });
  } catch (error) {
    console.error("Error fetching cost data:", error);
    return NextResponse.json(
      { error: "Failed to fetch cost data", details: String(error) },
      { status: 500 }
    );
  }
}

// POST endpoint to update budget
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { budget, alerts } = body;
    return NextResponse.json({ success: true, budget, alerts });
  } catch (error) {
    console.error("Error updating budget:", error);
    return NextResponse.json(
      { error: "Failed to update budget" },
      { status: 500 }
    );
  }
}
