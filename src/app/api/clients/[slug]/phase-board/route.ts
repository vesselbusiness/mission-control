import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const WORKSPACE = process.env.WORKSPACE || '/Users/vincent/.openclaw/workspace';

interface PhaseBoardTask {
  id: string;
  label: string;
  completed: boolean;
  completedAt: string | null;
  assignee: 'bobby' | 'sarah' | 'client' | null;
  priority: 'low' | 'mid' | 'high' | null;
  status: 'assigned' | 'in_progress' | 'review' | 'completed';
  linkedPhaseTaskId?: string;
  subtasks?: PhaseBoardTask[];
}

interface PhaseBoardPhase {
  id: string;
  label: string;
  tasks: PhaseBoardTask[];
}

interface PhaseBoardData {
  phases: PhaseBoardPhase[];
}

async function getPhaseBoardPath(slug: string): Promise<string> {
  return join(WORKSPACE, 'clients', slug, 'PHASE_BOARD.json');
}

async function loadPhaseBoard(slug: string): Promise<PhaseBoardData> {
  const path = await getPhaseBoardPath(slug);
  
  if (!existsSync(path)) {
    // Return default empty structure
    return { phases: [] };
  }
  
  try {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { phases: [] };
  }
}

async function savePhaseBoard(slug: string, data: PhaseBoardData): Promise<void> {
  const path = await getPhaseBoardPath(slug);
  await writeFile(path, JSON.stringify(data, null, 2), 'utf-8');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const board = await loadPhaseBoard(slug);
    return NextResponse.json(board);
  } catch (err) {
    console.error('Phase board GET error:', err);
    return NextResponse.json({ error: 'Failed to load phase board' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const data: PhaseBoardData = await request.json();
    
    // Validate structure
    if (!data.phases || !Array.isArray(data.phases)) {
      return NextResponse.json({ error: 'Invalid phase board structure' }, { status: 400 });
    }
    
    await savePhaseBoard(slug, data);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Phase board PUT error:', err);
    return NextResponse.json({ error: 'Failed to save phase board' }, { status: 500 });
  }
}
