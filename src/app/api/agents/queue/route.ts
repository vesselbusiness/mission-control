import { NextResponse } from "next/server";
import { buildQueueSnapshot, getQueueItems } from "@/lib/agent-control-store";

export async function GET() {
  try {
    const items = await getQueueItems();
    return NextResponse.json(buildQueueSnapshot(items));
  } catch (error) {
    console.error("[agents/queue] GET failed:", error);
    return NextResponse.json({ error: "Failed to load queue" }, { status: 500 });
  }
}
