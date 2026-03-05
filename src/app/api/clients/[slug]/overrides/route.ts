import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { appendClientMemoryEvent } from '@/lib/client-memory';

const WORKSPACE = process.env.WORKSPACE || '/Users/vincent/.openclaw/workspace';

type OverridesMap = Record<string, unknown>;

function getPath(slug: string) {
  return join(WORKSPACE, 'clients', slug, 'CLIENT_OVERRIDES.json');
}

async function loadOverrides(slug: string): Promise<OverridesMap> {
  const path = getPath(slug);
  if (!existsSync(path)) return {};
  try {
    const raw = await readFile(path, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function saveOverrides(slug: string, overrides: OverridesMap): Promise<void> {
  const path = getPath(slug);
  await writeFile(path, JSON.stringify(overrides, null, 2), 'utf-8');
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const overrides = await loadOverrides(slug);
    return NextResponse.json({ overrides });
  } catch (err) {
    console.error('[clients/[slug]/overrides] GET failed:', err);
    return NextResponse.json({ error: 'Failed to load overrides' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const key = typeof body?.key === 'string' ? body.key.trim() : '';

    if (!key) {
      return NextResponse.json({ error: 'key is required' }, { status: 400 });
    }

    const overrides = await loadOverrides(slug);
    overrides[key] = body?.value ?? null;
    await saveOverrides(slug, overrides);

    await appendClientMemoryEvent(slug, {
      source: 'overrides',
      action: 'update',
      entityId: key,
      summary: `Updated override key: ${key}`,
      data: { key, value: body?.value ?? null },
    });

    return NextResponse.json({ success: true, overrides });
  } catch (err) {
    console.error('[clients/[slug]/overrides] PUT failed:', err);
    return NextResponse.json({ error: 'Failed to save override' }, { status: 500 });
  }
}
