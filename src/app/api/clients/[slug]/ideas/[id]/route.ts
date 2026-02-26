/**
 * DELETE /api/clients/[slug]/ideas/[id]  — delete an idea
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const WORKSPACE =
  process.env.OPENCLAW_WORKSPACE ?? "/Users/vincent/.openclaw/workspace";
const CLIENTS_DIR = path.join(WORKSPACE, "clients");

type Params = { params: Promise<{ slug: string; id: string }> };

interface Idea {
  id: string;
  text: string;
  created_at: string;
}

interface IdeaBoardData {
  ideas: Idea[];
}

export async function DELETE(
  _request: NextRequest,
  { params }: Params
) {
  try {
    const { slug, id } = await params;
    const filePath = path.join(CLIENTS_DIR, slug, "IDEA_BOARD.json");

    // Read existing ideas
    let data: IdeaBoardData = { ideas: [] };
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      data = JSON.parse(raw) as IdeaBoardData;
    } catch {
      // File doesn't exist — nothing to delete
      return NextResponse.json({ error: "Idea not found" }, { status: 404 });
    }

    // Find and remove the idea
    const initialLength = data.ideas.length;
    data.ideas = data.ideas.filter((idea) => idea.id !== id);

    if (data.ideas.length === initialLength) {
      return NextResponse.json({ error: "Idea not found" }, { status: 404 });
    }

    // Save
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[clients/[slug]/ideas/[id]] DELETE failed:", error);
    return NextResponse.json({ error: "Failed to delete idea" }, { status: 500 });
  }
}
