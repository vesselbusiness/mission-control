/**
 * PATCH /api/friction/[id] — update a friction entry (resolve, increment count, etc.)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getVesselDb } from '@/lib/vessel-db';

const UpdateFrictionSchema = z.object({
  issue_title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  tool_involved: z.string().nullable().optional(),
  phase: z.enum(['mate_build', 'icp', 'vsl', 'community', 'technical', 'other']).nullable().optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  status: z.enum(['open', 'in_progress', 'resolved']).optional(),
  occurrence_count: z.number().int().min(1).optional(),
  suggested_fix: z.string().nullable().optional(),
  module_to_update: z.string().nullable().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided to update',
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getVesselDb();

    const existing = db.prepare('SELECT * FROM friction_log WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Friction entry not found' }, { status: 404 });
    }

    const body: unknown = await request.json();
    const parsed = UpdateFrictionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const now = new Date().toISOString();
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.issue_title !== undefined) { fields.push('issue_title = ?'); values.push(data.issue_title); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
    if (data.tool_involved !== undefined) { fields.push('tool_involved = ?'); values.push(data.tool_involved); }
    if (data.phase !== undefined) { fields.push('phase = ?'); values.push(data.phase); }
    if (data.priority !== undefined) { fields.push('priority = ?'); values.push(data.priority); }
    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
      // Auto-set resolved_at when resolving
      if (data.status === 'resolved') {
        fields.push('resolved_at = ?');
        values.push(now);
      } else {
        fields.push('resolved_at = NULL');
      }
    }
    if (data.occurrence_count !== undefined) { fields.push('occurrence_count = ?'); values.push(data.occurrence_count); }
    if (data.suggested_fix !== undefined) { fields.push('suggested_fix = ?'); values.push(data.suggested_fix); }
    if (data.module_to_update !== undefined) { fields.push('module_to_update = ?'); values.push(data.module_to_update); }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(id);
    db.prepare(`UPDATE friction_log SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM friction_log WHERE id = ?').get(id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[friction] PATCH failed:', error);
    return NextResponse.json({ error: 'Failed to update friction entry' }, { status: 500 });
  }
}
