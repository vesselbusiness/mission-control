"use client";

/**
 * Uploads — /uploads
 * Upload an audio/video file to Fireflies for transcription.
 * The file gets tagged with client + date + call type, sent to Fireflies,
 * and when Fireflies finishes → webhook → Call Processor → client profile.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Upload,
  Mic,
  Calendar,
  Users,
  Tag,
  CheckCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  X,
  FileAudio,
  FileVideo,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Client {
  slug: string;
  name: string;
}

interface UploadResult {
  success: boolean;
  meetingTitle: string;
  clientSlug: string;
  clientProfileUrl: string;
  message: string;
  requestId: string;
  error?: string;
  details?: string;
}

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; progress: number }
  | { status: "success"; result: UploadResult }
  | { status: "error"; message: string };

const CALL_TYPES = [
  "group-strategy",
  "1-on-1",
  "coaching",
  "onboarding",
  "kickoff",
  "review",
  "check-in",
  "deep-dive",
  "workshop",
  "other",
];

const ACCEPTED_TYPES =
  "audio/mp4,audio/mpeg,audio/mp3,audio/wav,audio/m4a,audio/ogg,audio/flac,video/mp4,video/quicktime,video/webm,.mp4,.mp3,.m4a,.wav,.ogg,.flac,.mov,.webm";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().split("T")[0]!;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isVideo(file: File): boolean {
  return file.type.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(file.name);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function UploadsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);

  const [file, setFile] = useState<File | null>(null);
  const [clientSlug, setClientSlug] = useState("");
  const [callDate, setCallDate] = useState(todayISO());
  const [callType, setCallType] = useState("group-strategy");
  const [customCallType, setCustomCallType] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  // ─── Load clients ──────────────────────────────────────────────────────────
  useEffect(() => {
    setClientsLoading(true);
    fetch("/api/clients")
      .then((r) => r.json())
      .then((data) => {
        const list: Client[] = Array.isArray(data)
          ? data.map((c: { slug: string; name: string }) => ({
              slug: c.slug,
              name: c.name,
            }))
          : [];
        setClients(list);
        if (list.length > 0 && !clientSlug) {
          setClientSlug(list[0]!.slug);
        }
      })
      .catch(() => setClients([]))
      .finally(() => setClientsLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── File handling ─────────────────────────────────────────────────────────
  const handleFile = useCallback((f: File) => {
    setFile(f);
    setUploadState({ status: "idle" });
  }, []);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const clearFile = () => {
    setFile(null);
    setUploadState({ status: "idle" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ─── Upload ────────────────────────────────────────────────────────────────
  const effectiveCallType =
    callType === "other" ? customCallType.trim() : callType;

  const canSubmit =
    !!file &&
    !!clientSlug &&
    !!callDate &&
    !!effectiveCallType &&
    uploadState.status === "idle";

  const meetingTitlePreview =
    clientSlug && callDate && effectiveCallType
      ? `${clientSlug}-${callDate}-${effectiveCallType}`
      : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !file) return;

    setUploadState({ status: "uploading", progress: 0 });

    const form = new FormData();
    form.append("file", file, file.name);
    form.append("client_slug", clientSlug);
    form.append("call_date", callDate);
    form.append("call_type", effectiveCallType);

    // Use XHR for upload progress tracking
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    xhr.upload.addEventListener("progress", (ev) => {
      if (ev.lengthComputable) {
        const pct = Math.round((ev.loaded / ev.total) * 100);
        setUploadState({ status: "uploading", progress: pct });
      }
    });

    xhr.addEventListener("load", () => {
      let result: UploadResult;
      try {
        result = JSON.parse(xhr.responseText) as UploadResult;
      } catch {
        setUploadState({
          status: "error",
          message: `Unexpected response from server (HTTP ${xhr.status})`,
        });
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300 && result.success) {
        setUploadState({ status: "success", result });
      } else {
        setUploadState({
          status: "error",
          message: result.error ?? `Upload failed (HTTP ${xhr.status})`,
        });
      }
    });

    xhr.addEventListener("error", () => {
      setUploadState({ status: "error", message: "Network error during upload" });
    });

    xhr.addEventListener("abort", () => {
      setUploadState({ status: "idle" });
    });

    xhr.open("POST", "/api/fireflies/upload");
    xhr.send(form);
  };

  const cancelUpload = () => {
    xhrRef.current?.abort();
    setUploadState({ status: "idle" });
  };

  const resetForm = () => {
    setFile(null);
    setCallDate(todayISO());
    setCallType("group-strategy");
    setCustomCallType("");
    setUploadState({ status: "idle" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const isUploading = uploadState.status === "uploading";
  const isSuccess = uploadState.status === "success";
  const isError = uploadState.status === "error";

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "rgba(99,102,241,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Mic size={20} color="#818cf8" />
          </div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "var(--text-primary, #f1f5f9)",
              margin: 0,
            }}
          >
            Upload Call Recording
          </h1>
        </div>
        <p style={{ color: "var(--text-muted, #64748b)", fontSize: 14, margin: 0 }}>
          Upload an audio or video file to Fireflies for transcription. Once
          processed, the transcript will appear in the client's profile.
        </p>
      </div>

      {/* ── Success state ──────────────────────────────────────────────────── */}
      {isSuccess && uploadState.status === "success" && (
        <div
          style={{
            background: "rgba(16,185,129,0.1)",
            border: "1px solid rgba(16,185,129,0.3)",
            borderRadius: 12,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <CheckCircle size={22} color="#10b981" />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#10b981", margin: 0 }}>
              Upload Successful
            </h2>
          </div>
          <p style={{ color: "var(--text-secondary, #94a3b8)", fontSize: 14, marginBottom: 16 }}>
            {uploadState.result.message}
          </p>
          <div
            style={{
              background: "rgba(0,0,0,0.2)",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              fontFamily: "monospace",
              color: "#818cf8",
              marginBottom: 16,
            }}
          >
            {uploadState.result.meetingTitle}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link
              href={uploadState.result.clientProfileUrl}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                background: "rgba(99,102,241,0.2)",
                border: "1px solid rgba(99,102,241,0.4)",
                borderRadius: 8,
                color: "#818cf8",
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              <ExternalLink size={14} />
              View Client Profile
            </Link>
            <button
              onClick={resetForm}
              style={{
                padding: "8px 16px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                color: "var(--text-secondary, #94a3b8)",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Upload Another
            </button>
          </div>
        </div>
      )}

      {/* ── Error state ────────────────────────────────────────────────────── */}
      {isError && uploadState.status === "error" && (
        <div
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <AlertCircle size={18} color="#ef4444" />
          <p style={{ color: "#f87171", fontSize: 14, margin: 0, flex: 1 }}>
            {uploadState.message}
          </p>
          <button
            onClick={() => setUploadState({ status: "idle" })}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#ef4444",
              padding: 4,
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Form ───────────────────────────────────────────────────────────── */}
      {!isSuccess && (
        <form onSubmit={handleSubmit}>
          <div
            style={{
              background: "var(--surface, rgba(255,255,255,0.03))",
              border: "1px solid var(--border, rgba(255,255,255,0.08))",
              borderRadius: 16,
              padding: 28,
              display: "flex",
              flexDirection: "column",
              gap: 24,
            }}
          >
            {/* File drop zone */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text-secondary, #94a3b8)",
                  marginBottom: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Recording File
              </label>
              {file ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    background: "rgba(99,102,241,0.08)",
                    border: "1px solid rgba(99,102,241,0.25)",
                    borderRadius: 10,
                  }}
                >
                  {isVideo(file) ? (
                    <FileVideo size={20} color="#818cf8" />
                  ) : (
                    <FileAudio size={20} color="#818cf8" />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        color: "var(--text-primary, #f1f5f9)",
                        fontWeight: 500,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {file.name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted, #64748b)" }}>
                      {formatBytes(file.size)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearFile}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--text-muted, #64748b)",
                      padding: 4,
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  style={{
                    border: `2px dashed ${isDragging ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.12)"}`,
                    borderRadius: 12,
                    padding: "32px 24px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: isDragging
                      ? "rgba(99,102,241,0.05)"
                      : "rgba(0,0,0,0.1)",
                    transition: "all 0.2s",
                  }}
                >
                  <Upload
                    size={28}
                    color={isDragging ? "#818cf8" : "rgba(148,163,184,0.5)"}
                    style={{ marginBottom: 10 }}
                  />
                  <p
                    style={{
                      fontSize: 14,
                      color: isDragging ? "#818cf8" : "var(--text-secondary, #94a3b8)",
                      margin: "0 0 4px",
                    }}
                  >
                    Drop file here or{" "}
                    <span style={{ color: "#818cf8", textDecoration: "underline" }}>
                      browse
                    </span>
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-muted, #64748b)", margin: 0 }}>
                    MP4, MP3, M4A, WAV, MOV, FLAC (up to 500MB)
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                onChange={onFileInput}
                style={{ display: "none" }}
              />
            </div>

            {/* Client */}
            <div>
              <label
                htmlFor="client"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text-secondary, #94a3b8)",
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                <Users size={13} />
                Client
              </label>
              {clientsLoading ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "var(--text-muted, #64748b)",
                    fontSize: 14,
                  }}
                >
                  <Loader2 size={14} className="animate-spin" />
                  Loading clients…
                </div>
              ) : (
                <select
                  id="client"
                  value={clientSlug}
                  onChange={(e) => setClientSlug(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    color: "var(--text-primary, #f1f5f9)",
                    fontSize: 14,
                    appearance: "auto",
                  }}
                >
                  <option value="">— Select a client —</option>
                  {clients.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name} ({c.slug})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Date + Call Type (side by side) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Date */}
              <div>
                <label
                  htmlFor="call-date"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text-secondary, #94a3b8)",
                    marginBottom: 8,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  <Calendar size={13} />
                  Call Date
                </label>
                <input
                  id="call-date"
                  type="date"
                  value={callDate}
                  onChange={(e) => setCallDate(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    color: "var(--text-primary, #f1f5f9)",
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Call Type */}
              <div>
                <label
                  htmlFor="call-type"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text-secondary, #94a3b8)",
                    marginBottom: 8,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  <Tag size={13} />
                  Call Type
                </label>
                <select
                  id="call-type"
                  value={callType}
                  onChange={(e) => setCallType(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    color: "var(--text-primary, #f1f5f9)",
                    fontSize: 14,
                    appearance: "auto",
                  }}
                >
                  {CALL_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Custom call type input */}
            {callType === "other" && (
              <div>
                <label
                  htmlFor="custom-call-type"
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text-secondary, #94a3b8)",
                    marginBottom: 8,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Custom Type
                </label>
                <input
                  id="custom-call-type"
                  type="text"
                  value={customCallType}
                  onChange={(e) => setCustomCallType(e.target.value)}
                  placeholder="e.g. vsl-review"
                  required
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    color: "var(--text-primary, #f1f5f9)",
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                />
              </div>
            )}

            {/* Meeting title preview */}
            {meetingTitlePreview && (
              <div
                style={{
                  padding: "12px 16px",
                  background: "rgba(0,0,0,0.2)",
                  borderRadius: 8,
                  borderLeft: "3px solid rgba(99,102,241,0.5)",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted, #64748b)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: 4,
                  }}
                >
                  Meeting title preview
                </div>
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: 13,
                    color: "#818cf8",
                  }}
                >
                  {meetingTitlePreview}
                </div>
              </div>
            )}

            {/* Upload button / progress */}
            {isUploading ? (
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      color: "#818cf8",
                      fontSize: 14,
                    }}
                  >
                    <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                    Uploading to Fireflies…{" "}
                    {uploadState.status === "uploading" && `${uploadState.progress}%`}
                  </div>
                  <button
                    type="button"
                    onClick={cancelUpload}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--text-muted, #64748b)",
                      fontSize: 13,
                    }}
                  >
                    Cancel
                  </button>
                </div>
                <div
                  style={{
                    width: "100%",
                    height: 6,
                    background: "rgba(255,255,255,0.08)",
                    borderRadius: 3,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${uploadState.status === "uploading" ? uploadState.progress : 0}%`,
                      background: "linear-gradient(90deg, #6366f1, #818cf8)",
                      borderRadius: 3,
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
              </div>
            ) : (
              <button
                type="submit"
                disabled={!canSubmit}
                style={{
                  width: "100%",
                  padding: "12px 24px",
                  background: canSubmit
                    ? "linear-gradient(135deg, #6366f1, #818cf8)"
                    : "rgba(255,255,255,0.05)",
                  border: "none",
                  borderRadius: 10,
                  color: canSubmit ? "#fff" : "var(--text-muted, #64748b)",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "all 0.2s",
                }}
              >
                <Upload size={16} />
                Upload to Fireflies
              </button>
            )}
          </div>
        </form>
      )}

      {/* ── Info box ───────────────────────────────────────────────────────── */}
      <div
        style={{
          marginTop: 20,
          padding: "14px 18px",
          background: "rgba(0,0,0,0.15)",
          borderRadius: 10,
          fontSize: 13,
          color: "var(--text-muted, #64748b)",
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: "var(--text-secondary, #94a3b8)" }}>How it works:</strong>{" "}
        The file is uploaded to Fireflies with the generated meeting title. Fireflies
        transcribes the recording (usually 15–30 min), then sends a webhook to Mission
        Control. The Call Processor automatically extracts insights and updates the
        client's profile, todos, and activity feed.
      </div>

      {/* Spin animation */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
