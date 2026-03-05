import { NextRequest, NextResponse } from "next/server";
import { enqueueCommand } from "@/lib/agent-control-store";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const command = typeof body?.command === "string" ? body.command.trim() : "";
    if (!command) {
      return NextResponse.json({ error: "command is required" }, { status: 400 });
    }

    const payload = body?.payload && typeof body.payload === "object" ? body.payload : {};
    const requested_by = typeof body?.requested_by === "string" ? body.requested_by : "unknown";

    const result = await enqueueCommand({ command, payload, requested_by });
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    console.error("[agents/commands] POST failed:", error);
    return NextResponse.json({ error: "Failed to enqueue command" }, { status: 500 });
  }
}
