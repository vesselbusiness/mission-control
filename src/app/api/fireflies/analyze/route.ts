/**
 * POST /api/fireflies/analyze — AI-powered transcript routing
 *
 * Receives a Fireflies webhook payload (or any object with transcript_id),
 * fetches the actual transcript content via the Fireflies GraphQL API,
 * then uses Claude to:
 *   1. Match the transcript to a known client
 *   2. Determine the call type (group-strategy, 1-on-1, coaching, etc.)
 *   3. Extract the call date (from transcript or webhook created_at)
 *   4. Extract action items, insights, blockers, wins
 *
 * Finally routes everything to:
 *   - Client transcript file: /workspace/clients/{slug}/transcripts/{date}-{type}.md
 *   - Client TODO_LIST.json (tasks)
 *   - Client PROGRESS.md
 *   - Slack notification
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { Anthropic } from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes for processing

const WORKSPACE =
  process.env.OPENCLAW_WORKSPACE ?? "/Users/vincent/.openclaw/workspace";
const CLIENTS_DIR = path.join(WORKSPACE, "clients");
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ─── Types ─────────────────────────────────────────────────────────────────

interface AnalyzeRequest {
  transcript_id: string;
  meeting_title?: string;
  meeting_id?: string;
  recording_url?: string;
  created_at?: string;
}

interface FirefliesTranscriptResponse {
  data?: {
    transcript?: {
      id: string;
      title: string;
      date: number; // Unix timestamp in ms
      duration: number;
      organizer_email: string;
      participants: string[];
      sentences: Array<{
        speaker_name: string;
        text: string;
        start_time: number;
      }>;
      summary: {
        action_items?: string;
        overview?: string;
        keywords?: string[];
      } | null;
    };
  };
  errors?: Array<{ message: string }>;
}

interface ClientInfo {
  slug: string;
  name: string;
}

interface RoutingDecision {
  client_slug: string;
  client_name: string;
  call_type: string;
  call_date: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
}

interface ExtractedCallData {
  tasks: Array<{
    task: string;
    owner_hint: "Bobby" | "Sarah" | "Client" | null;
    priority: "low" | "medium" | "high";
    deadline_hint?: string;
  }>;
  ideas: Array<{
    idea: string;
    context: string;
  }>;
  blockers: Array<{
    blocker: string;
    severity: "low" | "medium" | "high";
    impact: string;
  }>;
  wins: Array<{
    win: string;
    impact: string;
  }>;
  insights: Array<{
    key_insight: string;
    category: string;
    next_steps?: string;
  }>;
  participants: string[];
  summary: string;
}

// ─── Fireflies GraphQL ─────────────────────────────────────────────────────

/**
 * Fetch a transcript from Fireflies using their GraphQL API.
 * Returns a formatted text version of the transcript.
 */
async function fetchTranscriptFromFireflies(transcript_id: string): Promise<{
  text: string;
  title: string;
  date: string;
  participants: string[];
  summary: string;
}> {
  const apiKey = process.env.FIREFLIES_API_KEY;
  if (!apiKey) throw new Error("FIREFLIES_API_KEY not configured");

  const query = `
    query GetTranscript($transcriptId: String!) {
      transcript(id: $transcriptId) {
        id
        title
        date
        duration
        organizer_email
        participants
        sentences {
          speaker_name
          text
          start_time
        }
        summary {
          action_items
          overview
          keywords
        }
      }
    }
  `;

  const response = await fetch("https://api.fireflies.ai/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      variables: { transcriptId: transcript_id },
    }),
  });

  if (!response.ok) {
    throw new Error(`Fireflies GraphQL error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as FirefliesTranscriptResponse;

  if (data.errors?.length) {
    throw new Error(`Fireflies API errors: ${data.errors.map((e) => e.message).join(", ")}`);
  }

  const t = data.data?.transcript;
  if (!t) throw new Error("No transcript data returned from Fireflies");

  // Format sentences into readable transcript
  const transcriptLines = (t.sentences ?? []).map(
    (s) => `[${s.speaker_name}]: ${s.text}`
  );
  const transcriptText = transcriptLines.join("\n");

  // Format date from unix ms timestamp
  const callDate = t.date
    ? new Date(t.date).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  const summary = [
    t.summary?.overview ? `Overview: ${t.summary.overview}` : "",
    t.summary?.action_items ? `Action Items: ${t.summary.action_items}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    text: transcriptText || "[Transcript content not available]",
    title: t.title ?? "",
    date: callDate,
    participants: t.participants ?? [],
    summary,
  };
}

// ─── Client Matching ──────────────────────────────────────────────────────

async function getAvailableClients(): Promise<ClientInfo[]> {
  try {
    const res = await fetch(`${APP_URL}/api/clients`);
    if (!res.ok) throw new Error("Failed to fetch clients");
    const data = (await res.json()) as { clients: Array<{ slug: string; name: string }> };
    return data.clients.map((c) => ({ slug: c.slug, name: c.name }));
  } catch (err) {
    // Fallback: read directly from filesystem
    console.warn("[analyze] Could not fetch clients from API, reading from fs:", err);
    try {
      const entries = await fs.readdir(CLIENTS_DIR, { withFileTypes: true });
      return entries
        .filter((e) => e.isDirectory())
        .map((e) => ({ slug: e.name, name: e.name.replace(/-/g, " ") }));
    } catch {
      return [];
    }
  }
}

// ─── AI Analysis ──────────────────────────────────────────────────────────

async function analyzeTranscript(
  transcriptText: string,
  transcriptTitle: string,
  transcriptDate: string,
  transcriptParticipants: string[],
  availableClients: ClientInfo[]
): Promise<{ routing: RoutingDecision; extracted: ExtractedCallData }> {
  const claude = new Anthropic();

  const clientList = availableClients
    .map((c) => `- ${c.name} (slug: ${c.slug})`)
    .join("\n");

  const systemPrompt = `You are an intelligent call routing system for a business coaching firm.

Your job is to analyze a meeting transcript and:
1. Identify which client the call is for
2. Determine the call type
3. Extract action items, insights, blockers, and wins

Available clients:
${clientList || "(No clients found — use your best guess from context)"}

Call types to choose from:
- group-strategy (multiple attendees, big-picture strategy)
- 1-on-1 (one-on-one coaching session)
- coaching (general coaching call)
- onboarding (new client onboarding)
- check-in (quick update/accountability call)
- workshop (training or workshop session)
- discovery (initial discovery/sales call)
- other

Return a single JSON object with this exact structure:
{
  "routing": {
    "client_slug": "the-client-slug",
    "client_name": "The Client Name",
    "call_type": "group-strategy",
    "call_date": "YYYY-MM-DD",
    "confidence": "high|medium|low",
    "reasoning": "Brief explanation of how you identified the client and call type"
  },
  "extracted": {
    "tasks": [
      { "task": "string", "owner_hint": "Bobby|Sarah|Client|null", "priority": "high|medium|low", "deadline_hint": "optional string" }
    ],
    "ideas": [
      { "idea": "string", "context": "string" }
    ],
    "blockers": [
      { "blocker": "string", "severity": "high|medium|low", "impact": "string" }
    ],
    "wins": [
      { "win": "string", "impact": "string" }
    ],
    "insights": [
      { "key_insight": "string", "category": "messaging|positioning|product|market|operations|mindset|other", "next_steps": "optional string" }
    ],
    "participants": ["name1", "name2"],
    "summary": "2-3 sentence summary of the call"
  }
}

Return ONLY valid JSON. No markdown fences, no explanation.`;

  const userPrompt = `Meeting Title: ${transcriptTitle || "(untitled)"}
Meeting Date: ${transcriptDate}
Participants listed: ${transcriptParticipants.join(", ") || "(none listed)"}

Transcript:
${transcriptText.length > 20000 ? transcriptText.slice(0, 20000) + "\n\n[... transcript truncated ...]" : transcriptText}`;

  const response = await claude.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 3000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected Claude response type");

  // Strip potential markdown fences
  let jsonStr = content.text.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "");
  }

  const parsed = JSON.parse(jsonStr) as { routing: RoutingDecision; extracted: ExtractedCallData };

  if (!parsed.routing?.client_slug || !parsed.extracted) {
    throw new Error("Invalid structure in Claude response");
  }

  return parsed;
}

// ─── File Operations ──────────────────────────────────────────────────────

async function saveTranscript(
  client_slug: string,
  call_date: string,
  call_type: string,
  transcriptText: string,
  extracted: ExtractedCallData,
  recording_url: string,
  meeting_id: string
): Promise<string> {
  const transcriptsDir = path.join(CLIENTS_DIR, client_slug, "transcripts");
  await fs.mkdir(transcriptsDir, { recursive: true });

  const filename = `${call_date}-${call_type}.md`;
  const filePath = path.join(transcriptsDir, filename);

  const header = `# Call Transcript: ${call_type.replace(/-/g, " ")} — ${call_date}

**Client:** ${client_slug}
**Date:** ${call_date}
**Type:** ${call_type}
**Participants:** ${extracted.participants.join(", ")}
${recording_url ? `**Recording:** ${recording_url}` : ""}
${meeting_id ? `**Meeting ID:** ${meeting_id}` : ""}

## Summary

${extracted.summary}

---

## Transcript

`;

  await fs.writeFile(filePath, header + transcriptText, "utf-8");
  console.log(`[analyze] Saved transcript: ${filePath}`);
  return filePath;
}

async function createTasks(
  client_slug: string,
  tasks: ExtractedCallData["tasks"],
  call_date: string,
  call_type: string
): Promise<void> {
  if (!tasks.length) return;

  const todoPath = path.join(CLIENTS_DIR, client_slug, "TODO_LIST.json");
  await fs.mkdir(path.dirname(todoPath), { recursive: true });

  let todos: { tasks: unknown[] } = { tasks: [] };
  try {
    const raw = await fs.readFile(todoPath, "utf-8");
    todos = JSON.parse(raw) as { tasks: unknown[] };
    if (!Array.isArray(todos.tasks)) todos.tasks = [];
  } catch {
    // File doesn't exist yet
  }

  const ownerMap: Record<string, string> = {
    Bobby: "bobby",
    Sarah: "sarah",
    Client: "client",
  };

  for (const task of tasks) {
    todos.tasks.push({
      id: `todo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      label: task.task,
      assignee: task.owner_hint ? (ownerMap[task.owner_hint] ?? null) : null,
      priority: task.priority ?? "medium",
      status: "assigned",
      deadline_hint: task.deadline_hint ?? null,
      source: `Call: ${call_date} ${call_type}`,
      createdAt: new Date().toISOString(),
    });
  }

  await fs.writeFile(todoPath, JSON.stringify(todos, null, 2), "utf-8");
  console.log(`[analyze] Created ${tasks.length} tasks for ${client_slug}`);
}

async function updateProgress(
  client_slug: string,
  call_date: string,
  call_type: string,
  extracted: ExtractedCallData,
  recording_url: string
): Promise<void> {
  const progressPath = path.join(CLIENTS_DIR, client_slug, "PROGRESS.md");
  await fs.mkdir(path.dirname(progressPath), { recursive: true });

  let existing = "";
  try {
    existing = await fs.readFile(progressPath, "utf-8");
  } catch {
    existing = `# Progress\n\n`;
  }

  const wins = extracted.wins.map((w) => `- ${w.win}`).join("\n");
  const blockers = extracted.blockers.map((b) => `- ${b.blocker}`).join("\n");
  const insights = extracted.insights.map((i) => `- ${i.key_insight}`).join("\n");
  const tasks = extracted.tasks.slice(0, 5).map((t) => `- [ ] ${t.task}${t.owner_hint ? ` _(${t.owner_hint})_` : ""}`).join("\n");

  const section = `
## ${call_date} — ${call_type.replace(/-/g, " ")}

**Attendees:** ${extracted.participants.join(", ")}
${recording_url ? `**Recording:** [Link](${recording_url})` : ""}

**Summary:** ${extracted.summary}

${insights ? `### Key Insights\n${insights}\n` : ""}
${wins ? `### Wins\n${wins}\n` : ""}
${blockers ? `### Blockers\n${blockers}\n` : ""}
${tasks ? `### Action Items\n${tasks}\n` : ""}
`;

  await fs.writeFile(progressPath, existing + section, "utf-8");
  console.log(`[analyze] Updated PROGRESS.md for ${client_slug}`);
}

async function sendSlackNotification(
  client_slug: string,
  client_name: string,
  call_type: string,
  call_date: string,
  extracted: ExtractedCallData,
  recording_url: string,
  confidence: string,
  transcriptPath: string
): Promise<void> {
  try {
    const slackToken = process.env.SLACK_BOT_TOKEN;
    if (!slackToken) {
      console.warn("[analyze] SLACK_BOT_TOKEN not set — skipping Slack notification");
      return;
    }

    const taskList = extracted.tasks
      .slice(0, 3)
      .map((t) => `• ${t.task}${t.owner_hint ? ` _(${t.owner_hint})_` : ""}`)
      .join("\n");

    const winList = extracted.wins
      .slice(0, 2)
      .map((w) => `• ${w.win}`)
      .join("\n");

    const message = [
      `📞 *Call processed: ${client_name} — ${call_type.replace(/-/g, " ")} (${call_date})*`,
      "",
      extracted.summary,
      "",
      taskList ? `*Action Items:*\n${taskList}` : "",
      winList ? `*Wins:*\n${winList}` : "",
      recording_url ? `🎬 <${recording_url}|View Recording>` : "",
      `_(Client match confidence: ${confidence})_`,
    ]
      .filter(Boolean)
      .join("\n");

    // Post to internal channel (e.g. #call-summaries or a configured channel)
    const channel = process.env.SLACK_CALL_SUMMARIES_CHANNEL ?? "#call-summaries";

    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${slackToken}`,
      },
      body: JSON.stringify({ channel, text: message }),
    });

    const slackData = (await res.json()) as { ok: boolean; error?: string };
    if (!slackData.ok) {
      console.warn(`[analyze] Slack notification failed: ${slackData.error}`);
    } else {
      console.log(`[analyze] Slack notification sent to ${channel}`);
    }
  } catch (err) {
    console.error("[analyze] Slack notification error:", err instanceof Error ? err.message : err);
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const reqId = Math.random().toString(36).slice(2, 9);
  console.log(`[analyze:${reqId}] Starting intelligent transcript analysis`);

  try {
    const body = (await request.json()) as AnalyzeRequest;

    if (!body.transcript_id) {
      return NextResponse.json({ error: "transcript_id is required" }, { status: 400 });
    }

    // ── 1. Fetch transcript from Fireflies ──────────────────────────────
    console.log(`[analyze:${reqId}] Fetching transcript ${body.transcript_id} from Fireflies...`);
    let transcriptData: { text: string; title: string; date: string; participants: string[]; summary: string };

    try {
      transcriptData = await fetchTranscriptFromFireflies(body.transcript_id);
      console.log(`[analyze:${reqId}] Fetched ${transcriptData.text.length} chars of transcript`);
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      console.error(`[analyze:${reqId}] Failed to fetch transcript: ${msg}`);
      // Use fallback: meeting title as transcript, date from created_at
      transcriptData = {
        text: body.meeting_title ?? "(No transcript available)",
        title: body.meeting_title ?? "",
        date: body.created_at
          ? new Date(body.created_at).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        participants: [],
        summary: "",
      };
      console.log(`[analyze:${reqId}] Using fallback transcript data`);
    }

    // ── 2. Get available clients ────────────────────────────────────────
    console.log(`[analyze:${reqId}] Fetching available clients...`);
    const clients = await getAvailableClients();
    console.log(`[analyze:${reqId}] Found ${clients.length} clients: ${clients.map((c) => c.slug).join(", ")}`);

    // ── 3. Claude analysis ──────────────────────────────────────────────
    console.log(`[analyze:${reqId}] Running Claude analysis...`);
    const { routing, extracted } = await analyzeTranscript(
      transcriptData.text,
      transcriptData.title || body.meeting_title || "",
      transcriptData.date,
      transcriptData.participants,
      clients
    );

    console.log(
      `[analyze:${reqId}] Routed to: ${routing.client_slug} | ${routing.call_type} | ${routing.call_date} | confidence: ${routing.confidence}`
    );
    console.log(`[analyze:${reqId}] Reasoning: ${routing.reasoning}`);

    // ── 4. Save transcript to client folder ────────────────────────────
    const transcriptPath = await saveTranscript(
      routing.client_slug,
      routing.call_date,
      routing.call_type,
      transcriptData.text,
      extracted,
      body.recording_url ?? "",
      body.meeting_id ?? ""
    );

    // ── 5. Create tasks ────────────────────────────────────────────────
    await createTasks(
      routing.client_slug,
      extracted.tasks,
      routing.call_date,
      routing.call_type
    );

    // ── 6. Update PROGRESS.md ──────────────────────────────────────────
    await updateProgress(
      routing.client_slug,
      routing.call_date,
      routing.call_type,
      extracted,
      body.recording_url ?? ""
    );

    // ── 7. Slack notification ──────────────────────────────────────────
    await sendSlackNotification(
      routing.client_slug,
      routing.client_name,
      routing.call_type,
      routing.call_date,
      extracted,
      body.recording_url ?? "",
      routing.confidence,
      transcriptPath
    );

    console.log(`[analyze:${reqId}] ✅ Done`);

    return NextResponse.json({
      success: true,
      reqId,
      routing,
      transcript_path: transcriptPath,
      extracted: {
        tasks: extracted.tasks.length,
        ideas: extracted.ideas.length,
        blockers: extracted.blockers.length,
        wins: extracted.wins.length,
        insights: extracted.insights.length,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[analyze:${reqId}] ❌ Error:`, msg);

    return NextResponse.json(
      { error: "Analysis failed", details: msg, reqId },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "/api/fireflies/analyze",
    description: "AI-powered transcript analysis and routing",
  });
}
