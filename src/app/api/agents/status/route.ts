import { NextResponse } from "next/server";
import { getAgents } from "@/lib/agent-control-store";

export async function GET() {
  try {
    const data = await getAgents();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[agents/status] GET failed:", error);
    return NextResponse.json({ error: "Failed to load agent status" }, { status: 500 });
  }
}
