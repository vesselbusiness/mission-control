import { NextResponse } from "next/server";
import { getBusinessFacts } from "@/lib/business-metrics";

export async function GET() {
  try {
    const f = await getBusinessFacts();
    return NextResponse.json({
      clients_by_stage: f.clientsByStage,
      avg_days_in_stage: f.avgDaysInStage,
      at_risk_clients: f.atRiskClients,
      overdue_tasks: f.overdueTasks,
      coaching_calls_this_week: f.callsThisWeek,
      call_to_task_completion_rate: f.callToTaskCompletionRate,
    });
  } catch (error) {
    console.error("[metrics/delivery] GET failed:", error);
    return NextResponse.json({ error: "Failed to load delivery metrics" }, { status: 500 });
  }
}
