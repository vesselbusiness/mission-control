/**
 * GET  /api/clients/[slug]/calls — list all coaching call records
 * POST /api/clients/[slug]/calls — upload + analyze a transcript, save call JSON + md
 *
 * Data location: {workspace}/clients/{slug}/calls/
 *   CALL_YYYY_MM_DD.json          — structured call metadata
 *   CALL_YYYY_MM_DD_TRANSCRIPT.md — raw transcript text
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import mammoth from "mammoth";
import { appendClientMemoryEvent } from "@/lib/client-memory";

export const dynamic = "force-dynamic";

// ─── Config ───────────────────────────────────────────────────────────────────

const WORKSPACE =
  process.env.OPENCLAW_WORKSPACE ?? "/Users/vincent/.openclaw/workspace";
const CLIENTS_DIR = path.join(WORKSPACE, "clients");

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CallTodo {
  id: string;
  description: string;
  owner: "sarah" | "bobby" | "client";
  completed: boolean;
  taskBoardId?: string; // ID from /api/todos after push
}

export interface CoachingCall {
  id: string;           // e.g. "2026-02-25"
  date: string;         // ISO date "YYYY-MM-DD"
  videoUrl: string;
  overview: string;
  ahas: string[];
  decisions: string[];
  openLoops: string[];
  todos: CallTodo[];
  parkedIdeas: string[];
  followUpNotes: string;
  transcriptFile: string; // e.g. "CALL_2026_02_25_TRANSCRIPT.md"
  analyzed: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateToFileSlug(date: string): string {
  return date.replace(/-/g, "_"); // "2026-02-25" → "2026_02_25"
}

function cleanExtractedText(text: string): string {
  return text.replace(/\\(.)/g, "$1");
}

/**
 * Derive a date from the uploaded filename if it embeds a date.
 * Accepts: YYYY-MM-DD, YYYYMMDD, or a name ending in those patterns.
 */
function dateFromFilename(filename: string): string | null {
  // Try YYYY-MM-DD
  const m1 = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
  // Try YYYYMMDD
  const m2 = filename.match(/(\d{4})(\d{2})(\d{2})/);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
  return null;
}

type Params = { params: Promise<{ slug: string }> };

// ─── Helpers: parse Fireflies transcript MD into a CoachingCall ──────────────

/**
 * Fireflies-analyzed transcripts land in clients/{slug}/transcripts/ as:
 *   {YYYY-MM-DD}-{call-type}.md
 *
 * The markdown header contains Summary, Key Insights, Wins, Blockers, Action Items.
 * We parse those into a CoachingCall shape so they render in the same UI.
 */
function parseFirefliesTranscript(filename: string, content: string): CoachingCall | null {
  // Extract date and call type from filename: "2026-02-25-1-on-1.md"
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
  if (!match) return null;

  const date = match[1];
  const callType = match[2].replace(/-/g, " ");

  // Parse header sections
  const overview = extractSection(content, "Summary") ||
    extractSection(content, "Overview") || "";
  const ahas = extractBullets(content, "Key Insights");
  const decisions = extractBullets(content, "Decisions");
  const openLoops = extractBullets(content, "Blockers").concat(extractBullets(content, "Open Loops"));
  const parkedIdeas = extractBullets(content, "Parked Ideas").concat(extractBullets(content, "Ideas"));
  const followUpNotes = extractSection(content, "Follow") || "";

  // Parse action items into todos
  const rawTodos = extractBullets(content, "Action Items");
  const todos: CallTodo[] = rawTodos.map((t, i) => {
    const ownerMatch = t.match(/\(?(Bobby|Sarah|Client)\)?/i);
    const owner = ownerMatch
      ? (ownerMatch[1].toLowerCase() as "bobby" | "sarah" | "client")
      : "sarah";
    return {
      id: `ff-todo-${date}-${i}`,
      description: t.replace(/\s*\(?(Bobby|Sarah|Client)\)?\s*/i, "").replace(/^-\s*\[\s*[x ]?\s*\]\s*/, "").trim(),
      owner,
      completed: t.includes("[x]"),
    };
  });

  // Extract video URL from header if present
  const videoMatch = content.match(/\*\*Recording:\*\*\s*\[?(?:Link\])?\(?([^\s)]+)\)?/);
  const videoUrl = videoMatch ? videoMatch[1] : "";

  return {
    id: `ff-${date}-${match[2]}`,
    date,
    videoUrl,
    overview,
    ahas,
    decisions,
    openLoops,
    todos,
    parkedIdeas,
    followUpNotes: `Call type: ${callType}. ${followUpNotes}`.trim(),
    transcriptFile: filename,
    analyzed: true,
    source: "fireflies",
  } as CoachingCall & { source: string };
}

function extractSection(content: string, heading: string): string {
  const regex = new RegExp(`##\\s+${heading}[^\n]*\n([^#]+)`, "i");
  const match = content.match(regex);
  return match ? match[1].trim() : "";
}

function extractBullets(content: string, heading: string): string[] {
  const section = extractSection(content, heading);
  if (!section) return [];
  return section
    .split("\n")
    .map((l) => l.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: Params
) {
  try {
    const { slug } = await params;
    const callsDir = path.join(CLIENTS_DIR, slug, "calls");
    const transcriptsDir = path.join(CLIENTS_DIR, slug, "transcripts");

    const calls: CoachingCall[] = [];

    // ── 1. Read structured calls/ JSON files (manual uploads) ────────────
    try {
      const entries = await fs.readdir(callsDir);
      const jsonFiles = entries.filter(
        (f) => f.startsWith("CALL_") && f.endsWith(".json") && !f.includes("TRANSCRIPT")
      );
      for (const file of jsonFiles) {
        try {
          const raw = await fs.readFile(path.join(callsDir, file), "utf-8");
          const call = JSON.parse(raw) as CoachingCall;
          calls.push({ ...call, source: "manual" } as CoachingCall & { source: string });
        } catch { /* skip corrupt */ }
      }
    } catch { /* calls/ dir doesn't exist yet */ }

    // ── 2. Read transcripts/ MD files (Fireflies auto-analyzed) ──────────
    try {
      const entries = await fs.readdir(transcriptsDir);
      const mdFiles = entries.filter((f) => f.endsWith(".md"));
      for (const file of mdFiles) {
        try {
          // Skip if we already have a structured call for this date
          const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/);
          if (dateMatch && calls.some((c) => c.date === dateMatch[1])) continue;

          const content = await fs.readFile(path.join(transcriptsDir, file), "utf-8");
          const parsed = parseFirefliesTranscript(file, content);
          if (parsed) calls.push(parsed);
        } catch { /* skip */ }
      }
    } catch { /* transcripts/ dir doesn't exist yet */ }

    // Sort newest first
    calls.sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({ calls });
  } catch (err) {
    console.error("[calls] GET failed:", err);
    return NextResponse.json({ error: "Failed to list calls" }, { status: 500 });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: Params
) {
  try {
    const { slug } = await params;

    // ── Parse multipart ──────────────────────────────────────────────────
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: "Invalid multipart form data" }, { status: 400 });
    }

    const file = formData.get("file") as File | null;
    const dateParam = formData.get("date") as string | null;
    const videoUrl = (formData.get("videoUrl") as string | null) ?? "";

    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    // ── Validate extension ───────────────────────────────────────────────
    const ext = path.extname(file.name).toLowerCase();
    if (![".md", ".txt", ".docx"].includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${ext}. Supported: .md, .txt, .docx` },
        { status: 400 }
      );
    }

    // ── Extract text ─────────────────────────────────────────────────────
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let transcriptText: string;
    if (ext === ".md" || ext === ".txt") {
      transcriptText = buffer.toString("utf-8");
    } else {
      const result = await mammoth.extractRawText({ buffer });
      transcriptText = cleanExtractedText(result.value);
    }

    // ── Determine date ───────────────────────────────────────────────────
    let callDate =
      dateParam ||
      dateFromFilename(file.name) ||
      new Date().toISOString().slice(0, 10);

    // Validate it looks like a date
    if (!/^\d{4}-\d{2}-\d{2}$/.test(callDate)) {
      callDate = new Date().toISOString().slice(0, 10);
    }

    const slug2 = dateToFileSlug(callDate); // "2026_02_25"
    const callsDir = path.join(CLIENTS_DIR, slug, "calls");
    await fs.mkdir(callsDir, { recursive: true });

    const transcriptFilename = `CALL_${slug2}_TRANSCRIPT.md`;
    const metaFilename = `CALL_${slug2}.json`;
    const transcriptPath = path.join(callsDir, transcriptFilename);
    const metaPath = path.join(callsDir, metaFilename);

    // ── Save raw transcript ──────────────────────────────────────────────
    await fs.writeFile(transcriptPath, transcriptText, "utf-8");

    // ── AI Analysis via OpenAI ───────────────────────────────────────────
    let analyzed = false;
    let overview = "";
    let ahas: string[] = [];
    let decisions: string[] = [];
    let openLoops: string[] = [];
    let rawTodos: Array<{ description: string; owner: string; deadline?: string }> = [];
    let parkedIdeas: string[] = [];
    let followUpNotes = "";
    let aiError: string | undefined;

    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OPENAI_API_KEY not set");

      const truncatedText =
        transcriptText.length > 12000
          ? transcriptText.slice(0, 12000) + "\n\n[... truncated ...]"
          : transcriptText;

      const systemPrompt = `You are a Weekly Coaching Call Analyst and Executive Note-Taker.
Return ONLY valid JSON (no markdown, no explanation) using exactly these keys:
overview, ahas, decisions, openLoops, todos, parkedIdeas, followUpNotes

CRITICAL RULES:
- Do not invent tasks, decisions, or insights.
- Distinguish clearly between decisions (locked), open loops (not finalized), and parked ideas (not now).
- Not everything discussed becomes a task.
- Keep output concise and execution-focused.

OUTPUT REQUIREMENTS:
1) overview
- Write as short structured text for fast scan:
  - What happened (30-sec summary)
  - Client state (moving/stuck/at-risk)
  - What Sarah/Bobby should do next

2) ahas
- Meaningful breakthroughs only (0-8 items)

3) decisions
- Only clearly agreed decisions. If none, return [].

4) openLoops
- Items discussed but unresolved / needs follow-up.

5) todos
- Array of objects: { description, owner, deadline? }
- owner MUST be one of: "sarah", "bobby", "client"
- Only include deadline when explicitly stated in transcript (e.g., "by next call", specific date).
- If deadline is not explicit, omit it.
- Keep tasks in call action-items context (no assumptions about task-board push).

6) parkedIdeas
- Ideas intentionally deferred.

7) followUpNotes
- Concise execution notes for next call.
`;

      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: truncatedText },
          ],
        }),
      });

      if (!aiRes.ok) {
        const errBody = await aiRes.text();
        throw new Error(`OpenAI error ${aiRes.status}: ${errBody}`);
      }

      const aiData = (await aiRes.json()) as {
        choices: Array<{ message: { content: string } }>;
      };

      const parsed = JSON.parse(aiData.choices[0]?.message?.content ?? "{}") as {
        overview?: string;
        ahas?: string[];
        decisions?: string[];
        openLoops?: string[];
        todos?: Array<{ description: string; owner: string; deadline?: string }>;
        parkedIdeas?: string[];
        followUpNotes?: string;
      };

      overview = parsed.overview ?? "";
      ahas = Array.isArray(parsed.ahas) ? parsed.ahas : [];
      decisions = Array.isArray(parsed.decisions) ? parsed.decisions : [];
      openLoops = Array.isArray(parsed.openLoops) ? parsed.openLoops : [];
      rawTodos = Array.isArray(parsed.todos) ? parsed.todos : [];
      parkedIdeas = Array.isArray(parsed.parkedIdeas) ? parsed.parkedIdeas : [];
      followUpNotes = parsed.followUpNotes ?? "";
      analyzed = true;
    } catch (err) {
      aiError = err instanceof Error ? err.message : "Unknown AI error";
      console.error("[calls] AI analysis failed:", aiError);
    }

    // ── Normalize todos ───────────────────────────────────────────────────
    const normalizedTodos: CallTodo[] = rawTodos.map((t, i) => {
      const owner = ["sarah", "bobby", "client"].includes(
        (t.owner ?? "").toLowerCase()
      )
        ? ((t.owner ?? "").toLowerCase() as "sarah" | "bobby" | "client")
        : "sarah";
      const deadline = typeof t.deadline === "string" && t.deadline.trim() ? t.deadline.trim() : undefined;
      return {
        id: `todo-${callDate}-${i}`,
        description: t.description ?? "",
        owner,
        completed: false,
        ...(deadline ? { deadline } : {}),
      };
    });

    // ── Save call metadata ───────────────────────────────────────────────
    const callMeta: CoachingCall = {
      id: callDate,
      date: callDate,
      videoUrl,
      overview,
      ahas,
      decisions,
      openLoops,
      todos: normalizedTodos,
      parkedIdeas,
      followUpNotes,
      transcriptFile: transcriptFilename,
      analyzed,
    };

    await fs.writeFile(metaPath, JSON.stringify(callMeta, null, 2), "utf-8");

    // ── Do NOT auto-push call todos to global/client task board ───────────
    // Tasks remain in the call Action Items area until manually pushed in UI.
    const todoPushResults: Array<{ idx: number; taskId?: string; error?: string }> = [];

    await appendClientMemoryEvent(slug, {
      source: "calls",
      action: "create",
      entityId: callMeta.id,
      summary: `Added coaching call ${callMeta.date}${videoUrl ? " with video URL" : ""}`,
      data: {
        date: callMeta.date,
        decisions: callMeta.decisions.length,
        todos: callMeta.todos.length,
        analyzed: callMeta.analyzed,
      },
    });

    return NextResponse.json({
      success: true,
      call: callMeta,
      transcriptFile: transcriptFilename,
      metaFile: metaFilename,
      analyzed,
      aiError,
      todoPushResults,
    });
  } catch (err) {
    console.error("[calls] POST failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/clients/[slug]/calls — update a call (metadata or todo) ──────

export async function PATCH(
  request: NextRequest,
  { params }: Params
) {
  try {
    const { slug } = await params;
    const body = (await request.json()) as { callId: string; updates: Partial<CoachingCall> };
    const { callId, updates } = body;

    if (!callId) {
      return NextResponse.json({ error: "callId is required" }, { status: 400 });
    }

    const slug2 = dateToFileSlug(callId);
    const metaPath = path.join(CLIENTS_DIR, slug, "calls", `CALL_${slug2}.json`);

    let existing: CoachingCall;
    try {
      const raw = await fs.readFile(metaPath, "utf-8");
      existing = JSON.parse(raw) as CoachingCall;
    } catch {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    const updated = { ...existing, ...updates };
    await fs.writeFile(metaPath, JSON.stringify(updated, null, 2), "utf-8");

    await appendClientMemoryEvent(slug, {
      source: "calls",
      action: "update",
      entityId: updated.id,
      summary: `Updated coaching call ${updated.date}`,
      data: { updatedKeys: Object.keys(updates || {}) },
    });

    return NextResponse.json({ success: true, call: updated });
  } catch (err) {
    console.error("[calls] PATCH failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
