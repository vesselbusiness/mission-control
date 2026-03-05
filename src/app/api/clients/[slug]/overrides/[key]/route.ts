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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; key: string }> }
) {
  try {
    const { slug, key } = await params;
    const cleanKey = (key || '').trim();
    if (!cleanKey) {
      return NextResponse.json({ error: 'key is required' }, { status: 400 });
    }

    const overrides = await loadOverrides(slug);
    delete overrides[cleanKey];
    await saveOverrides(slug, overrides);

    await appendClientMemoryEvent(slug, {
      source: 'overrides',
      action: 'delete',
      entityId: cleanKey,
      summary: `Deleted override key: ${cleanKey}`,
    });

    return NextResponse.json({ success: true, overrides });
  } catch (err) {
    console.error('[clients/[slug]/overrides/[key]] DELETE failed:', err);
    return NextResponse.json({ error: 'Failed to delete override' }, { status: 500 });
  }
}
