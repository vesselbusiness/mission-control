/**
 * POST /api/system/call-processor — Call Processor Pipeline
 *
 * This endpoint handles the full call processing pipeline:
 * 1. Fetch transcript from Fireflies API
 * 2. Extract tasks, ideas, blockers, wins using Claude
 * 3. Route to:
 *    - To-Do List
 *    - Idea Board
 *    - Community Intelligence (friction + wins)
 *    - Client Profile (PROGRESS.md)
 *    - Slack (client channel + internal)
 * 4. Store transcript locally
 * 5. Handle errors + logging
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { Anthropic } from "@anthropic-ai/sdk";

const WORKSPACE =
  process.env.OPENCLAW_WORKSPACE ?? "/Users/vincent/.openclaw/workspace";
const CLIENTS_DIR = path.join(WORKSPACE, "clients");
const TRANSCRIPTS_DIR = path.join(WORKSPACE, "call_transcripts");
const ERRORS_LOG = path.join(WORKSPACE, "call_processor_errors.log");

// ─── Types ────────────────────────────────────────────────────────────────

interface FirefliesWebhook {
  event: string;
  meeting_id: string;
  meeting_title: string;
  transcript_id: string;
  recording_url: string;
  created_at: string;
}

interface ExtractedCallData {
  tasks: Array<{
    task: string;
    owner_hint: "Bobby" | "Sarah" | "Client" | null;
    priority: string;
    deadline_hint?: string;
  }>;
  ideas: Array<{
    idea: string;
    context: string;
    source_quote?: string;
  }>;
  blockers: Array<{
    blocker: string;
    severity: "low" | "medium" | "high";
    impact: string;
  }>;
  wins: Array<{
    win: string;
    impact: string;
    quotes?: string[];
  }>;
  insights: Array<{
    key_insight: string;
    category: string;
    next_steps?: string;
  }>;
  participants: string[];
}

interface CallProcessorRequest {
  webhook_payload: FirefliesWebhook;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

async function logError(message: string, context: unknown) {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n${JSON.stringify(context, null, 2)}\n---\n`;
    await fs.appendFile(ERRORS_LOG, logEntry, "utf-8");
  } catch (err) {
    console.error("[call-processor] Failed to log error:", err);
  }
}

/**
 * Fetch transcript from Fireflies API with retries
 */
async function fetchFirefliesTranscript(
  transcript_id: string,
  maxRetries: number = 2
): Promise<string> {
  const apiKey = process.env.FIREFLIES_API_KEY;
  if (!apiKey) {
    throw new Error("FIREFLIES_API_KEY not configured");
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `[call-processor] Fetching transcript (attempt ${attempt + 1}/${maxRetries + 1})`
      );

      const response = await fetch(
        `https://api.fireflies.ai/v3/transcript?id=${transcript_id}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Fireflies API error: ${response.status}`);
      }

      const data = (await response.json()) as {
        transcript?: string;
      };

      if (!data.transcript) {
        throw new Error("No transcript in response");
      }

      return data.transcript;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(
        `[call-processor] Fetch attempt ${attempt + 1} failed:`,
        lastError.message
      );

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 30000)); // 30s delay
      }
    }
  }

  throw lastError || new Error("Failed to fetch transcript");
}

/**
 * Extract call data using Claude API
 */
async function extractCallData(
  transcript: string
): Promise<ExtractedCallData> {
  const client = new Anthropic();

  const systemPrompt = `You are analyzing a coaching call transcript for an expert business consulting firm.

Extract and structure the following information into a valid JSON response:

1. **tasks** — Array of action items with owner_hint and priority
   - owner_hint: One of "Bobby", "Sarah", "Client", or null
   - priority: "low", "medium", or "high"
   - deadline_hint: Optional estimate of when it's due (e.g., "ASAP", "next week", "by end of month")

2. **ideas** — Array of suggestions or concepts mentioned
   - idea: The core concept
   - context: Brief context where this came up
   - source_quote: Optional direct quote from transcript

3. **blockers** — Array of challenges or obstacles
   - blocker: What's blocking progress
   - severity: "low", "medium", or "high"
   - impact: How this affects the business

4. **wins** — Array of successes or achievements
   - win: What was achieved
   - impact: How this helps the business
   - quotes: Optional relevant quotes

5. **insights** — Array of key learnings or realizations
   - key_insight: The insight
   - category: e.g., "messaging", "positioning", "product", "market", "operations"
   - next_steps: Optional what to do with this insight

6. **participants** — List of unique speakers/attendees mentioned

Return ONLY valid JSON (no markdown, no explanation). Ensure all arrays are present (can be empty).`;

  const userPrompt = `Here's the call transcript to analyze:

${transcript.length > 15000 ? transcript.slice(0, 15000) + "\n\n[... truncated ...]" : transcript}`;

  try {
    console.log("[call-processor] Calling Claude to extract data...");

    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    const jsonStr = content.text;
    const parsed = JSON.parse(jsonStr) as ExtractedCallData;

    // Validate structure
    if (
      !Array.isArray(parsed.tasks) ||
      !Array.isArray(parsed.ideas) ||
      !Array.isArray(parsed.blockers) ||
      !Array.isArray(parsed.wins) ||
      !Array.isArray(parsed.insights) ||
      !Array.isArray(parsed.participants)
    ) {
      throw new Error("Invalid structure in Claude response");
    }

    console.log(
      "[call-processor] Extraction complete:",
      `${parsed.tasks.length} tasks, ${parsed.ideas.length} ideas, ${parsed.blockers.length} blockers, ${parsed.wins.length} wins`
    );

    return parsed;
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Unknown error";
    console.error("[call-processor] Claude extraction failed:", errorMsg);
    throw new Error(`Claude extraction failed: ${errorMsg}`);
  }
}

/**
 * Create a todo in the To-Do List
 */
async function createTodo(
  client_slug: string,
  task: ExtractedCallData["tasks"][0],
  call_date: string,
  call_type: string
): Promise<void> {
  try {
    const todoPath = path.join(CLIENTS_DIR, client_slug, "TODO_LIST.json");
    await fs.mkdir(path.dirname(todoPath), { recursive: true });

    let todos: { tasks: unknown[] };
    try {
      const raw = await fs.readFile(todoPath, "utf-8");
      todos = JSON.parse(raw) as { tasks: unknown[] };
    } catch {
      todos = { tasks: [] };
    }

    const ownerMap: Record<string, string> = {
      Bobby: "bobby",
      Sarah: "sarah",
      Client: "client",
    };

    const newTask = {
      id: `todo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      label: task.task,
      assignee: task.owner_hint ? ownerMap[task.owner_hint] ?? null : null,
      priority: task.priority ?? "medium",
      status: "assigned",
      source: `From call: ${call_date} ${call_type}`,
      createdAt: new Date().toISOString(),
    };

    if (Array.isArray(todos.tasks)) {
      todos.tasks.push(newTask);
    }

    await fs.writeFile(todoPath, JSON.stringify(todos, null, 2), "utf-8");
    console.log("[call-processor] Created todo:", newTask.label);
  } catch (err) {
    console.error(
      "[call-processor] Failed to create todo:",
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * Create an idea on the Idea Board
 */
async function createIdea(
  client_slug: string,
  idea: ExtractedCallData["ideas"][0],
  call_date: string,
  call_type: string
): Promise<void> {
  try {
    const ideaPath = path.join(CLIENTS_DIR, client_slug, "IDEA_BOARD.json");
    await fs.mkdir(path.dirname(ideaPath), { recursive: true });

    let ideaBoard: { ideas: unknown[] };
    try {
      const raw = await fs.readFile(ideaPath, "utf-8");
      ideaBoard = JSON.parse(raw) as { ideas: unknown[] };
    } catch {
      ideaBoard = { ideas: [] };
    }

    const newIdea = {
      id: `idea-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      text: `${idea.idea} — from ${call_type} (${call_date})`,
      context: idea.context,
      created_at: new Date().toISOString(),
    };

    if (Array.isArray(ideaBoard.ideas)) {
      ideaBoard.ideas.push(newIdea);
    }

    await fs.writeFile(ideaPath, JSON.stringify(ideaBoard, null, 2), "utf-8");
    console.log("[call-processor] Created idea:", idea.idea);
  } catch (err) {
    console.error(
      "[call-processor] Failed to create idea:",
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * Update client PROGRESS.md with call summary
 */
async function updateClientProgress(
  client_slug: string,
  call_date: string,
  call_type: string,
  data: ExtractedCallData,
  recording_url: string
): Promise<void> {
  try {
    const progressPath = path.join(CLIENTS_DIR, client_slug, "PROGRESS.md");
    await fs.mkdir(path.dirname(progressPath), { recursive: true });

    let content = "";
    try {
      content = await fs.readFile(progressPath, "utf-8");
    } catch {
      content = `# Progress\n\n`;
    }

    const participants = data.participants.join(", ");
    const outcomes = data.insights
      .slice(0, 3)
      .map((i) => `- ${i.key_insight}`)
      .join("\n");
    const blockers = data.blockers
      .slice(0, 2)
      .map((b) => `- ${b.blocker}`)
      .join("\n");
    const wins = data.wins
      .slice(0, 2)
      .map((w) => `- ${w.win}`)
      .join("\n");

    const section = `
## ${call_date} — ${call_type}

**Attendees:** ${participants}

**Recording:** [Link](${recording_url})

### Outcomes
${outcomes}

${blockers ? `### Blockers\n${blockers}\n` : ""}
${wins ? `### Wins\n${wins}\n` : ""}
`;

    await fs.writeFile(
      progressPath,
      content + section,
      "utf-8"
    );

    console.log("[call-processor] Updated PROGRESS.md");
  } catch (err) {
    console.error(
      "[call-processor] Failed to update PROGRESS.md:",
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * Store transcript locally
 */
async function storeTranscript(
  client_slug: string,
  call_date: string,
  call_type: string,
  transcript: string,
  data: ExtractedCallData,
  recording_url: string,
  meeting_id: string,
  transcript_id: string
): Promise<void> {
  try {
    const clientDir = path.join(TRANSCRIPTS_DIR, client_slug);
    await fs.mkdir(clientDir, { recursive: true });

    // Save full transcript
    const transcriptFilename = `${call_date}_${call_type}.md`;
    const transcriptPath = path.join(clientDir, transcriptFilename);

    const participants = data.participants.join(", ");
    const header = `# Call Transcript

**Date:** ${call_date}
**Type:** ${call_type}
**Participants:** ${participants}
**Recording:** ${recording_url}

---

`;

    await fs.writeFile(transcriptPath, header + transcript, "utf-8");

    // Update calls.json metadata
    const callsJsonPath = path.join(clientDir, "calls.json");
    let callsData: unknown[] = [];
    try {
      const raw = await fs.readFile(callsJsonPath, "utf-8");
      callsData = JSON.parse(raw) as unknown[];
    } catch {
      // First call
    }

    const callMetadata = {
      call_id: meeting_id,
      transcript_id: transcript_id,
      date: call_date,
      type: call_type,
      participants,
      recording_url,
      tasks_extracted: data.tasks.length,
      ideas_extracted: data.ideas.length,
      blockers_extracted: data.blockers.length,
      wins_extracted: data.wins.length,
      processed_at: new Date().toISOString(),
    };

    callsData.push(callMetadata);
    await fs.writeFile(
      callsJsonPath,
      JSON.stringify(callsData, null, 2),
      "utf-8"
    );

    console.log(
      "[call-processor] Stored transcript and metadata",
      transcriptFilename
    );
  } catch (err) {
    console.error(
      "[call-processor] Failed to store transcript:",
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * Send notification to Slack (client channel)
 */
async function notifySlackClient(
  client_slug: string,
  call_type: string,
  recording_url: string,
  data: ExtractedCallData
): Promise<void> {
  try {
    const slackToken = process.env.SLACK_BOT_TOKEN;
    if (!slackToken) {
      console.warn("[call-processor] SLACK_BOT_TOKEN not configured");
      return;
    }

    // Map client_slug to Slack channel (this could come from CLIENT_INFO)
    // For now, use a simple mapping: client-slug format
    const channelName = `client-${client_slug.replace("_", "-")}`;

    const outcomes = data.insights
      .slice(0, 3)
      .map((i) => `• ${i.key_insight}`)
      .join("\n");

    const nextSteps = data.tasks
      .slice(0, 2)
      .map((t) => `• ${t.task}`)
      .join("\n");

    const message = `📞 Call Processed — ${call_type}

🎯 Key Outcomes:
${outcomes}

📋 Next Steps:
${nextSteps}

🎬 [View Recording](${recording_url})`;

    console.log(
      `[call-processor] Would notify Slack channel: #${channelName}`
    );
    console.log(`[call-processor] Message preview: ${message.slice(0, 100)}...`);

    // TODO: Implement actual Slack notification when token is available
  } catch (err) {
    console.error(
      "[call-processor] Failed to notify Slack client:",
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * Send notification to Slack (internal - Sarah)
 */
async function notifySlackInternal(
  client_slug: string,
  call_type: string,
  data: ExtractedCallData
): Promise<void> {
  try {
    const message = `✅ Call Processed: ${client_slug} — ${call_type}

📊 Extracted:
• Tasks: ${data.tasks.length}
• Ideas: ${data.ideas.length}
• Blockers: ${data.blockers.length}
• Wins: ${data.wins.length}

Updated: To-Do List, Idea Board, Client Profile`;

    console.log(
      "[call-processor] Would notify Sarah in Slack with:",
      message.slice(0, 100)
    );
    // TODO: Implement actual Slack notification
  } catch (err) {
    console.error(
      "[call-processor] Failed to notify Slack internal:",
      err instanceof Error ? err.message : err
    );
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const processorId = Math.random().toString(36).slice(2, 9);
  console.log(`[call-processor:${processorId}] Starting call processor`);

  try {
    const body = (await request.json()) as CallProcessorRequest;
    const webhook = body.webhook_payload;

    // ─── Parse metadata ───────────────────────────────────────────────────
    const match = webhook.meeting_title.match(
      /^([a-z0-9-]+)-(\d{4}-\d{2}-\d{2})-(.+)$/
    );
    if (!match) {
      throw new Error(`Could not parse meeting_title: ${webhook.meeting_title}`);
    }

    const [, client_slug, call_date, call_type] = match;

    console.log(
      `[call-processor:${processorId}] Processing:`,
      `${client_slug} | ${call_date} | ${call_type}`
    );

    // ─── Fetch transcript from Fireflies ────────────────────────────────
    console.log(`[call-processor:${processorId}] Fetching transcript...`);
    const transcript = await fetchFirefliesTranscript(webhook.transcript_id);
    console.log(
      `[call-processor:${processorId}] Transcript fetched: ${transcript.length} chars`
    );

    // ─── Extract data via Claude ──────────────────────────────────────────
    console.log(`[call-processor:${processorId}] Extracting data...`);
    const extractedData = await extractCallData(transcript);

    // ─── Route to To-Do List ──────────────────────────────────────────────
    console.log(`[call-processor:${processorId}] Creating todos...`);
    for (const task of extractedData.tasks) {
      await createTodo(client_slug, task, call_date, call_type);
    }

    // ─── Route to Idea Board ──────────────────────────────────────────────
    console.log(`[call-processor:${processorId}] Creating ideas...`);
    for (const idea of extractedData.ideas) {
      await createIdea(client_slug, idea, call_date, call_type);
    }

    // ─── Update Client Profile (PROGRESS.md) ────────────────────────────
    console.log(`[call-processor:${processorId}] Updating client profile...`);
    await updateClientProgress(
      client_slug,
      call_date,
      call_type,
      extractedData,
      webhook.recording_url
    );

    // ─── Store transcript locally ──────────────────────────────────────────
    console.log(`[call-processor:${processorId}] Storing transcript...`);
    await storeTranscript(
      client_slug,
      call_date,
      call_type,
      transcript,
      extractedData,
      webhook.recording_url,
      webhook.meeting_id,
      webhook.transcript_id
    );

    // ─── Notify Slack (client + internal) ──────────────────────────────────
    console.log(`[call-processor:${processorId}] Sending Slack notifications...`);
    await notifySlackClient(
      client_slug,
      call_type,
      webhook.recording_url,
      extractedData
    );
    await notifySlackInternal(client_slug, call_type, extractedData);

    console.log(
      `[call-processor:${processorId}] ✅ Processing complete!`
    );

    return NextResponse.json({
      success: true,
      processorId,
      client_slug,
      call_date,
      call_type,
      extracted: {
        tasks: extractedData.tasks.length,
        ideas: extractedData.ideas.length,
        blockers: extractedData.blockers.length,
        wins: extractedData.wins.length,
      },
    });
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Unknown error";
    console.error(`[call-processor:${processorId}] ❌ Error:`, errorMsg);

    await logError(`Processing failed for processor ${processorId}`, {
      error: errorMsg,
      stack: err instanceof Error ? err.stack : undefined,
    });

    return NextResponse.json(
      {
        error: "Call processing failed",
        processorId,
        details: errorMsg,
      },
      { status: 500 }
    );
  }
}
