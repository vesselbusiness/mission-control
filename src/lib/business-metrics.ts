import fs from "fs/promises";
import path from "path";
import { getTodosDb, getVesselDb } from "@/lib/vessel-db";
import { getStripeSummary } from "@/lib/stripe-client";

type ClientSummary = {
  slug: string;
  name: string;
  stage: string;
  lastUpdated: string;
};

const WORKSPACE =
  process.env.OPENCLAW_WORKSPACE ||
  process.env.WORKSPACE ||
  "/Users/vincent/.openclaw/workspace";
const CLIENTS_DIR = path.join(WORKSPACE, "clients");

function parseProfile(content: string): Omit<ClientSummary, "slug"> {
  const firstLine = content.split("\n")[0] ?? "";
  const name = firstLine.replace(/^#\s*/, "").trim() || "Unknown";
  const stage = content.match(/\*\*Stage:\*\*\s*([^\n]+)/)?.[1]?.trim() ?? "";
  const lastUpdated = content.match(/## Last Updated\s*\n([^\n]+)/)?.[1]?.trim() ?? "";
  return { name, stage, lastUpdated };
}

function toDateMs(input?: string | null): number | null {
  if (!input) return null;
  const ms = new Date(input).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export async function getClientsSummary(): Promise<ClientSummary[]> {
  try {
    const entries = await fs.readdir(CLIENTS_DIR, { withFileTypes: true });
    const slugs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

    const clients = await Promise.all(
      slugs.map(async (slug): Promise<ClientSummary> => {
        try {
          const profilePath = path.join(CLIENTS_DIR, slug, "PROFILE.md");
          const content = await fs.readFile(profilePath, "utf-8");
          return { slug, ...parseProfile(content) };
        } catch {
          return { slug, name: slug, stage: "", lastUpdated: "" };
        }
      })
    );
    return clients;
  } catch {
    return [];
  }
}

export async function getCallStats() {
  const clients = await getClientsSummary();
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartMs = monthStart.getTime();

  let callsThisWeek = 0;
  let callsThisMonth = 0;
  let callTodosTotal = 0;
  let callTodosDone = 0;

  for (const c of clients) {
    const callsDir = path.join(CLIENTS_DIR, c.slug, "calls");
    try {
      const entries = await fs.readdir(callsDir);
      const jsonFiles = entries.filter((f) => f.startsWith("CALL_") && f.endsWith(".json") && !f.includes("TRANSCRIPT"));
      for (const file of jsonFiles) {
        try {
          const raw = await fs.readFile(path.join(callsDir, file), "utf-8");
          const call = JSON.parse(raw) as { date?: string; todos?: Array<{ completed?: boolean }> };
          const ts = toDateMs(call.date);
          if (ts && ts >= weekAgo) callsThisWeek += 1;
          if (ts && ts >= monthStartMs) callsThisMonth += 1;

          const todos = Array.isArray(call.todos) ? call.todos : [];
          callTodosTotal += todos.length;
          callTodosDone += todos.filter((t) => !!t.completed).length;
        } catch {
          // ignore malformed file
        }
      }
    } catch {
      // no calls folder
    }
  }

  return {
    callsThisWeek,
    callsThisMonth,
    callToTaskCompletionRate:
      callTodosTotal > 0 ? Math.round((callTodosDone / callTodosTotal) * 1000) / 10 : null,
  };
}

export async function getBusinessFacts() {
  const vesselDb = getVesselDb();
  const todosDb = getTodosDb();
  const clients = await getClientsSummary();
  const callStats = await getCallStats();

  const snapshots = vesselDb
    .prepare(
      `SELECT date, mrr, active_members, new_members, churned_members
       FROM metrics_snapshots
       ORDER BY date DESC
       LIMIT 31`
    )
    .all() as Array<{
    date: string;
    mrr: number | null;
    active_members: number | null;
    new_members: number | null;
    churned_members: number | null;
  }>;

  const latest = snapshots[0] ?? null;
  const mrr = latest?.mrr ?? null; // dollars
  const activeMembers = latest?.active_members ?? null;

  const mrr7 = snapshots[6]?.mrr ?? null;
  const mrr30 = snapshots[29]?.mrr ?? null;
  const netMrr7 = mrr != null && mrr7 != null ? mrr - mrr7 : null;
  const netMrr30 = mrr != null && mrr30 != null ? mrr - mrr30 : null;

  const churnRate =
    latest && latest.active_members != null && latest.churned_members != null && latest.active_members + latest.churned_members > 0
      ? (latest.churned_members / (latest.active_members + latest.churned_members)) * 100
      : null;

  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const clientsByStage: Record<string, number> = {};
  const atRiskClients: Array<{ slug: string; name: string; days_stuck: number }> = [];
  let stageAgeTotal = 0;
  let stageAgeCount = 0;
  let moved7d = 0;

  for (const c of clients) {
    const stage = c.stage || "Unspecified";
    clientsByStage[stage] = (clientsByStage[stage] ?? 0) + 1;

    const ts = toDateMs(c.lastUpdated);
    if (ts) {
      const days = Math.floor((now - ts) / (24 * 60 * 60 * 1000));
      stageAgeTotal += days;
      stageAgeCount += 1;
      if (ts >= weekAgo) moved7d += 1;
      if (days >= 14) atRiskClients.push({ slug: c.slug, name: c.name, days_stuck: days });
    }
  }

  const avgDaysInStage = stageAgeCount > 0 ? Math.round((stageAgeTotal / stageAgeCount) * 10) / 10 : null;

  const overdueRows = todosDb
    .prepare(
      `SELECT assignee, COUNT(*) as n
       FROM todos
       WHERE due_date IS NOT NULL
         AND status != 'done'
         AND datetime(due_date) < datetime('now')
       GROUP BY assignee`
    )
    .all() as Array<{ assignee: string; n: number }>;

  const overdueTasks = overdueRows.map((r) => ({ assignee: String(r.assignee || "unassigned").toLowerCase(), count: r.n }));

  const mtmRows = vesselDb
    .prepare(`SELECT status FROM mtm_tracker`)
    .all() as Array<{ status: string }>;
  const mtmTotal = mtmRows.length;
  const mtmDone = mtmRows.filter((r) => r.status === "done").length;

  const stripe = await getStripeSummary().catch(() => null);
  const charges = stripe?.recentCharges ?? [];

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartMs = monthStart.getTime();

  const cashCollectedMtdDollars = charges
    .filter((c) => {
      const createdMs = toDateMs(c.created);
      return (createdMs ?? 0) >= monthStartMs && (c.status ?? "") !== "failed";
    })
    .reduce((sum, c) => sum + (c.amount ?? 0), 0);

  const cashCollectedMtdCents = Math.round(cashCollectedMtdDollars * 100);
  const revenueMtdCents = cashCollectedMtdCents;

  return {
    // scorecard-ish
    mrrDollars: mrr,
    netMrr7Dollars: netMrr7,
    netMrr30Dollars: netMrr30,
    activeMembers,
    churnRate,
    cashCollectedMtdCents,
    pipelineVelocity7d: moved7d,

    // delivery
    clientsByStage,
    avgDaysInStage,
    atRiskClients: atRiskClients.sort((a, b) => b.days_stuck - a.days_stuck).slice(0, 10),
    overdueTasks,

    // calls
    callsThisWeek: callStats.callsThisWeek,
    callsThisMonth: callStats.callsThisMonth,
    callToTaskCompletionRate: callStats.callToTaskCompletionRate,

    // mtm/stripe
    mtmTotal,
    mtmDone,
    stripe,
    revenueMtdCents,
  };
}
