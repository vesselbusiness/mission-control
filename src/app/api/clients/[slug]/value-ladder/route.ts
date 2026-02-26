/**
 * GET /api/clients/[slug]/value-ladder  — read VALUE_LADDER.json
 * PUT /api/clients/[slug]/value-ladder  — write VALUE_LADDER.json
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const WORKSPACE =
  process.env.OPENCLAW_WORKSPACE ?? "/Users/vincent/.openclaw/workspace";
const CLIENTS_DIR = path.join(WORKSPACE, "clients");

type Params = { params: Promise<{ slug: string }> };

interface ValueLadderTier {
  step: number;
  name: string;
  productName: string;
  price: string;
  frequency: string;
  status: string;
  description: string;
  liveUrl?: string;
  vbsEditUrl?: string;
}

interface ValueLadderData {
  tiers: ValueLadderTier[];
}

const DEFAULT_DATA: ValueLadderData = { tiers: [] };

export async function GET(
  _request: NextRequest,
  { params }: Params
) {
  try {
    const { slug } = await params;
    const filePath = path.join(CLIENTS_DIR, slug, "VALUE_LADDER.json");
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(raw) as ValueLadderData;
      return NextResponse.json(data);
    } catch {
      // File doesn't exist yet — return empty structure (client uses defaults)
      return NextResponse.json(DEFAULT_DATA);
    }
  } catch (error) {
    console.error("[clients/[slug]/value-ladder] GET failed:", error);
    return NextResponse.json({ error: "Failed to read value ladder" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: Params
) {
  try {
    const { slug } = await params;
    const clientDir = path.join(CLIENTS_DIR, slug);
    const filePath = path.join(clientDir, "VALUE_LADDER.json");
    const body = await request.json() as ValueLadderData;
    await fs.mkdir(clientDir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(body, null, 2), "utf-8");
    return NextResponse.json({ success: true, savedAt: new Date().toISOString() });
  } catch (error) {
    console.error("[clients/[slug]/value-ladder] PUT failed:", error);
    return NextResponse.json({ error: "Failed to save value ladder" }, { status: 500 });
  }
}
