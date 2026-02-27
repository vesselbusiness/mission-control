/**
 * POST /api/fireflies/upload — Upload an audio/video file to Fireflies
 *
 * Accepts a multipart/form-data body with:
 *   - file: the audio/video file (MP4, M4A, MP3, WAV, etc.)
 *   - client_slug: e.g. "lindsay-little"
 *   - call_date: "YYYY-MM-DD" (defaults to today)
 *   - call_type: e.g. "group-strategy", "1-on-1", "coaching"
 *
 * Generates a meeting title: {CLIENT_SLUG}-{YYYY-MM-DD}-{CALL_TYPE}
 * Uploads to Fireflies REST API, returns job info.
 *
 * Fireflies REST upload:
 *   POST https://api.fireflies.ai/audio_upload
 *   Authorization: Bearer <API_KEY>
 *   Content-Type: multipart/form-data
 *   Body fields: title (string), file (binary), webhook_url (optional)
 */

import { NextRequest, NextResponse } from "next/server";

const FIREFLIES_API_KEY = process.env.FIREFLIES_API_KEY ?? "";
const FIREFLIES_UPLOAD_URL = "https://api.fireflies.ai/audio_upload";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const dynamic = "force-dynamic";
// Allow large file uploads (up to 500MB)
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).slice(2, 9);
  console.log(`[fireflies-upload:${requestId}] Upload request received`);

  if (!FIREFLIES_API_KEY) {
    return NextResponse.json(
      { error: "Fireflies API key not configured" },
      { status: 500 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form data" },
      { status: 400 }
    );
  }

  // ─── Extract fields ─────────────────────────────────────────────────────────
  const file = formData.get("file") as File | null;
  const clientSlug = (formData.get("client_slug") as string | null)?.trim();
  const callDate =
    (formData.get("call_date") as string | null)?.trim() ||
    new Date().toISOString().split("T")[0];
  const callType = (formData.get("call_type") as string | null)?.trim();

  // ─── Validate ────────────────────────────────────────────────────────────────
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!clientSlug) {
    return NextResponse.json(
      { error: "client_slug is required" },
      { status: 400 }
    );
  }
  if (!callType) {
    return NextResponse.json(
      { error: "call_type is required" },
      { status: 400 }
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(callDate)) {
    return NextResponse.json(
      { error: "call_date must be YYYY-MM-DD" },
      { status: 400 }
    );
  }

  // ─── Build meeting title ─────────────────────────────────────────────────────
  const meetingTitle = `${clientSlug}-${callDate}-${callType}`;
  console.log(
    `[fireflies-upload:${requestId}] Meeting title: ${meetingTitle}`
  );
  console.log(
    `[fireflies-upload:${requestId}] File: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`
  );

  // ─── Build Fireflies upload payload ─────────────────────────────────────────
  const uploadForm = new FormData();
  uploadForm.append("title", meetingTitle);
  uploadForm.append("file", file, file.name);
  uploadForm.append(
    "webhook_url",
    `${APP_URL}/api/webhooks/fireflies`
  );

  // ─── Upload to Fireflies ─────────────────────────────────────────────────────
  let ffResponse: Response;
  try {
    ffResponse = await fetch(FIREFLIES_UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIREFLIES_API_KEY}`,
      },
      body: uploadForm,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[fireflies-upload:${requestId}] Network error calling Fireflies:`,
      msg
    );
    return NextResponse.json(
      { error: "Failed to reach Fireflies API", details: msg },
      { status: 502 }
    );
  }

  const responseText = await ffResponse.text();
  console.log(
    `[fireflies-upload:${requestId}] Fireflies response ${ffResponse.status}: ${responseText.slice(0, 200)}`
  );

  if (!ffResponse.ok) {
    return NextResponse.json(
      {
        error: `Fireflies API returned ${ffResponse.status}`,
        details: responseText,
      },
      { status: ffResponse.status }
    );
  }

  let ffData: Record<string, unknown> = {};
  try {
    ffData = JSON.parse(responseText);
  } catch {
    // Some responses are plain text; that's OK
    ffData = { raw: responseText };
  }

  return NextResponse.json({
    success: true,
    requestId,
    meetingTitle,
    clientSlug,
    callDate,
    callType,
    clientProfileUrl: `/clients/${clientSlug}`,
    fireflies: ffData,
    message: `File uploaded to Fireflies as "${meetingTitle}". Transcript will appear in the client profile once processing is complete (usually 15–30 min).`,
  });
}

/**
 * Health check
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "/api/fireflies/upload",
    method: "POST",
    description: "Upload audio/video files to Fireflies for transcription",
    fields: ["file", "client_slug", "call_date", "call_type"],
  });
}
