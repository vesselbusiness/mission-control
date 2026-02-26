/**
 * GET /api/clients  — list all coaching clients
 * POST /api/clients — create a new client folder + standard docs
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const WORKSPACE =
  process.env.OPENCLAW_WORKSPACE ?? "/Users/vincent/.openclaw/workspace";
const CLIENTS_DIR = path.join(WORKSPACE, "clients");

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientSummary {
  slug: string;
  name: string;
  stage: string;
  location: string;
  lastUpdated: string;
  hasAvatar: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseProfile(content: string): Omit<ClientSummary, "slug" | "hasAvatar"> {
  const firstLine = content.split("\n")[0] ?? "";
  const name = firstLine.replace(/^#\s*/, "").trim();
  const stage =
    content.match(/\*\*Stage:\*\*\s*([^\n]+)/)?.[1]?.trim() ?? "";
  const location =
    content.match(/\*\*Location:\*\*\s*([^\n]+)/)?.[1]?.trim() ?? "";
  const lastUpdated =
    content.match(/## Last Updated\s*\n([^\n]+)/)?.[1]?.trim() ?? "";
  return { name, stage, location, lastUpdated };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const entries = await fs.readdir(CLIENTS_DIR, { withFileTypes: true });
    const slugs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

    const clients = await Promise.all(
      slugs.map(async (slug): Promise<ClientSummary> => {
        try {
          const profilePath = path.join(CLIENTS_DIR, slug, "PROFILE.md");
          const content = await fs.readFile(profilePath, "utf-8");
          const hasAvatar = await fs.access(path.join(CLIENTS_DIR, slug, "avatar.jpg")).then(() => true).catch(() => false);
          return { slug, ...parseProfile(content), hasAvatar };
        } catch {
          return { slug, name: slug, stage: "", location: "", lastUpdated: "", hasAvatar: false };
        }
      })
    );

    return NextResponse.json({ clients });
  } catch (error) {
    console.error("[clients] GET failed:", error);
    return NextResponse.json(
      { error: "Failed to list clients" },
      { status: 500 }
    );
  }
}

const STANDARD_DOCS = [
  "ICP",
  "CORE_CALLING",
  "OFFER",
  "MESSAGING",
  "PROGRESS",
  "ACTION_ITEMS",
] as const;

const DOC_LABELS: Record<string, string> = {
  ICP: "ICP",
  CORE_CALLING: "Core Calling",
  OFFER: "Offer",
  MESSAGING: "Messaging",
  PROGRESS: "Progress",
  ACTION_ITEMS: "Action Items",
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      name: string;
      stage?: string;
      location?: string;
    };
    const { name, stage = "", location = "" } = body;
    if (!name)
      return NextResponse.json({ error: "name required" }, { status: 400 });

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const clientDir = path.join(CLIENTS_DIR, slug);
    await fs.mkdir(clientDir, { recursive: true });
    await fs.mkdir(path.join(clientDir, "transcripts"), { recursive: true });

    const today = new Date().toISOString().slice(0, 10);

    const profileContent = [
      `# ${name}`,
      ``,
      `## Quick Context`,
      `**Name:** ${name}`,
      `**Location:** ${location}`,
      `**Stage:** ${stage}`,
      `**Package:** Vessel Business 1:1 Coaching`,
      `**Coaches:** Sarah & Bobby`,
      ``,
      `## Last Updated`,
      today,
    ].join("\n");

    await fs.writeFile(path.join(clientDir, "PROFILE.md"), profileContent);

    await Promise.all(
      STANDARD_DOCS.map((doc) =>
        fs.writeFile(
          path.join(clientDir, `${doc}.md`),
          `# ${name} — ${DOC_LABELS[doc]}\n\n## Last Updated\n${today}\n`
        )
      )
    );

    return NextResponse.json({ slug, name, stage, location });
  } catch (error) {
    console.error("[clients] POST failed:", error);
    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 }
    );
  }
}
