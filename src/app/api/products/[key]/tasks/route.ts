import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const WORKSPACE = process.env.WORKSPACE || '/Users/vincent/.openclaw/workspace';
const ALLOWED_KEYS = new Set(['misc', 'ccsp', 'mee', 'mtm', 'vbs']);

interface ProductTaskItem {
  id: string;
  label: string;
  done: boolean;
  assignee: 'bobby' | 'sarah' | 'both' | null;
  status: 'assigned' | 'in_progress' | 'review' | 'completed' | null;
  priority: 'low' | 'mid' | 'high' | null;
}

interface ProductSubCategory {
  id: string;
  title: string;
  items: ProductTaskItem[];
}

interface ProductCategory {
  id: string;
  title: string;
  items: ProductTaskItem[];
  subcategories: ProductSubCategory[];
}

interface ProductBoardPayload {
  categories: ProductCategory[];
}

function boardPath(key: string) {
  return join(WORKSPACE, 'data', 'product-boards', `${key}.json`);
}

async function loadBoard(key: string): Promise<ProductBoardPayload> {
  const path = boardPath(key);
  if (!existsSync(path)) return { categories: [] };

  try {
    const raw = await readFile(path, 'utf-8');
    const parsed = JSON.parse(raw);
    return { categories: Array.isArray(parsed?.categories) ? parsed.categories : [] };
  } catch {
    return { categories: [] };
  }
}

async function saveBoard(key: string, payload: ProductBoardPayload): Promise<void> {
  const dir = join(WORKSPACE, 'data', 'product-boards');
  await mkdir(dir, { recursive: true });
  await writeFile(boardPath(key), JSON.stringify(payload, null, 2), 'utf-8');
}

function validateKey(key: string) {
  return ALLOWED_KEYS.has(key);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    if (!validateKey(key)) {
      return NextResponse.json({ error: 'Invalid product key' }, { status: 400 });
    }

    const board = await loadBoard(key);
    return NextResponse.json(board);
  } catch (err) {
    console.error('[products/:key/tasks] GET failed:', err);
    return NextResponse.json({ error: 'Failed to load product board' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    if (!validateKey(key)) {
      return NextResponse.json({ error: 'Invalid product key' }, { status: 400 });
    }

    const body = await request.json();
    const categories = Array.isArray(body?.categories) ? body.categories : null;
    if (!categories) {
      return NextResponse.json({ error: 'categories array required' }, { status: 400 });
    }

    const payload: ProductBoardPayload = { categories };
    await saveBoard(key, payload);
    return NextResponse.json({ success: true, ...payload });
  } catch (err) {
    console.error('[products/:key/tasks] PUT failed:', err);
    return NextResponse.json({ error: 'Failed to save product board' }, { status: 500 });
  }
}
