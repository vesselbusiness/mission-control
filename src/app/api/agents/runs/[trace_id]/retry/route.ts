import { NextResponse } from "next/server";
import { retryRun } from "@/lib/agent-control-store";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ trace_id: string }> }
) {
  try {
    const { trace_id } = await params;
    const result = await retryRun(trace_id);
    if (!result) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    console.error("[agents/runs/:trace_id/retry] POST failed:", error);
    return NextResponse.json({ error: "Failed to retry run" }, { status: 500 });
  }
}
