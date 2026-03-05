import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { appendClientMemoryEvent } from '@/lib/client-memory';

const WORKSPACE = process.env.WORKSPACE || '/Users/vincent/.openclaw/workspace';

interface TodoTask {
  id: string;
  linkedPhaseTaskId: string;
  label: string;
  assignee: 'bobby' | 'sarah' | 'client' | null;
  priority: 'low' | 'mid' | 'high' | null;
  status: 'assigned' | 'in_progress' | 'review' | 'completed';
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const updates = await request.json();
    
    const todos = await loadTodos(slug);
    const taskIndex = todos.tasks.findIndex(t => t.id === id);
    
    if (taskIndex === -1) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    
    const task = todos.tasks[taskIndex];
    
    // Update allowed fields
    if (updates.status !== undefined) task.status = updates.status;
    if (updates.priority !== undefined) task.priority = updates.priority;
    if (updates.assignee !== undefined) task.assignee = updates.assignee;
    if (updates.label !== undefined) task.label = updates.label;
    if (updates.completedAt !== undefined) task.completedAt = updates.completedAt;
    
    todos.tasks[taskIndex] = task;
    await saveTodos(slug, todos);

    await appendClientMemoryEvent(slug, {
      source: 'todos',
      action: 'update',
      entityId: task.id,
      summary: `Updated todo: ${task.label.slice(0, 120)}`,
      data: updates,
    });
    
    return NextResponse.json(task);
  } catch (err) {
    console.error('Todos PATCH error:', err);
    return NextResponse.json({ error: 'Failed to update todo' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    
    const todos = await loadTodos(slug);
    const initialLength = todos.tasks.length;
    todos.tasks = todos.tasks.filter(t => t.id !== id);
    
    if (todos.tasks.length === initialLength) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    
    await saveTodos(slug, todos);

    await appendClientMemoryEvent(slug, {
      source: 'todos',
      action: 'delete',
      entityId: id,
      summary: `Deleted todo ${id}`,
    });
    
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Todos DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete todo' }, { status: 500 });
  }
}
