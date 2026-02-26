/**
 * PATCH /api/todos/[id]  — update a todo
 * DELETE /api/todos/[id] — delete a todo
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getTodosDb } from '@/lib/vessel-db';

const UpdateTodoSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  assignee: z.enum(['sarah', 'bobby', 'both']).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  status: z.enum(['open', 'in_progress', 'done']).optional(),
  due_date: z.string().nullable().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided to update',
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getTodosDb();

    const existing = db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    const body: unknown = await request.json();
    const parsed = UpdateTodoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const now = new Date().toISOString();

    // Build dynamic SET clause
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
    if (data.assignee !== undefined) { fields.push('assignee = ?'); values.push(data.assignee); }
    if (data.priority !== undefined) { fields.push('priority = ?'); values.push(data.priority); }
    if (data.status !== undefined) {
      fields.push('status = ?'); values.push(data.status);
      // Auto-set completed_at when marking done
      if (data.status === 'done') {
        fields.push('completed_at = ?');
        values.push(now);
      } else if (data.status === 'open' || data.status === 'in_progress') {
        fields.push('completed_at = NULL');
      }
    }
    if (data.due_date !== undefined) { fields.push('due_date = ?'); values.push(data.due_date); }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    db.prepare(`UPDATE todos SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[todos] PATCH failed:', error);
    return NextResponse.json({ error: 'Failed to update todo' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getTodosDb();

    const existing = db.prepare('SELECT id FROM todos WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    db.prepare('DELETE FROM todos WHERE id = ?').run(id);
    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    console.error('[todos] DELETE failed:', error);
    return NextResponse.json({ error: 'Failed to delete todo' }, { status: 500 });
  }
}
