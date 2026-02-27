/**
 * Session Cost Parser
 * Reads OpenClaw session JSONL files and extracts real token/cost data.
 */

import fs from "fs";
import path from "path";
import readline from "readline";
import os from "os";

const OPENCLAW_DIR = path.join(os.homedir(), ".openclaw");
const AGENTS = ["main", "cody", "reggie"];

export interface UsageRecord {
  timestamp: number; // ms
  date: string; // YYYY-MM-DD
  hour: number; // 0-23
  agent: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  cost: number;
}

interface RawMessage {
  type: string;
  message?: {
    role: string;
    api?: string;
    provider?: string;
    model?: string;
    usage?: {
      input: number;
      output: number;
      cacheRead?: number;
      cacheWrite?: number;
      totalTokens: number;
      cost?: {
        input: number;
        output: number;
        cacheRead?: number;
        cacheWrite?: number;
        total: number;
      };
    };
    timestamp?: number;
  };
}

/**
 * Parse a single JSONL session file and return usage records.
 */
async function parseSessionFile(
  filePath: string,
  agent: string
): Promise<UsageRecord[]> {
  const records: UsageRecord[] = [];

  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line) as RawMessage;
      if (
        obj.type === "message" &&
        obj.message?.role === "assistant" &&
        obj.message.usage?.cost?.total !== undefined
      ) {
        const msg = obj.message;
        const usage = msg.usage!;
        const cost = usage.cost!;
        const ts = msg.timestamp ?? Date.now();
        const d = new Date(ts);
        const dateStr = d.toISOString().split("T")[0];
        const hour = d.getHours();

        records.push({
          timestamp: ts,
          date: dateStr,
          hour,
          agent,
          model: msg.model ?? "unknown",
          inputTokens: usage.input ?? 0,
          outputTokens: usage.output ?? 0,
          cacheReadTokens: usage.cacheRead ?? 0,
          cacheWriteTokens: usage.cacheWrite ?? 0,
          totalTokens: usage.totalTokens ?? 0,
          cost: cost.total ?? 0,
        });
      }
    } catch {
      // malformed line — skip
    }
  }

  return records;
}

/**
 * Get all active (non-deleted, non-reset) session JSONL files for an agent.
 */
function getSessionFiles(agent: string): string[] {
  const sessionsDir = path.join(OPENCLAW_DIR, "agents", agent, "sessions");
  if (!fs.existsSync(sessionsDir)) return [];

  return fs
    .readdirSync(sessionsDir)
    .filter(
      (f) =>
        f.endsWith(".jsonl") &&
        !f.includes(".deleted") &&
        !f.includes(".reset") &&
        !f.includes(".lock")
    )
    .map((f) => path.join(sessionsDir, f));
}

/**
 * Load all usage records from all agents' sessions.
 * Uses a simple in-memory cache keyed by file mtime.
 */
const _fileCache = new Map<string, { mtime: number; records: UsageRecord[] }>();

async function loadAgentRecords(agent: string): Promise<UsageRecord[]> {
  const files = getSessionFiles(agent);
  const all: UsageRecord[] = [];

  for (const filePath of files) {
    const stat = fs.statSync(filePath);
    const mtime = stat.mtimeMs;
    const cached = _fileCache.get(filePath);

    if (cached && cached.mtime === mtime) {
      all.push(...cached.records);
    } else {
      const records = await parseSessionFile(filePath, agent);
      _fileCache.set(filePath, { mtime, records });
      all.push(...records);
    }
  }

  return all;
}

export async function getAllUsageRecords(): Promise<UsageRecord[]> {
  const results = await Promise.all(AGENTS.map(loadAgentRecords));
  return results.flat().sort((a, b) => a.timestamp - b.timestamp);
}

// ---------------------------------------------------------------------------
// Aggregation helpers
// ---------------------------------------------------------------------------

function dateStr(ts: number): string {
  return new Date(ts).toISOString().split("T")[0];
}

export interface CostSummary {
  today: number;
  yesterday: number;
  thisMonth: number;
  lastMonth: number;
  projected: number;
}

export function computeSummary(records: UsageRecord[]): CostSummary {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  const yd = new Date(now);
  yd.setDate(yd.getDate() - 1);
  const yesterdayStr = yd.toISOString().split("T")[0];

  const thisMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthPrefix = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;

  let today = 0,
    yesterday = 0,
    thisMonth = 0,
    lastMonth = 0;

  for (const r of records) {
    if (r.date === todayStr) today += r.cost;
    if (r.date === yesterdayStr) yesterday += r.cost;
    if (r.date.startsWith(thisMonthPrefix)) thisMonth += r.cost;
    if (r.date.startsWith(lastMonthPrefix)) lastMonth += r.cost;
  }

  const daysElapsed = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projected = daysElapsed > 0 ? (thisMonth / daysElapsed) * daysInMonth : 0;

  return { today, yesterday, thisMonth, lastMonth, projected };
}

export interface AgentCost {
  agent: string;
  cost: number;
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  percentOfTotal: number;
}

export function computeByAgent(records: UsageRecord[], days = 30): AgentCost[] {
  const cutoff = Date.now() - days * 86400000;
  const map = new Map<string, AgentCost>();

  for (const r of records) {
    if (r.timestamp < cutoff) continue;
    const entry = map.get(r.agent) ?? {
      agent: r.agent,
      cost: 0,
      tokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      percentOfTotal: 0,
    };
    entry.cost += r.cost;
    entry.tokens += r.totalTokens;
    entry.inputTokens += r.inputTokens;
    entry.outputTokens += r.outputTokens;
    map.set(r.agent, entry);
  }

  const arr = [...map.values()].sort((a, b) => b.cost - a.cost);
  const total = arr.reduce((s, x) => s + x.cost, 0);
  return arr.map((a) => ({ ...a, percentOfTotal: total > 0 ? (a.cost / total) * 100 : 0 }));
}

export interface ModelCost {
  model: string;
  cost: number;
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  percentOfTotal: number;
}

export function computeByModel(records: UsageRecord[], days = 30): ModelCost[] {
  const cutoff = Date.now() - days * 86400000;
  const map = new Map<string, ModelCost>();

  for (const r of records) {
    if (r.timestamp < cutoff) continue;
    const key = r.model;
    const entry = map.get(key) ?? {
      model: key,
      cost: 0,
      tokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      percentOfTotal: 0,
    };
    entry.cost += r.cost;
    entry.tokens += r.totalTokens;
    entry.inputTokens += r.inputTokens;
    entry.outputTokens += r.outputTokens;
    map.set(key, entry);
  }

  const arr = [...map.values()].sort((a, b) => b.cost - a.cost);
  const total = arr.reduce((s, x) => s + x.cost, 0);
  return arr.map((m) => ({ ...m, percentOfTotal: total > 0 ? (m.cost / total) * 100 : 0 }));
}

export interface DailyCost {
  date: string; // MM-DD
  cost: number;
  input: number;
  output: number;
}

export function computeDaily(records: UsageRecord[], days = 30): DailyCost[] {
  const cutoff = Date.now() - days * 86400000;
  const map = new Map<string, { cost: number; input: number; output: number }>();

  for (const r of records) {
    if (r.timestamp < cutoff) continue;
    const entry = map.get(r.date) ?? { cost: 0, input: 0, output: 0 };
    entry.cost += r.cost;
    entry.input += r.inputTokens;
    entry.output += r.outputTokens;
    map.set(r.date, entry);
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date: date.slice(5), // YYYY-MM-DD → MM-DD
      cost: parseFloat(v.cost.toFixed(4)),
      input: v.input,
      output: v.output,
    }));
}

export interface HourlyCost {
  hour: string; // HH:00
  cost: number;
}

export function computeHourly(records: UsageRecord[]): HourlyCost[] {
  const cutoff = Date.now() - 24 * 3600000;
  const map = new Map<number, number>();

  for (const r of records) {
    if (r.timestamp < cutoff) continue;
    map.set(r.hour, (map.get(r.hour) ?? 0) + r.cost);
  }

  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([h, cost]) => ({
      hour: `${String(h).padStart(2, "0")}:00`,
      cost: parseFloat(cost.toFixed(4)),
    }));
}
