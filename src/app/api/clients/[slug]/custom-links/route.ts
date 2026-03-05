import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { appendClientMemoryEvent } from "@/lib/client-memory";

export const dynamic = "force-dynamic";

const WORKSPACE = process.env.OPENCLAW_WORKSPACE || process.env.WORKSPACE || "/Users/vincent/.openclaw/workspace";
const CLIENTS_DIR = path.join(WORKSPACE, "clients");

type Params = { params: Promise<{ slug: string }> };

type CustomLink = { id: string; title: string; description?: string; url: string; author?: "bobby" | "sarah" | "client"; createdAt: string };

function filePathFor(slug: string) {
  return path.join(CLIENTS_DIR, slug, "CUSTOM_LINKS.json");
}

async function loadCustomLinks(slug: string): Promise<CustomLink[]> {
  try {
    const raw = await fs.readFile(filePathFor(slug), "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.links) ? parsed.links : [];
  } catch {
    return [];
  }
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { slug } = await params;
    const links = await loadCustomLinks(slug);
    return NextResponse.json({ links });
  } catch (error) {
    console.error("[clients/[slug]/custom-links] GET failed:", error);
    return NextResponse.json({ error: "Failed to load custom links" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const links = Array.isArray(body?.links) ? body.links : null;
    if (!links) {
      return NextResponse.json({ error: "links array required" }, { status: 400 });
    }

    const clientDir = path.join(CLIENTS_DIR, slug);
    await fs.mkdir(clientDir, { recursive: true });
    await fs.writeFile(filePathFor(slug), JSON.stringify({ links }, null, 2), "utf-8");

    await appendClientMemoryEvent(slug, {
      source: "links",
      action: "update",
      summary: `Saved misc links (${links.length})`,
      data: { count: links.length },
    });

    return NextResponse.json({ success: true, links });
  } catch (error) {
    console.error("[clients/[slug]/custom-links] PUT failed:", error);
    return NextResponse.json({ error: "Failed to save custom links" }, { status: 500 });
  }
}
