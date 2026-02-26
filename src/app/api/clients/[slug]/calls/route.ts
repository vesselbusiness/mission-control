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

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: Params
) {
  try {
    const { slug } = await params;
    const callsDir = path.join(CLIENTS_DIR, slug, "calls");

    let entries: string[] = [];
    try {
      entries = await fs.readdir(callsDir);
    } catch {
      // Directory doesn't exist yet — return empty list
      return NextResponse.json({ calls: [] });
    }

    const jsonFiles = entries.filter(
      (f) => f.startsWith("CALL_") && f.endsWith(".json") && !f.includes("TRANSCRIPT")
    );

    const calls: CoachingCall[] = [];
    for (const file of jsonFiles) {
      try {
        const raw = await fs.readFile(path.join(callsDir, file), "utf-8");
        calls.push(JSON.parse(raw) as CoachingCall);
      } catch {
        // Skip corrupt files
      }
    }

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
    let rawTodos: Array<{ description: string; owner: string }> = [];
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

      const systemPrompt = `You are analyzing a coaching call transcript for an expert business coach.
Extract the following and return ONLY valid JSON (no markdown, no explanation):

1. overview — 2-3 sentences summarizing what was discussed
2. ahas — array of 5-10 bullet strings: key insights or breakthroughs from the call
3. decisions — array of 5-10 bullet strings: things that were decided or locked in
4. openLoops — array of 3-7 bullet strings: unresolved questions or clarifications needed
5. todos — array of objects with "description" (string) and "owner" (one of: "sarah", "bobby", "client"). Extract specific action items. If owner is mentioned (Sarah, Bobby, or the client/their name), assign accordingly. Default to "sarah".
6. parkedIdeas — array of 3-7 strings: things mentioned to revisit later, not urgent
7. followUpNotes — string: closing remarks, next meeting date, any context for future

Return JSON with exactly these keys: overview, ahas, decisions, openLoops, todos, parkedIdeas, followUpNotes`;

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
        todos?: Array<{ description: string; owner: string }>;
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
      return {
        id: `todo-${callDate}-${i}`,
        description: t.description ?? "",
        owner,
        completed: false,
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

    // ── Push todos to Tasks board ────────────────────────────────────────
    const todoPushResults: Array<{ idx: number; taskId?: string; error?: string }> = [];
    if (analyzed && normalizedTodos.length > 0) {
      for (let i = 0; i < normalizedTodos.length; i++) {
        const todo = normalizedTodos[i];
        try {
          const todoRes = await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/todos`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: todo.description,
                description: `From coaching call on ${callDate}`,
                assignee: todo.owner,
                priority: "medium",
                status: "open",
                created_by: "agent",
                client_slug: slug,
              }),
            }
          );
          if (todoRes.ok) {
            const todoData = (await todoRes.json()) as { todo?: { id?: string } };
            const taskId = todoData.todo?.id;
            if (taskId) {
              normalizedTodos[i].taskBoardId = taskId;
              todoPushResults.push({ idx: i, taskId });
            }
          } else {
            todoPushResults.push({ idx: i, error: `HTTP ${todoRes.status}` });
          }
        } catch (err) {
          todoPushResults.push({
            idx: i,
            error: err instanceof Error ? err.message : "Unknown",
          });
        }
      }

      // Re-save with updated taskBoardIds
      callMeta.todos = normalizedTodos;
      await fs.writeFile(metaPath, JSON.stringify(callMeta, null, 2), "utf-8");
    }

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

    return NextResponse.json({ success: true, call: updated });
  } catch (err) {
    console.error("[calls] PATCH failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
