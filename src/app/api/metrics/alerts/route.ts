import { NextResponse } from "next/server";
import { getBusinessFacts } from "@/lib/business-metrics";

type Severity = "high" | "medium" | "low";

function action(label: string, owner: string | null, target_date: string | null, severity: Severity) {
  return { label, owner, target_date, severity };
}

export async function GET() {
  try {
    const f = await getBusinessFacts();
    const risks: Array<ReturnType<typeof action>> = [];
    const actions: Array<ReturnType<typeof action>> = [];

    const overdueTotal = f.overdueTasks.reduce((sum, r) => sum + (r.count || 0), 0);

    if (overdueTotal > 0) {
      risks.push(action(`Overdue tasks: ${overdueTotal}`, "bobby", null, overdueTotal > 10 ? "high" : "medium"));
      actions.push(action("Run task hygiene sweep and clear overdue items", "bobby", null, "high"));
    }

    if ((f.atRiskClients?.length ?? 0) > 0) {
      risks.push(action(`${f.atRiskClients.length} at-risk clients (no recent movement)`, "sarah", null, "high"));
      actions.push(action("Schedule outreach/check-ins for at-risk clients", "sarah", null, "high"));
    }

    if (f.callToTaskCompletionRate != null && f.callToTaskCompletionRate < 60) {
      risks.push(action(`Call task completion low (${f.callToTaskCompletionRate}%)`, "bobby", null, "medium"));
      actions.push(action("Review last 3 call action plans and assign owners", "bobby", null, "medium"));
    }

    if (risks.length === 0) {
      actions.push(action("No critical alerts — continue daily brief cadence", "agent", null, "low"));
    }

    return NextResponse.json({
      risks: risks.slice(0, 3),
      actions: actions.slice(0, 3),
    });
  } catch (error) {
    console.error("[metrics/alerts] GET failed:", error);
    return NextResponse.json({ error: "Failed to load alerts" }, { status: 500 });
  }
}
