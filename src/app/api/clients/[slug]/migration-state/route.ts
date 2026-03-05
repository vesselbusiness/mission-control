import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const WORKSPACE = process.env.OPENCLAW_WORKSPACE || process.env.WORKSPACE || "/Users/vincent/.openclaw/workspace";
const CLIENTS_DIR = path.join(WORKSPACE, "clients");

type Params = { params: Promise<{ slug: string }> };

type MigrationState = Record<string, boolean>;

function filePathFor(slug: string) {
  return path.join(CLIENTS_DIR, slug, "MIGRATION_STATE.json");
}

async function loadState(slug: string): Promise<MigrationState> {
  try {
    const raw = await fs.readFile(filePathFor(slug), "utf-8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { slug } = await params;
  const state = await loadState(slug);
  return NextResponse.json({ state });
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const key = typeof body?.key === "string" ? body.key.trim() : "";
    const value = Boolean(body?.value);
    if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });

    const state = await loadState(slug);
    state[key] = value;

    const clientDir = path.join(CLIENTS_DIR, slug);
    await fs.mkdir(clientDir, { recursive: true });
    await fs.writeFile(filePathFor(slug), JSON.stringify(state, null, 2), "utf-8");

    return NextResponse.json({ success: true, state });
  } catch (error) {
    console.error("[clients/[slug]/migration-state] PUT failed", error);
    return NextResponse.json({ error: "Failed to update migration state" }, { status: 500 });
  }
}
