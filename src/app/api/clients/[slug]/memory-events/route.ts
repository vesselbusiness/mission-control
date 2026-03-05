import { NextRequest, NextResponse } from "next/server";
import { appendClientMemoryEvent, readClientMemoryEvents, type ClientMemoryEvent } from "@/lib/client-memory";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { slug } = await params;
    const limitRaw = Number(request.nextUrl.searchParams.get("limit") || "50");
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 50;
    const events = await readClientMemoryEvents(slug, limit);
    return NextResponse.json({ events });
  } catch (error) {
    console.error("[clients/[slug]/memory-events] GET failed:", error);
    return NextResponse.json({ error: "Failed to read memory events" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { slug } = await params;
    const body = (await request.json()) as Partial<ClientMemoryEvent>;

    if (!body?.summary || typeof body.summary !== "string") {
      return NextResponse.json({ error: "summary is required" }, { status: 400 });
    }

    const event = await appendClientMemoryEvent(slug, {
      source: body.source || "system",
      action: body.action || "update",
      summary: body.summary,
      entityId: body.entityId,
      data: body.data,
      createdAt: body.createdAt,
    });

    return NextResponse.json({ success: true, event });
  } catch (error) {
    console.error("[clients/[slug]/memory-events] POST failed:", error);
    return NextResponse.json({ error: "Failed to write memory event" }, { status: 500 });
  }
}
