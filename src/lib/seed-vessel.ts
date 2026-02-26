/**
 * seed-vessel.ts
 * Seeds vessel.db and todos.db with realistic Vessel Business sample data.
 * Only runs when tables are empty (safe to call on every startup).
 */
import { randomUUID } from 'crypto';
import { getTodosDb, getVesselDb } from './vessel-db';

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// ─── Seed Todos ───────────────────────────────────────────────────────────────

function seedTodos(): void {
  const db = getTodosDb();
  const count = (db.prepare('SELECT COUNT(*) as n FROM todos').get() as { n: number }).n;
  if (count > 0) return;

  const todos = [
    {
      id: randomUUID(),
      title: 'Record MTM VSL intro segment',
      description: 'Record the opening 2-minute hook for the Message to Market VSL. Focus on the transformation story.',
      assignee: 'sarah',
      priority: 'high',
      status: 'in_progress',
      due_date: today(),
      created_at: daysAgo(3),
      updated_at: daysAgo(1),
      completed_at: null,
      created_by: 'sarah',
    },
    {
      id: randomUUID(),
      title: 'Set up HighLevel automation for MATE onboarding',
      description: 'Build the 3-email welcome sequence in Vessel Business Studio for new MATE buyers.',
      assignee: 'bobby',
      priority: 'high',
      status: 'open',
      due_date: today(),
      created_at: daysAgo(2),
      updated_at: daysAgo(2),
      completed_at: null,
      created_by: 'bobby',
    },
    {
      id: randomUUID(),
      title: 'Update ICP worksheet in MEE curriculum',
      description: 'Revise Module 2 ICP worksheet based on student feedback — simplify the Cornerstone prompts.',
      assignee: 'both',
      priority: 'medium',
      status: 'open',
      due_date: null,
      created_at: daysAgo(5),
      updated_at: daysAgo(5),
      completed_at: null,
      created_by: 'agent',
    },
    {
      id: randomUUID(),
      title: 'Review and respond to MTM waitlist emails',
      description: 'Go through the 47 MTM waitlist emails and send a personal check-in to top 10.',
      assignee: 'sarah',
      priority: 'medium',
      status: 'done',
      due_date: null,
      created_at: daysAgo(7),
      updated_at: daysAgo(1),
      completed_at: daysAgo(1),
      created_by: 'sarah',
    },
    {
      id: randomUUID(),
      title: 'Fix MATE landing page mobile layout',
      description: 'The CTA button is cut off on iPhone 14. Test on mobile and push fix.',
      assignee: 'bobby',
      priority: 'low',
      status: 'open',
      due_date: null,
      created_at: daysAgo(4),
      updated_at: daysAgo(4),
      completed_at: null,
      created_by: 'agent',
    },
  ];

  const insert = db.prepare(`
    INSERT INTO todos (id, title, description, assignee, priority, status, due_date, created_at, updated_at, completed_at, created_by)
    VALUES (@id, @title, @description, @assignee, @priority, @status, @due_date, @created_at, @updated_at, @completed_at, @created_by)
  `);

  const insertMany = db.transaction((rows: typeof todos) => {
    for (const row of rows) insert.run(row);
  });

  insertMany(todos);
  console.log('[seed-vessel] Seeded 5 todos');
}

// ─── Seed Wins ────────────────────────────────────────────────────────────────

function seedWins(): void {
  const db = getVesselDb();
  const count = (db.prepare('SELECT COUNT(*) as n FROM wins').get() as { n: number }).n;
  if (count > 0) return;

  const wins = [
    {
      id: randomUUID(),
      student_name: 'Marcus T.',
      win_text: 'Just landed my first paying client! $500 discovery call booked — I used the Cornerstone framework to position myself and it worked perfectly.',
      category: 'first_client',
      source: 'discord',
      posted_at: daysAgo(1),
      featured: 1,
    },
    {
      id: randomUUID(),
      student_name: 'Priya L.',
      win_text: 'My MATE is live! Core Calling Super Prompt deployed and I already have 12 sign-ups in the first 24 hours.',
      category: 'mate_launch',
      source: 'discord',
      posted_at: daysAgo(2),
      featured: 1,
    },
    {
      id: randomUUID(),
      student_name: 'James W.',
      win_text: 'Hit $3,200 in revenue this month — first time breaking $3k. The value ladder is finally clicking.',
      category: 'revenue',
      source: 'email',
      posted_at: daysAgo(3),
      featured: 0,
    },
    {
      id: randomUUID(),
      student_name: 'Sofia R.',
      win_text: 'Had a huge breakthrough in Module 3 — I finally know exactly who I\'m talking to. My ICP is so clear now I can practically see her face.',
      category: 'breakthrough',
      source: 'discord',
      posted_at: daysAgo(5),
      featured: 0,
    },
    {
      id: randomUUID(),
      student_name: 'Derek H.',
      win_text: 'Joined the MEE community last week and already got feedback on my offer that\'s going to save me months of trial and error.',
      category: 'other',
      source: 'manual',
      posted_at: daysAgo(6),
      featured: 0,
    },
  ];

  const insert = db.prepare(`
    INSERT INTO wins (id, student_name, win_text, category, source, posted_at, featured)
    VALUES (@id, @student_name, @win_text, @category, @source, @posted_at, @featured)
  `);

  const insertMany = db.transaction((rows: typeof wins) => {
    for (const row of rows) insert.run(row);
  });

  insertMany(wins);
  console.log('[seed-vessel] Seeded 5 wins');
}

// ─── Seed Friction Log ────────────────────────────────────────────────────────

function seedFriction(): void {
  const db = getVesselDb();
  const count = (db.prepare('SELECT COUNT(*) as n FROM friction_log').get() as { n: number }).n;
  if (count > 0) return;

  const friction = [
    {
      id: randomUUID(),
      student_id: null,
      issue_title: 'Students confused by HighLevel API key setup',
      description: 'Multiple students (6 in past week) struggling to find and copy their HighLevel API key for Vessel Business Studio. The location changed in the HL UI update.',
      tool_involved: 'HighLevel / Vessel Business Studio',
      phase: 'technical',
      priority: 'high',
      status: 'open',
      occurrence_count: 6,
      suggested_fix: 'Add updated screenshot to Module 1 setup guide. Record a 2-minute walkthrough video.',
      module_to_update: 'Module 1 — Studio Setup',
      created_at: daysAgo(2),
      resolved_at: null,
    },
    {
      id: randomUUID(),
      student_id: null,
      issue_title: 'ICP definition too vague — students going broad',
      description: 'Students are defining ICPs like "entrepreneurs" or "coaches" without drilling down. Module 2 prompts need more constraint.',
      tool_involved: null,
      phase: 'icp',
      priority: 'high',
      status: 'in_progress',
      occurrence_count: 12,
      suggested_fix: 'Add the "3 Nevers" rule to ICP worksheet: Never a demographic, never an industry, never more than 500 people.',
      module_to_update: 'Module 2 — ICP Deep Dive',
      created_at: daysAgo(7),
      resolved_at: null,
    },
    {
      id: randomUUID(),
      student_id: null,
      issue_title: 'MATE web app deployment causing confusion',
      description: 'Students unsure whether to deploy MATE to Vercel or use the HL hosted version. Need a clear recommendation.',
      tool_involved: 'Vercel / HighLevel',
      phase: 'mate_build',
      priority: 'medium',
      status: 'open',
      occurrence_count: 4,
      suggested_fix: 'Add a decision tree: if tech-comfortable → Vercel, otherwise → HL hosted. Update the MATE quick-start guide.',
      module_to_update: 'MATE Launch Guide',
      created_at: daysAgo(4),
      resolved_at: null,
    },
    {
      id: randomUUID(),
      student_id: null,
      issue_title: 'VSL script feels too "salesy" for students\' audience',
      description: 'Education-niche and healing-niche students report the VSL template feels too aggressive for their audience. Need softer alternative.',
      tool_involved: null,
      phase: 'vsl',
      priority: 'medium',
      status: 'open',
      occurrence_count: 5,
      suggested_fix: 'Create a "soft sell" VSL variant for trust-based niches. Add niche-specific examples.',
      module_to_update: 'VSL Script Template',
      created_at: daysAgo(10),
      resolved_at: null,
    },
    {
      id: randomUUID(),
      student_id: null,
      issue_title: 'Community engagement drops after Week 3',
      description: 'Data shows members go quiet after Week 3. They\'ve consumed the content but don\'t know what to do next or how to share progress.',
      tool_involved: null,
      phase: 'community',
      priority: 'medium',
      status: 'open',
      occurrence_count: 8,
      suggested_fix: 'Add a Week 3 check-in prompt + accountability thread. Introduce a "First Win Showcase" pinned channel.',
      module_to_update: 'Community Onboarding Flow',
      created_at: daysAgo(14),
      resolved_at: null,
    },
    {
      id: randomUUID(),
      student_id: null,
      issue_title: 'Stripe Connect setup overwhelming for non-technical students',
      description: 'Several students abandon checkout setup when they hit the Stripe business verification step. Too many fields, unclear instructions.',
      tool_involved: 'Stripe',
      phase: 'technical',
      priority: 'high',
      status: 'resolved',
      occurrence_count: 3,
      suggested_fix: 'Created a step-by-step Stripe setup loom. Added to Resource Vault.',
      module_to_update: 'Payment Setup Guide',
      created_at: daysAgo(21),
      resolved_at: daysAgo(14),
    },
    {
      id: randomUUID(),
      student_id: null,
      issue_title: 'Cornerstone exercise taking students 3+ hours',
      description: 'The Cornerstone framework deep-dive is valuable but taking too long. Students get exhausted and lose momentum before completing it.',
      tool_involved: null,
      phase: 'icp',
      priority: 'low',
      status: 'open',
      occurrence_count: 7,
      suggested_fix: 'Break into 3 smaller sessions with save-and-resume. Add a "quick version" for students who need fast traction.',
      module_to_update: 'The Cornerstone — Module 3',
      created_at: daysAgo(9),
      resolved_at: null,
    },
    {
      id: randomUUID(),
      student_id: null,
      issue_title: 'Zoom webinar replays not loading on mobile',
      description: 'MTM webinar replays hosted on Zoom are triggering app-store redirects on iOS instead of playing inline.',
      tool_involved: 'Zoom',
      phase: 'community',
      priority: 'low',
      status: 'in_progress',
      occurrence_count: 9,
      suggested_fix: 'Re-upload key replays to Loom and embed via custom player. Zoom links stay as backup.',
      module_to_update: 'MTM Webinar Vault',
      created_at: daysAgo(6),
      resolved_at: null,
    },
  ];

  const insert = db.prepare(`
    INSERT INTO friction_log (id, student_id, issue_title, description, tool_involved, phase, priority, status, occurrence_count, suggested_fix, module_to_update, created_at, resolved_at)
    VALUES (@id, @student_id, @issue_title, @description, @tool_involved, @phase, @priority, @status, @occurrence_count, @suggested_fix, @module_to_update, @created_at, @resolved_at)
  `);

  const insertMany = db.transaction((rows: typeof friction) => {
    for (const row of rows) insert.run(row);
  });

  insertMany(friction);
  console.log('[seed-vessel] Seeded 8 friction log entries');
}

// ─── Seed Metrics Snapshot ────────────────────────────────────────────────────

function seedMetrics(): void {
  const db = getVesselDb();
  const count = (db.prepare('SELECT COUNT(*) as n FROM metrics_snapshots').get() as { n: number }).n;
  if (count > 0) return;

  const snapshot = {
    id: randomUUID(),
    date: today(),
    mrr: 39624,
    active_members: 312,
    new_members: 8,
    churned_members: 2,
    mate_launches: 14,
    mtm_waitlist: 47,
    wins_count: 5,
    friction_open: 6,
    stripe_payout_pending: 8450.75,
    created_at: new Date().toISOString(),
  };

  db.prepare(`
    INSERT INTO metrics_snapshots (id, date, mrr, active_members, new_members, churned_members, mate_launches, mtm_waitlist, wins_count, friction_open, stripe_payout_pending, created_at)
    VALUES (@id, @date, @mrr, @active_members, @new_members, @churned_members, @mate_launches, @mtm_waitlist, @wins_count, @friction_open, @stripe_payout_pending, @created_at)
  `).run(snapshot);

  console.log('[seed-vessel] Seeded 1 metrics snapshot');
}

// ─── Seed MTM Tracker ─────────────────────────────────────────────────────────

function seedMtm(): void {
  const db = getVesselDb();
  const count = (db.prepare('SELECT COUNT(*) as n FROM mtm_tracker').get() as { n: number }).n;
  if (count > 0) return;

  const items = [
    {
      id: randomUUID(),
      item_name: 'MTM VSL — Full Script (Draft)',
      category: 'vsl',
      status: 'in_progress',
      owner: 'sarah',
      notes: 'Opening hook drafted. Need middle section + close.',
      updated_at: daysAgo(1),
    },
    {
      id: randomUUID(),
      item_name: 'MTM VSL — Video Recording',
      category: 'vsl',
      status: 'not_started',
      owner: 'sarah',
      notes: 'Blocked on final script.',
      updated_at: daysAgo(3),
    },
    {
      id: randomUUID(),
      item_name: 'MTM Landing Page — Hero Section Copy',
      category: 'landing_page',
      status: 'done',
      owner: 'bobby',
      notes: 'Approved by Sarah. Live.',
      updated_at: daysAgo(5),
    },
    {
      id: randomUUID(),
      item_name: 'MTM Landing Page — Testimonials Section',
      category: 'landing_page',
      status: 'in_progress',
      owner: 'bobby',
      notes: 'Collecting 3 more case studies. Need photos.',
      updated_at: daysAgo(2),
    },
    {
      id: randomUUID(),
      item_name: 'MTM Landing Page — FAQ Section',
      category: 'landing_page',
      status: 'not_started',
      owner: 'sarah',
      notes: 'Pull top 10 questions from MTM waitlist emails.',
      updated_at: daysAgo(4),
    },
    {
      id: randomUUID(),
      item_name: 'MTM Email Sequence — Nurture (5 emails)',
      category: 'email',
      status: 'in_progress',
      owner: 'agent',
      notes: '3 of 5 emails drafted. Emails 4 and 5 remaining.',
      updated_at: daysAgo(1),
    },
    {
      id: randomUUID(),
      item_name: 'MTM Sales Page — Checkout Copy',
      category: 'copy',
      status: 'not_started',
      owner: 'bobby',
      notes: 'Waiting on final pricing decision.',
      updated_at: daysAgo(6),
    },
    {
      id: randomUUID(),
      item_name: 'MTM Launch Announcement — Social Copy',
      category: 'copy',
      status: 'not_started',
      owner: 'agent',
      notes: 'Needs 3 variations: Instagram, LinkedIn, email blast.',
      updated_at: daysAgo(7),
    },
  ];

  const insert = db.prepare(`
    INSERT INTO mtm_tracker (id, item_name, category, status, owner, notes, updated_at)
    VALUES (@id, @item_name, @category, @status, @owner, @notes, @updated_at)
  `);

  const insertMany = db.transaction((rows: typeof items) => {
    for (const row of rows) insert.run(row);
  });

  insertMany(items);
  console.log('[seed-vessel] Seeded 8 MTM tracker items');
}

// ─── Run all seeds ────────────────────────────────────────────────────────────

/**
 * seedVesselData
 * Run all seed functions. Each is idempotent — skips if table already has data.
 * Call this during app initialization.
 */
export function seedVesselData(): void {
  try {
    seedTodos();
    seedWins();
    seedFriction();
    seedMetrics();
    seedMtm();
  } catch (error) {
    console.error('[seed-vessel] Seed failed:', error);
    // Non-fatal: don't crash the app if seeding fails
  }
}
