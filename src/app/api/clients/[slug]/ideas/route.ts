/**
 * GET /api/clients/[slug]/ideas    — read IDEA_BOARD.json
 * POST /api/clients/[slug]/ideas   — add an idea
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { appendClientMemoryEvent } from "@/lib/client-memory";

export const dynamic = "force-dynamic";

const WORKSPACE =
  process.env.OPENCLAW_WORKSPACE ?? "/Users/vincent/.openclaw/workspace";
const CLIENTS_DIR = path.join(WORKSPACE, "clients");

type Params = { params: Promise<{ slug: string }> };

interface Idea {
  id: string;
  text: string;
  created_at: string;
}

interface IdeaBoardData {
  ideas: Idea[];
}

export async function GET(
  _request: NextRequest,
  { params }: Params
) {
  try {
    const { slug } = await params;
    const filePath = path.join(CLIENTS_DIR, slug, "IDEA_BOARD.json");
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(raw) as IdeaBoardData;
      return NextResponse.json(data);
    } catch {
      // File doesn't exist yet — return empty
      return NextResponse.json({ ideas: [] });
    }
  } catch (error) {
    console.error("[clients/[slug]/ideas] GET failed:", error);
    return NextResponse.json({ error: "Failed to read ideas" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: Params
) {
  try {
    const { slug } = await params;
    const clientDir = path.join(CLIENTS_DIR, slug);
    const filePath = path.join(clientDir, "IDEA_BOARD.json");
    const body = (await request.json()) as { text: string };

    if (!body.text || typeof body.text !== "string") {
      return NextResponse.json({ error: "Invalid request: text is required" }, { status: 400 });
    }

    // Read existing ideas
    let data: IdeaBoardData = { ideas: [] };
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      data = JSON.parse(raw) as IdeaBoardData;
    } catch {
      // File doesn't exist yet
    }

    // Add new idea
    const newIdea: Idea = {
      id: randomUUID(),
      text: body.text.trim(),
      created_at: new Date().toISOString(),
    };
    data.ideas.push(newIdea);

    // Save
    await fs.mkdir(clientDir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");

    await appendClientMemoryEvent(slug, {
      source: "ideas",
      action: "create",
      entityId: newIdea.id,
      summary: `Added idea: ${newIdea.text.slice(0, 120)}`,
      data: newIdea,
    });

    return NextResponse.json({ success: true, idea: newIdea });
  } catch (error) {
    console.error("[clients/[slug]/ideas] POST failed:", error);
    return NextResponse.json({ error: "Failed to add idea" }, { status: 500 });
  }
}
