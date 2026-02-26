/**
 * POST /api/clients/[slug]/transcript — upload a new call transcript
 * Body: { filename: string, content: string }
 * Auto-prefixes filename with today's date if not already dated.
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const WORKSPACE =
  process.env.OPENCLAW_WORKSPACE ?? "/Users/vincent/.openclaw/workspace";
const CLIENTS_DIR = path.join(WORKSPACE, "clients");

type Params = { params: Promise<{ slug: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { slug } = await params;
    const body = (await request.json()) as {
      filename: string;
      content: string;
    };
    const { filename, content } = body;

    if (!filename || !content) {
      return NextResponse.json(
        { error: "filename and content required" },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const baseName = filename.replace(/\.md$/, "");
    const datedName = /^\d{4}-\d{2}-\d{2}/.test(baseName)
      ? baseName
      : `${today}-${baseName}`;
    const finalFilename = `${datedName}.md`;

    const transcriptDir = path.join(CLIENTS_DIR, slug, "transcripts");
    await fs.mkdir(transcriptDir, { recursive: true });
    await fs.writeFile(path.join(transcriptDir, finalFilename), content, "utf-8");

    return NextResponse.json({ success: true, filename: finalFilename });
  } catch (error) {
    console.error("[clients/[slug]/transcript] POST failed:", error);
    return NextResponse.json(
      { error: "Failed to save transcript" },
      { status: 500 }
    );
  }
}
