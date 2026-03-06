import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { appendClientMemoryEvent } from '@/lib/client-memory';

const WORKSPACE = process.env.WORKSPACE || '/Users/vincent/.openclaw/workspace';

interface TodoTask {
  id: string;
  linkedPhaseTaskId: string;
  label: string;
  assignee: 'bobby' | 'sarah' | 'client' | null;
  priority: 'low' | 'mid' | 'high' | null;
  status: 'assigned' | 'in_progress' | 'review' | 'completed';
  notes?: string;
  dueDate?: string | null;
  phase?: string;
  archived?: boolean;
  createdAt: string;
  completedAt: string | null;
}

interface TodoListData {
  tasks: TodoTask[];
}

async function getTodoPath(slug: string): Promise<string> {
  return join(WORKSPACE, 'clients', slug, 'TODO_LIST.json');
}

async function loadTodos(slug: string): Promise<TodoListData> {
  const path = await getTodoPath(slug);
  
  if (!existsSync(path)) {
    return { tasks: [] };
  }
  
  try {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { tasks: [] };
  }
}

async function saveTodos(slug: string, data: TodoListData): Promise<void> {
  const path = await getTodoPath(slug);
  await writeFile(path, JSON.stringify(data, null, 2), 'utf-8');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const todos = await loadTodos(slug);
    return NextResponse.json(todos);
  } catch (err) {
    console.error('Todos GET error:', err);
    return NextResponse.json({ error: 'Failed to load todos' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    
    const { label, linkedPhaseTaskId, assignee, priority, status, notes, dueDate, phase, archived } = body;
    
    if (!label) {
      return NextResponse.json(
        { error: 'label required' },
        { status: 400 }
      );
    }
    
    const todos = await loadTodos(slug);
    
    const newTask: TodoTask = {
      id: randomUUID(),
      linkedPhaseTaskId: linkedPhaseTaskId || `manual-${Date.now()}`,
      label,
      assignee: assignee || null,
      priority: priority || null,
      status: status || 'assigned',
      notes: typeof notes === 'string' ? notes : undefined,
      dueDate: typeof dueDate === 'string' ? dueDate : null,
      phase: typeof phase === 'string' ? phase : undefined,
      archived: Boolean(archived),
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    
    todos.tasks.push(newTask);
    await saveTodos(slug, todos);

    await appendClientMemoryEvent(slug, {
      source: 'todos',
      action: 'create',
      entityId: newTask.id,
      summary: `Added todo: ${newTask.label.slice(0, 120)}`,
      data: newTask,
    });
    
    return NextResponse.json(newTask, { status: 201 });
  } catch (err) {
    console.error('Todos POST error:', err);
    return NextResponse.json({ error: 'Failed to create todo' }, { status: 500 });
  }
}
