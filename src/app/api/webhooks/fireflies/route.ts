/**
 * POST /api/webhooks/fireflies — Receive Fireflies webhook notifications
 *
 * Fireflies sends notifications when a meeting transcript is ready.
 * This endpoint:
 * 1. Validates the webhook signature (when implemented)
 * 2. Extracts call metadata from meeting_title
 * 3. Spawns a Call Processor sub-agent to handle the full pipeline
 *
 * Webhook payload from Fireflies:
 * {
 *   "event": "transcript_ready",
 *   "meeting_id": "xyz123",
 *   "meeting_title": "lindsay-little-2026-02-26-group-strategy",
 *   "transcript_id": "abc456",
 *   "recording_url": "https://fireflies.ai/recording/...",
 *   "created_at": "2026-02-26T15:30:00Z"
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const WORKSPACE =
  process.env.OPENCLAW_WORKSPACE ?? "/Users/vincent/.openclaw/workspace";
const LOGS_DIR = path.join(WORKSPACE, "call_processor_logs");

interface FirefliesWebhook {
  event: string;
  meeting_id: string;
  meeting_title: string;
  transcript_id: string;
  recording_url: string;
  created_at: string;
}

interface ParsedCallMetadata {
  client_slug: string;
  call_date: string;
  call_type: string;
}

/**
 * Parse call metadata from meeting_title
 * Format: {CLIENT_SLUG}-{DATE}-{TYPE}
 * Example: "lindsay-little-2026-02-26-group-strategy"
 */
function parseCallMetadata(meeting_title: string): ParsedCallMetadata | null {
  // Match: slug-YYYY-MM-DD-type (type can contain hyphens)
  const match = meeting_title.match(
    /^([a-z0-9-]+)-(\d{4}-\d{2}-\d{2})-(.+)$/
  );

  if (!match) {
    console.error(`[webhook] Failed to parse meeting_title: ${meeting_title}`);
    return null;
  }

  const [, client_slug, call_date, call_type] = match;

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(call_date)) {
    console.error(`[webhook] Invalid date format: ${call_date}`);
    return null;
  }

  return { client_slug, call_date, call_type };
}

/**
 * Log webhook events for debugging/audit
 */
async function logWebhookEvent(
  event: string,
  data: unknown,
  status: "received" | "success" | "error"
) {
  try {
    await fs.mkdir(LOGS_DIR, { recursive: true });
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${status.toUpperCase()}: ${event}\n${JSON.stringify(data, null, 2)}\n---\n`;
    const logPath = path.join(
      LOGS_DIR,
      `fireflies_webhook_${new Date().toISOString().split("T")[0]}.log`
    );
    await fs.appendFile(logPath, logEntry, "utf-8");
  } catch (err) {
    console.error("[webhook] Failed to log event:", err);
  }
}

/**
 * Spawn a Call Processor sub-agent (in production, this would use OpenClaw's agent system)
 * For now, we'll trigger the processing synchronously via a dedicated route
 */
async function spawnCallProcessor(payload: FirefliesWebhook): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    console.log(
      "[webhook] Spawning Call Processor for:",
      payload.meeting_title
    );

    const processorRes = await fetch(
      `${baseUrl}/api/system/call-processor`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhook_payload: payload,
        }),
      }
    );

    if (!processorRes.ok) {
      const errText = await processorRes.text();
      throw new Error(
        `Call Processor returned ${processorRes.status}: ${errText}`
      );
    }

    console.log("[webhook] Call Processor spawned successfully");
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Unknown error";
    console.error("[webhook] Failed to spawn Call Processor:", errorMsg);
    throw err;
  }
}

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).slice(2, 9);
  console.log(`[webhook:${requestId}] Fireflies webhook received`);

  try {
    const body = (await request.json()) as FirefliesWebhook;
    await logWebhookEvent("fireflies_webhook", body, "received");

    // ─── Validate webhook payload ────────────────────────────────────────
    if (!body.event || !body.meeting_title || !body.transcript_id) {
      console.error(
        `[webhook:${requestId}] Missing required fields in webhook payload`
      );
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (body.event !== "transcript_ready") {
      console.log(
        `[webhook:${requestId}] Ignoring event: ${body.event}`
      );
      return NextResponse.json({ status: "ignored", event: body.event });
    }

    // ─── Parse call metadata ──────────────────────────────────────────────
    const metadata = parseCallMetadata(body.meeting_title);
    if (!metadata) {
      console.error(
        `[webhook:${requestId}] Failed to parse meeting_title: ${body.meeting_title}`
      );
      await logWebhookEvent(
        `parse_failed:${body.meeting_title}`,
        { meeting_title: body.meeting_title },
        "error"
      );
      return NextResponse.json(
        { error: "Could not parse meeting title" },
        { status: 400 }
      );
    }

    console.log(
      `[webhook:${requestId}] Parsed metadata:`,
      metadata
    );

    // ─── Spawn Call Processor ─────────────────────────────────────────────
    await spawnCallProcessor({
      ...body,
      meeting_title: body.meeting_title, // Ensure it's set
    });

    await logWebhookEvent("fireflies_webhook", body, "success");

    return NextResponse.json({
      success: true,
      requestId,
      metadata,
      message: "Call processing started",
    });
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Unknown error";
    console.error(`[webhook:${requestId}] Error:`, errorMsg);

    await logWebhookEvent(`webhook_error:${errorMsg}`, { error: errorMsg }, "error");

    return NextResponse.json(
      { error: "Webhook processing failed", details: errorMsg },
      { status: 500 }
    );
  }
}

/**
 * Health check for webhook endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "/api/webhooks/fireflies",
    method: "POST",
    description: "Fireflies transcript webhook receiver",
  });
}
