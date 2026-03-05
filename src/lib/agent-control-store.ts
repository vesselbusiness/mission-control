import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

const WORKSPACE = process.env.WORKSPACE || "/Users/vincent/.openclaw/workspace";
const BASE_DIR = join(WORKSPACE, "data", "agent-control");

export type AgentStatus = "idle" | "running" | "error" | "paused";
export type QueueStatus = "pending" | "running" | "failed" | "completed";

export interface AgentStatusItem {
  agent_key: string;
  display_name: string;
  status: AgentStatus;
  current_task: string | null;
  last_run_at: string | null;
  success_rate_7d: number;
}

export interface QueueItem {
  id: string;
  trace_id: string;
  command: string;
  payload: Record<string, unknown>;
  requested_by: string;
  status: QueueStatus;
  created_at: string;
  updated_at: string;
  error?: string | null;
}

export interface ApprovalItem {
  id: string;
  trace_id: string;
  action: string;
  target: string;
  payload: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
  requested_by: string;
  created_at: string;
  updated_at: string;
  decided_by?: string;
  decision_note?: string;
}

export interface RunItem {
  trace_id: string;
  agent_key: string;
  action: string;
  target: string;
  status: "success" | "failed" | "running" | "queued";
  started_at: string;
  ended_at: string | null;
  error: string | null;
}

function filePath(name: string) {
  return join(BASE_DIR, `${name}.json`);
}

async function ensureDir() {
  await mkdir(BASE_DIR, { recursive: true });
}

async function loadJson<T>(name: string, fallback: T): Promise<T> {
  await ensureDir();
  const path = filePath(name);
  if (!existsSync(path)) {
    await writeJson(name, fallback);
    return fallback;
  }
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(name: string, value: T): Promise<void> {
  await ensureDir();
  await writeFile(filePath(name), JSON.stringify(value, null, 2), "utf-8");
}

function nowIso() {
  return new Date().toISOString();
}

export async function getAgents(): Promise<{ agents: AgentStatusItem[]; heartbeat_at: string }> {
  const fallback = {
    heartbeat_at: nowIso(),
    agents: [
      {
        agent_key: "vincent",
        display_name: "Vincent",
        status: "idle" as AgentStatus,
        current_task: null,
        last_run_at: null,
        success_rate_7d: 1,
      },
    ],
  };
  const data = await loadJson("agents", fallback);
  return data;
}

export async function saveAgents(data: { agents: AgentStatusItem[]; heartbeat_at: string }) {
  await writeJson("agents", data);
}

export async function getQueueItems(): Promise<QueueItem[]> {
  return loadJson<QueueItem[]>("queue", []);
}

export async function saveQueueItems(items: QueueItem[]) {
  await writeJson("queue", items);
}

export async function getApprovals(): Promise<ApprovalItem[]> {
  return loadJson<ApprovalItem[]>("approvals", []);
}

export async function saveApprovals(items: ApprovalItem[]) {
  await writeJson("approvals", items);
}

export async function getRuns(): Promise<RunItem[]> {
  return loadJson<RunItem[]>("runs", []);
}

export async function saveRuns(items: RunItem[]) {
  await writeJson("runs", items);
}

export function buildQueueSnapshot(items: QueueItem[]) {
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;

  const pendingItems = items.filter((i) => i.status === "pending");
  const running = items.filter((i) => i.status === "running").length;
  const failed24h = items.filter((i) => i.status === "failed" && new Date(i.updated_at).getTime() >= dayAgo).length;
  const completed24h = items.filter((i) => i.status === "completed" && new Date(i.updated_at).getTime() >= dayAgo).length;

  const oldestPendingTs = pendingItems
    .map((i) => new Date(i.created_at).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b)[0];

  const oldest_pending_seconds = oldestPendingTs ? Math.max(0, Math.floor((now - oldestPendingTs) / 1000)) : 0;

  return {
    pending: pendingItems.length,
    running,
    failed_24h: failed24h,
    completed_24h: completed24h,
    oldest_pending_seconds,
    items,
  };
}

export async function enqueueCommand(input: {
  command: string;
  payload?: Record<string, unknown>;
  requested_by?: string;
}) {
  const created = nowIso();
  const trace_id = `tr_${randomUUID()}`;
  const queueItem: QueueItem = {
    id: randomUUID(),
    trace_id,
    command: input.command,
    payload: input.payload ?? {},
    requested_by: input.requested_by ?? "unknown",
    status: "pending",
    created_at: created,
    updated_at: created,
    error: null,
  };

  const run: RunItem = {
    trace_id,
    agent_key: "vincent",
    action: input.command,
    target: String((input.payload ?? {}).target ?? "general"),
    status: "queued",
    started_at: created,
    ended_at: null,
    error: null,
  };

  const [queue, runs] = await Promise.all([getQueueItems(), getRuns()]);
  queue.unshift(queueItem);
  runs.unshift(run);

  await Promise.all([saveQueueItems(queue), saveRuns(runs)]);

  return { accepted: true, trace_id, queue_item: queueItem };
}

export async function retryRun(traceId: string) {
  const [queue, runs] = await Promise.all([getQueueItems(), getRuns()]);
  const run = runs.find((r) => r.trace_id === traceId);
  if (!run) return null;

  const created = nowIso();
  const queueItem: QueueItem = {
    id: randomUUID(),
    trace_id: `tr_${randomUUID()}`,
    command: run.action,
    payload: { retry_of: traceId, target: run.target },
    requested_by: "system",
    status: "pending",
    created_at: created,
    updated_at: created,
    error: null,
  };

  const newRun: RunItem = {
    trace_id: queueItem.trace_id,
    agent_key: run.agent_key,
    action: run.action,
    target: run.target,
    status: "queued",
    started_at: created,
    ended_at: null,
    error: null,
  };

  queue.unshift(queueItem);
  runs.unshift(newRun);
  await Promise.all([saveQueueItems(queue), saveRuns(runs)]);

  return { accepted: true, trace_id: queueItem.trace_id };
}
