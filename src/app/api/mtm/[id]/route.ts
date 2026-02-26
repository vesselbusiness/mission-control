/**
 * PATCH /api/mtm/[id] — update an MTM tracker item's status or details
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getVesselDb } from '@/lib/vessel-db';

const UpdateMtmSchema = z.object({
  item_name: z.string().min(1).optional(),
  category: z.enum(['vsl', 'copy', 'landing_page', 'email', 'other']).optional(),
  status: z.enum(['not_started', 'in_progress', 'done']).optional(),
  owner: z.enum(['sarah', 'bobby', 'agent']).nullable().optional(),
  notes: z.string().nullable().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided to update',
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getVesselDb();

    const existing = db.prepare('SELECT * FROM mtm_tracker WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'MTM item not found' }, { status: 404 });
    }

    const body: unknown = await request.json();
    const parsed = UpdateMtmSchema.safeParse(body);
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

    if (data.item_name !== undefined) { fields.push('item_name = ?'); values.push(data.item_name); }
    if (data.category !== undefined) { fields.push('category = ?'); values.push(data.category); }
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    if (data.owner !== undefined) { fields.push('owner = ?'); values.push(data.owner); }
    if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes); }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    db.prepare(`UPDATE mtm_tracker SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM mtm_tracker WHERE id = ?').get(id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[mtm] PATCH failed:', error);
    return NextResponse.json({ error: 'Failed to update MTM item' }, { status: 500 });
  }
}
