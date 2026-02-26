/**
 * GET /api/clients/[slug] — return docs, images, transcripts for a client
 */
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const WORKSPACE =
  process.env.OPENCLAW_WORKSPACE ?? "/Users/vincent/.openclaw/workspace";
const CLIENTS_DIR = path.join(WORKSPACE, "clients");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const clientDir = path.join(CLIENTS_DIR, slug);

    const entries = await fs.readdir(clientDir, { withFileTypes: true });

    const docs = entries
      .filter(
        (e) =>
          e.isFile() &&
          e.name.endsWith(".md") &&
          !e.name.startsWith("source-")
      )
      .map((e) => e.name)
      .sort();

    const images = entries
      .filter(
        (e) =>
          e.isFile() &&
          (e.name.endsWith(".jpg") ||
            e.name.endsWith(".jpeg") ||
            e.name.endsWith(".png"))
      )
      .map((e) => e.name)
      .sort();

    // Transcripts subdirectory
    let transcripts: string[] = [];
    try {
      const tEntries = await fs.readdir(path.join(clientDir, "transcripts"), {
        withFileTypes: true,
      });
      transcripts = tEntries
        .filter((e) => e.isFile() && e.name.endsWith(".md"))
        .map((e) => e.name)
        .sort()
        .reverse(); // newest first
    } catch {
      // transcripts dir doesn't exist yet
    }

    const hasAvatar = images.includes("avatar.jpg") || images.includes("avatar.jpeg") || images.includes("avatar.png");
    // Exclude avatar from the general images list shown in screenshots tab
    const screenshotImages = images.filter(img => !img.startsWith("avatar"));

    return NextResponse.json({ slug, docs, images: screenshotImages, transcripts, hasAvatar });
  } catch (error) {
    console.error("[clients/[slug]] GET failed:", error);
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
}
