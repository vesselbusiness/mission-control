/**
 * POST /api/clients/[slug]/doc-upload
 * Accepts multipart/form-data with:
 *   - file: the uploaded file (.md, .txt, or .docx)
 *   - targetFile: the destination filename (e.g. CORE_CALLING.md)
 *
 * Steps:
 * 1. Extract text from the uploaded file
 * 2. Save to {workspace}/clients/{slug}/{targetFile}
 * 3. Generate an overview via OpenAI gpt-4o-mini
 * 4. Save overview to {workspace}/clients/{slug}/{targetFileBase}_OVERVIEW.md
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import mammoth from "mammoth";

export const dynamic = "force-dynamic";

// Remove backslash escape characters introduced by DOCX-to-text conversion
// e.g. "1\." → "1."  |  "\*" → "*"  |  "\+" → "+"
function cleanExtractedText(text: string): string {
  // Remove all backslash escapes introduced by DOCX-to-markdown conversion
  return text.replace(/\\(.)/g, "$1");
}

const WORKSPACE =
  process.env.OPENCLAW_WORKSPACE ?? "/Users/vincent/.openclaw/workspace";
const CLIENTS_DIR = path.join(WORKSPACE, "clients");

type Params = { params: Promise<{ slug: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { slug } = await params;

    // ── Parse multipart form data ──────────────────────────────────────────
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "Invalid multipart form data" },
        { status: 400 }
      );
    }

    const file = formData.get("file") as File | null;
    const targetFile = formData.get("targetFile") as string | null;

    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (!targetFile) {
      return NextResponse.json(
        { error: "targetFile is required" },
        { status: 400 }
      );
    }

    // ── Validate file extension ────────────────────────────────────────────
    const ext = path.extname(file.name).toLowerCase();
    if (![".md", ".txt", ".docx"].includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${ext}. Supported: .md, .txt, .docx` },
        { status: 400 }
      );
    }

    // ── Extract text content ───────────────────────────────────────────────
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let extractedText: string;

    if (ext === ".md" || ext === ".txt") {
      extractedText = buffer.toString("utf-8");
    } else {
      // .docx — use mammoth
      const result = await mammoth.extractRawText({ buffer });
      extractedText = cleanExtractedText(result.value);
    }

    // ── Security: prevent path traversal ──────────────────────────────────
    const clientDir = path.join(CLIENTS_DIR, slug);
    const targetPath = path.resolve(path.join(clientDir, targetFile));
    if (!targetPath.startsWith(clientDir)) {
      return NextResponse.json({ error: "Invalid target path" }, { status: 400 });
    }

    // ── Ensure directory exists ────────────────────────────────────────────
    await fs.mkdir(clientDir, { recursive: true });

    // ── Write main doc file ────────────────────────────────────────────────
    await fs.writeFile(targetPath, extractedText, "utf-8");

    // ── Derive overview filename ───────────────────────────────────────────
    const targetFileBase = targetFile.replace(/\.md$/i, "");
    const overviewFile = `${targetFileBase}_OVERVIEW.md`;
    const overviewPath = path.join(clientDir, overviewFile);

    // ── Generate overview via OpenAI ───────────────────────────────────────
    let overviewError: string | undefined;

    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OPENAI_API_KEY not set");

      const truncatedText =
        extractedText.length > 6000
          ? extractedText.slice(0, 6000) + "\n\n[... truncated ...]"
          : extractedText;

      const openaiRes = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content:
                  "You are a business assistant for Vessel Business, a coaching company that helps experts build online businesses. Generate a concise, well-structured overview of the following client document. Use clear section headings (## format). Focus on key insights, ICP details, product structure, and anything a coach would need to quickly reference. Be thorough but scannable — aim for 300-500 words.",
              },
              {
                role: "user",
                content: truncatedText,
              },
            ],
          }),
        }
      );

      if (!openaiRes.ok) {
        const errBody = await openaiRes.text();
        throw new Error(`OpenAI error ${openaiRes.status}: ${errBody}`);
      }

      const openaiData = (await openaiRes.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      const overviewContent = openaiData.choices[0]?.message?.content ?? "";
      await fs.writeFile(overviewPath, overviewContent, "utf-8");

      return NextResponse.json({
        success: true,
        file: targetFile,
        overviewFile,
        extractedLength: extractedText.length,
        overviewLength: overviewContent.length,
      });
    } catch (err) {
      overviewError =
        err instanceof Error ? err.message : "Unknown OpenAI error";

      // Still return success — main file was saved
      return NextResponse.json({
        success: true,
        file: targetFile,
        overviewFile,
        extractedLength: extractedText.length,
        overviewError,
      });
    }
  } catch (err) {
    console.error("[doc-upload] Error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
