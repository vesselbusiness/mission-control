import fs from "fs/promises";
import path from "path";

const WORKSPACE =
  process.env.OPENCLAW_WORKSPACE ||
  process.env.WORKSPACE ||
  "/Users/vincent/.openclaw/workspace";

export interface ClientMemoryEvent {
  source: "ideas" | "todos" | "calls" | "docs" | "overrides" | "links" | "assets" | "system" | string;
  action: "create" | "update" | "delete" | "bulk_import" | string;
  summary: string;
  entityId?: string;
  data?: unknown;
  createdAt?: string;
}

function getClientDir(slug: string) {
  return path.join(WORKSPACE, "clients", slug);
}

function monthFileName(iso: string) {
  return `${iso.slice(0, 7)}.md`; // YYYY-MM.md
}

function sanitizeSummary(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

export async function appendClientMemoryEvent(slug: string, event: ClientMemoryEvent) {
  const createdAt = event.createdAt || new Date().toISOString();
  const safeEvent: ClientMemoryEvent = {
    ...event,
    createdAt,
    summary: sanitizeSummary(event.summary || "(no summary)"),
  };

  const clientDir = getClientDir(slug);
  const timelineDir = path.join(clientDir, "timeline");
  await fs.mkdir(timelineDir, { recursive: true });

  const jsonlPath = path.join(timelineDir, "events.jsonl");
  await fs.appendFile(jsonlPath, `${JSON.stringify(safeEvent)}\n`, "utf-8");

  const mdPath = path.join(timelineDir, monthFileName(createdAt));
  const line = `- [${createdAt}] [${safeEvent.source}/${safeEvent.action}] ${safeEvent.summary}${safeEvent.entityId ? ` (id: ${safeEvent.entityId})` : ""}\n`;
  await fs.appendFile(mdPath, line, "utf-8");

  return safeEvent;
}

export async function readClientMemoryEvents(slug: string, limit = 50) {
  const jsonlPath = path.join(getClientDir(slug), "timeline", "events.jsonl");
  try {
    const raw = await fs.readFile(jsonlPath, "utf-8");
    const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
    const items = lines
      .map((line) => {
        try {
          return JSON.parse(line) as ClientMemoryEvent;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as ClientMemoryEvent[];
    return items.slice(-Math.max(1, Math.min(limit, 500))).reverse();
  } catch {
    return [] as ClientMemoryEvent[];
  }
}
