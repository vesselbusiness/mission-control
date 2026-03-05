import { NextRequest, NextResponse } from "next/server";
import { getApprovals, saveApprovals } from "@/lib/agent-control-store";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const decidedBy = typeof body?.decided_by === "string" ? body.decided_by : "operator";
    const note = typeof body?.note === "string" ? body.note : "";

    const approvals = await getApprovals();
    const idx = approvals.findIndex((a) => a.id === id);
    if (idx < 0) return NextResponse.json({ error: "Approval not found" }, { status: 404 });

    approvals[idx] = {
      ...approvals[idx],
      status: "rejected",
      updated_at: new Date().toISOString(),
      decided_by: decidedBy,
      decision_note: note,
    };
    await saveApprovals(approvals);

    return NextResponse.json({ success: true, approval: approvals[idx] });
  } catch (error) {
    console.error("[agents/approvals/:id/reject] POST failed:", error);
    return NextResponse.json({ error: "Failed to reject item" }, { status: 500 });
  }
}
