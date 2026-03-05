import { NextRequest, NextResponse } from "next/server";
import { getRuns } from "@/lib/agent-control-store";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10), 1), 200);
    const runs = await getRuns();
    return NextResponse.json({ runs: runs.slice(0, limit) });
  } catch (error) {
    console.error("[agents/runs] GET failed:", error);
    return NextResponse.json({ error: "Failed to load runs" }, { status: 500 });
  }
}
