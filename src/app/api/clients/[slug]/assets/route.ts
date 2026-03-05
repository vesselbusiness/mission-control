import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { appendClientMemoryEvent } from "@/lib/client-memory";

export const dynamic = "force-dynamic";

const WORKSPACE = process.env.OPENCLAW_WORKSPACE || process.env.WORKSPACE || "/Users/vincent/.openclaw/workspace";
const CLIENTS_DIR = path.join(WORKSPACE, "clients");

type Params = { params: Promise<{ slug: string }> };

type ImageAsset = { id: string; name: string; data: string; createdAt: string };

function filePathFor(slug: string) {
  return path.join(CLIENTS_DIR, slug, "IMAGE_ASSETS.json");
}

async function loadAssets(slug: string): Promise<ImageAsset[]> {
  try {
    const raw = await fs.readFile(filePathFor(slug), "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.assets) ? parsed.assets : [];
  } catch {
    return [];
  }
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { slug } = await params;
    const assets = await loadAssets(slug);
    return NextResponse.json({ assets });
  } catch (error) {
    console.error("[clients/[slug]/assets] GET failed:", error);
    return NextResponse.json({ error: "Failed to load assets" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const assets = Array.isArray(body?.assets) ? body.assets : null;
    if (!assets) {
      return NextResponse.json({ error: "assets array required" }, { status: 400 });
    }

    const clientDir = path.join(CLIENTS_DIR, slug);
    await fs.mkdir(clientDir, { recursive: true });
    await fs.writeFile(filePathFor(slug), JSON.stringify({ assets }, null, 2), "utf-8");

    await appendClientMemoryEvent(slug, {
      source: "assets",
      action: "update",
      summary: `Saved image assets (${assets.length})`,
      data: { count: assets.length },
    });

    return NextResponse.json({ success: true, assets });
  } catch (error) {
    console.error("[clients/[slug]/assets] PUT failed:", error);
    return NextResponse.json({ error: "Failed to save assets" }, { status: 500 });
  }
}
