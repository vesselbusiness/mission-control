/**
 * POST /api/webhooks/fireflies — Receive Fireflies webhook notifications
 *
 * Fireflies sends a webhook when a transcript is ready. We no longer
 * require the meeting title to follow a specific format. Instead we:
 *   1. Accept any Fireflies transcript_ready event
 *   2. Forward to /api/fireflies/analyze, which fetches the full transcript
 *      and uses Claude to identify the client, call type, and date
 *   3. The analyzer handles all routing (save file, create tasks, Slack)
 *
 * Example Fireflies webhook payload:
 * {
 *   "event": "transcript_ready",
 *   "meeting_id": "xyz123",
 *   "meeting_title": "Weekly Call with Lindsay",   ← any format OK
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
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

interface FirefliesWebhook {
  event: string;
  meeting_id?: string;
  meeting_title?: string;
  transcript_id: string;
  recording_url?: string;
  created_at?: string;
}

async function logWebhookEvent(
  label: string,
  data: unknown,
  status: "received" | "success" | "error"
) {
  try {
    await fs.mkdir(LOGS_DIR, { recursive: true });
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${status.toUpperCase()}: ${label}\n${JSON.stringify(data, null, 2)}\n---\n`;
    const logPath = path.join(
      LOGS_DIR,
      `fireflies_webhook_${new Date().toISOString().split("T")[0]}.log`
    );
    await fs.appendFile(logPath, logEntry, "utf-8");
  } catch (err) {
    console.error("[webhook] Failed to log event:", err);
  }
}

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).slice(2, 9);
  console.log(`[webhook:${requestId}] Fireflies webhook received`);

  let body: FirefliesWebhook;
  try {
    body = (await request.json()) as FirefliesWebhook;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  await logWebhookEvent("fireflies_webhook", body, "received");

  // ── Validate required fields ───────────────────────────────────────────
  if (!body.event || !body.transcript_id) {
    console.error(`[webhook:${requestId}] Missing required fields`);
    return NextResponse.json({ error: "Missing event or transcript_id" }, { status: 400 });
  }

  // ── Only handle transcript_ready ──────────────────────────────────────
  if (body.event !== "transcript_ready") {
    console.log(`[webhook:${requestId}] Ignoring event: ${body.event}`);
    return NextResponse.json({ status: "ignored", event: body.event });
  }

  console.log(
    `[webhook:${requestId}] Transcript ready — title: "${body.meeting_title ?? "(untitled)"}" | id: ${body.transcript_id}`
  );

  // ── Fire off the analyzer (async — respond immediately to Fireflies) ───
  // We don't await so Fireflies gets a fast 200. Processing happens in background.
  void triggerAnalyzer(body, requestId);

  await logWebhookEvent("fireflies_webhook_queued", body, "success");

  return NextResponse.json({
    success: true,
    requestId,
    status: "queued",
    message: "Transcript queued for AI analysis",
  });
}

async function triggerAnalyzer(webhook: FirefliesWebhook, requestId: string) {
  try {
    console.log(`[webhook:${requestId}] Calling /api/fireflies/analyze...`);

    const res = await fetch(`${APP_URL}/api/fireflies/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript_id: webhook.transcript_id,
        meeting_title: webhook.meeting_title,
        meeting_id: webhook.meeting_id,
        recording_url: webhook.recording_url,
        created_at: webhook.created_at,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[webhook:${requestId}] Analyzer returned ${res.status}: ${err}`);
    } else {
      const result = (await res.json()) as { routing?: { client_slug: string; call_type: string } };
      console.log(
        `[webhook:${requestId}] ✅ Analysis complete — routed to: ${result.routing?.client_slug} / ${result.routing?.call_type}`
      );
    }
  } catch (err) {
    console.error(
      `[webhook:${requestId}] Analyzer call failed:`,
      err instanceof Error ? err.message : err
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "/api/webhooks/fireflies",
    method: "POST",
    description: "Fireflies transcript webhook receiver — routes to AI analyzer",
  });
}
