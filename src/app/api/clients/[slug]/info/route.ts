/**
 * GET /api/clients/[slug]/info  — read CLIENT_INFO.json
 * PUT /api/clients/[slug]/info  — write CLIENT_INFO.json
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const WORKSPACE =
  process.env.OPENCLAW_WORKSPACE ?? "/Users/vincent/.openclaw/workspace";
const CLIENTS_DIR = path.join(WORKSPACE, "clients");

type Params = { params: Promise<{ slug: string }> };

export interface ClientInfo {
  legalBusinessName: string;
  phoneNumber: string;
  businessEmail: string;
  personalEmail: string;
  vbsGhlLocationId: string;
  vbsGhlInternalPhone: string;
  googleDriveFolderLink: string;
}

const DEFAULT_INFO: ClientInfo = {
  legalBusinessName: "",
  phoneNumber: "",
  businessEmail: "",
  personalEmail: "",
  vbsGhlLocationId: "",
  vbsGhlInternalPhone: "",
  googleDriveFolderLink: "",
};

export async function GET(
  _request: NextRequest,
  { params }: Params
) {
  try {
    const { slug } = await params;
    const filePath = path.join(CLIENTS_DIR, slug, "CLIENT_INFO.json");
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(raw) as ClientInfo;
      return NextResponse.json({ ...DEFAULT_INFO, ...data });
    } catch {
      // File doesn't exist yet — return defaults
      return NextResponse.json(DEFAULT_INFO);
    }
  } catch (error) {
    console.error("[clients/[slug]/info] GET failed:", error);
    return NextResponse.json({ error: "Failed to read client info" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: Params
) {
  try {
    const { slug } = await params;
    const clientDir = path.join(CLIENTS_DIR, slug);
    const filePath = path.join(clientDir, "CLIENT_INFO.json");
    const body = await request.json() as ClientInfo;
    await fs.mkdir(clientDir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(body, null, 2), "utf-8");
    return NextResponse.json({ success: true, savedAt: new Date().toISOString() });
  } catch (error) {
    console.error("[clients/[slug]/info] PUT failed:", error);
    return NextResponse.json({ error: "Failed to save client info" }, { status: 500 });
  }
}
