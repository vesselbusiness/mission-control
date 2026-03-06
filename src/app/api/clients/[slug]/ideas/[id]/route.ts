import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { appendClientMemoryEvent } from "@/lib/client-memory";

export const dynamic = "force-dynamic";

const WORKSPACE = process.env.OPENCLAW_WORKSPACE || process.env.WORKSPACE || "/Users/vincent/.openclaw/workspace";
const CLIENTS_DIR = path.join(WORKSPACE, "clients");

type Params = { params: Promise<{ slug: string; id: string }> };

interface Idea {
  id: string;
  type?: "idea" | "inspo";
  title?: string;
  text: string;
  images?: string[];
  urls?: string[];
  author?: "bobby" | "sarah" | "client";
  source?: string;
  created_at: string;
}

interface IdeaBoardData {
  ideas: Idea[];
}

function filePathFor(slug: string) {
  return path.join(CLIENTS_DIR, slug, "IDEA_BOARD.json");
}

async function loadBoard(slug: string): Promise<IdeaBoardData> {
  try {
    const raw = await fs.readFile(filePathFor(slug), "utf-8");
    const parsed = JSON.parse(raw);
    return { ideas: Array.isArray(parsed?.ideas) ? parsed.ideas : [] };
  } catch {
    return { ideas: [] };
  }
}

async function saveBoard(slug: string, board: IdeaBoardData) {
  const clientDir = path.join(CLIENTS_DIR, slug);
  await fs.mkdir(clientDir, { recursive: true });
  await fs.writeFile(filePathFor(slug), JSON.stringify(board, null, 2), "utf-8");
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { slug, id } = await params;
    const updates = await request.json();
    const board = await loadBoard(slug);
    const idx = board.ideas.findIndex((i) => i.id === id);
    if (idx === -1) return NextResponse.json({ error: "Idea not found" }, { status: 404 });

    const current = board.ideas[idx];
    board.ideas[idx] = {
      ...current,
      ...(updates?.type !== undefined ? { type: updates.type } : {}),
      ...(updates?.title !== undefined ? { title: updates.title } : {}),
      ...(updates?.text !== undefined ? { text: updates.text } : {}),
      ...(updates?.images !== undefined ? { images: updates.images } : {}),
      ...(updates?.urls !== undefined ? { urls: updates.urls } : {}),
      ...(updates?.author !== undefined ? { author: updates.author } : {}),
    };

    await saveBoard(slug, board);
    await appendClientMemoryEvent(slug, {
      source: "ideas",
      action: "update",
      entityId: id,
      summary: `Updated idea ${id}`,
      data: updates,
    });

    return NextResponse.json({ success: true, idea: board.ideas[idx] });
  } catch (error) {
    console.error("[clients/[slug]/ideas/[id]] PATCH failed:", error);
    return NextResponse.json({ error: "Failed to update idea" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { slug, id } = await params;
    const board = await loadBoard(slug);
    const next = board.ideas.filter((i) => i.id !== id);
    if (next.length === board.ideas.length) {
      return NextResponse.json({ error: "Idea not found" }, { status: 404 });
    }
    board.ideas = next;
    await saveBoard(slug, board);

    await appendClientMemoryEvent(slug, {
      source: "ideas",
      action: "delete",
      entityId: id,
      summary: `Deleted idea ${id}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[clients/[slug]/ideas/[id]] DELETE failed:", error);
    return NextResponse.json({ error: "Failed to delete idea" }, { status: 500 });
  }
}
