/**
 * PATCH /api/wins/[id] — update a win (e.g. mark featured)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getVesselDb } from '@/lib/vessel-db';

const UpdateWinSchema = z.object({
  student_name: z.string().nullable().optional(),
  win_text: z.string().min(1).optional(),
  category: z.enum(['first_client', 'mate_launch', 'revenue', 'breakthrough', 'other']).nullable().optional(),
  source: z.enum(['discord', 'email', 'manual']).nullable().optional(),
  featured: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided to update',
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getVesselDb();

    const existing = db.prepare('SELECT * FROM wins WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Win not found' }, { status: 404 });
    }

    const body: unknown = await request.json();
    const parsed = UpdateWinSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.student_name !== undefined) { fields.push('student_name = ?'); values.push(data.student_name); }
    if (data.win_text !== undefined) { fields.push('win_text = ?'); values.push(data.win_text); }
    if (data.category !== undefined) { fields.push('category = ?'); values.push(data.category); }
    if (data.source !== undefined) { fields.push('source = ?'); values.push(data.source); }
    if (data.featured !== undefined) { fields.push('featured = ?'); values.push(data.featured ? 1 : 0); }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(id);
    db.prepare(`UPDATE wins SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM wins WHERE id = ?').get(id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[wins] PATCH failed:', error);
    return NextResponse.json({ error: 'Failed to update win' }, { status: 500 });
  }
}
