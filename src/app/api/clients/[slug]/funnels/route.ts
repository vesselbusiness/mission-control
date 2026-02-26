/**
 * GET /api/clients/[slug]/funnels  — read FUNNELS.json
 * PUT /api/clients/[slug]/funnels  — write FUNNELS.json
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const WORKSPACE =
  process.env.OPENCLAW_WORKSPACE ?? "/Users/vincent/.openclaw/workspace";
const CLIENTS_DIR = path.join(WORKSPACE, "clients");

type Params = { params: Promise<{ slug: string }> };

export interface FunnelEntry {
  liveUrl: string;
  editUrl: string;
}

export interface FunnelsData {
  mate: FunnelEntry;
  communityUpsell: FunnelEntry;
  coreProduct: FunnelEntry;
}

const DEFAULT_FUNNELS: FunnelsData = {
  mate: { liveUrl: "", editUrl: "" },
  communityUpsell: { liveUrl: "", editUrl: "" },
  coreProduct: { liveUrl: "", editUrl: "" },
};

export async function GET(
  _request: NextRequest,
  { params }: Params
) {
  try {
    const { slug } = await params;
    const filePath = path.join(CLIENTS_DIR, slug, "FUNNELS.json");
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(raw) as FunnelsData;
      return NextResponse.json({ ...DEFAULT_FUNNELS, ...data });
    } catch {
      return NextResponse.json(DEFAULT_FUNNELS);
    }
  } catch (error) {
    console.error("[clients/[slug]/funnels] GET failed:", error);
    return NextResponse.json({ error: "Failed to read funnels" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: Params
) {
  try {
    const { slug } = await params;
    const clientDir = path.join(CLIENTS_DIR, slug);
    const filePath = path.join(clientDir, "FUNNELS.json");
    const body = await request.json() as FunnelsData;
    await fs.mkdir(clientDir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(body, null, 2), "utf-8");
    return NextResponse.json({ success: true, savedAt: new Date().toISOString() });
  } catch (error) {
    console.error("[clients/[slug]/funnels] PUT failed:", error);
    return NextResponse.json({ error: "Failed to save funnels" }, { status: 500 });
  }
}
