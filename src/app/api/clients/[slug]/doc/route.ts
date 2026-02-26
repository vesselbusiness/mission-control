/**
 * GET /api/clients/[slug]/doc?file=PROFILE.md  — read doc content
 * PUT /api/clients/[slug]/doc?file=PROFILE.md  — save doc content
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const WORKSPACE =
  process.env.OPENCLAW_WORKSPACE ?? "/Users/vincent/.openclaw/workspace";
const CLIENTS_DIR = path.join(WORKSPACE, "clients");

type Params = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { slug } = await params;
    const file = request.nextUrl.searchParams.get("file");
    if (!file)
      return NextResponse.json(
        { error: "file param required" },
        { status: 400 }
      );

    const clientDir = path.join(CLIENTS_DIR, slug);
    const filePath = path.resolve(path.join(clientDir, file));

    // Security: prevent path traversal
    if (!filePath.startsWith(clientDir)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const content = await fs.readFile(filePath, "utf-8");
    return NextResponse.json({ content, file });
  } catch (error) {
    console.error("[clients/[slug]/doc] GET failed:", error);
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { slug } = await params;
    const file = request.nextUrl.searchParams.get("file");
    if (!file)
      return NextResponse.json(
        { error: "file param required" },
        { status: 400 }
      );

    const clientDir = path.join(CLIENTS_DIR, slug);
    const filePath = path.resolve(path.join(clientDir, file));

    // Security: prevent path traversal
    if (!filePath.startsWith(clientDir)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const content = await request.text();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, "utf-8");

    return NextResponse.json({
      success: true,
      file,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[clients/[slug]/doc] PUT failed:", error);
    return NextResponse.json({ error: "Failed to save file" }, { status: 500 });
  }
}
