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
    const payloadPatch = body?.payload && typeof body.payload === "object" ? body.payload : {};

    const approvals = await getApprovals();
    const idx = approvals.findIndex((a) => a.id === id);
    if (idx < 0) return NextResponse.json({ error: "Approval not found" }, { status: 404 });

    approvals[idx] = {
      ...approvals[idx],
      payload: { ...(approvals[idx].payload || {}), ...payloadPatch },
      status: "approved",
      updated_at: new Date().toISOString(),
      decided_by: decidedBy,
    };
    await saveApprovals(approvals);

    return NextResponse.json({ success: true, approval: approvals[idx] });
  } catch (error) {
    console.error("[agents/approvals/:id/edit-approve] POST failed:", error);
    return NextResponse.json({ error: "Failed to edit/approve item" }, { status: 500 });
  }
}
