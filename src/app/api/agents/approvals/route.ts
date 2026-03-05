import { NextResponse } from "next/server";
import { getApprovals } from "@/lib/agent-control-store";

export async function GET() {
  try {
    const items = await getApprovals();
    return NextResponse.json({ approvals: items });
  } catch (error) {
    console.error("[agents/approvals] GET failed:", error);
    return NextResponse.json({ error: "Failed to load approvals" }, { status: 500 });
  }
}
