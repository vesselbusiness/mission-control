"use client";

/**
 * Client Detail — /clients/[slug]
 * Full 1:1 coaching client workspace with doc editor, transcripts, screenshots, funnels, phase board.
 */

import { use, useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Edit3,
  Save,
  X,
  Upload,
  Eye,
  Loader2,
  MapPin,
  Calendar,
  FileText,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  CheckCircle,
  Clock,
  Pencil,
  ExternalLink,
  Check,
  Square,
} from "lucide-react";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import { PhaseBoard } from "@/components/PhaseBoard";
import { EnhancedTodoList } from "@/components/EnhancedTodoList";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientFiles {
  slug: string;
  docs: string[];
  images: string[];
  transcripts: string[];
  hasAvatar: boolean;
}

interface ClientMeta {
  name: string;
  stage: string;
  location: string;
  lastUpdated: string;
}

type TabId =
  | "client-info"
  | "overview"
  | "deliverables"
  | "offer"
  | "branding"
  | "phase-board"
  | "tasks"
  | "transcripts"
  | "idea-board";

interface NavItem {
  id: TabId;
  label: string;
  file?: string;
}

interface NavSection {
  section?: string;
  items: NavItem[];
}

const NAV_ITEMS: NavSection[] = [
  {
    items: [
      { id: "client-info", label: "Client Info", file: "CLIENT_INFO.json" },
      { id: "overview", label: "Client Overview", file: "PROFILE.md" },
      { id: "transcripts", label: "Coaching Calls" },
      { id: "branding", label: "Branding", file: "BRANDING.md" },
      { id: "deliverables", label: "Client Docs" },
      { id: "offer", label: "Client Offers" },
    ],
  },
  {
    section: "Project Management",
    items: [
      { id: "phase-board", label: "Program Phases" },
      { id: "tasks", label: "To-Do List" },
      { id: "idea-board", label: "Idea Board" },
    ],
  },
];

// ─── Client Info Types ────────────────────────────────────────────────────────

interface ClientInfo {
  legalBusinessName: string;
  phoneNumber: string;
  businessEmail: string;
  personalEmail: string;
  vbsGhlLocationId: string;
  vbsGhlInternalPhone: string;
  googleDriveFolderLink: string;
}

const DEFAULT_CLIENT_INFO: ClientInfo = {
  legalBusinessName: "",
  phoneNumber: "",
  businessEmail: "",
  personalEmail: "",
  vbsGhlLocationId: "",
  vbsGhlInternalPhone: "",
  googleDriveFolderLink: "",
};

// ─── Phase Board Types ────────────────────────────────────────────────────────

interface PhaseBoardTask {
  id: string;
  label: string;
  completed: boolean;
  completedAt: string | null;
  viewDoc?: string;
  viewDocFile?: string;
  subtasks?: PhaseBoardTask[];
}

interface PhaseBoardPhase {
  id: string;
  label: string;
  tasks: PhaseBoardTask[];
}

interface PhaseBoardData {
  phases: PhaseBoardPhase[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

function getStageColors(stage: string): { bg: string; text: string; border: string } {
  const lower = stage.toLowerCase();
  if (lower.includes("pre-launch") || lower.includes("pre launch"))
    return { bg: "rgba(217, 119, 6, 0.1)", text: "#D97706", border: "rgba(217, 119, 6, 0.25)" };
  if (lower.includes("scaling"))
    return { bg: "rgba(11, 127, 190, 0.1)", text: "#0B7FBE", border: "rgba(11, 127, 190, 0.25)" };
  if (lower.includes("launched") || lower.includes("launch"))
    return { bg: "rgba(45, 134, 89, 0.1)", text: "#2D8659", border: "rgba(45, 134, 89, 0.25)" };
  if (lower.includes("active"))
    return { bg: "rgba(107, 91, 149, 0.1)", text: "#6B5B95", border: "rgba(107, 91, 149, 0.25)" };
  return { bg: "rgba(138, 150, 168, 0.1)", text: "#5A6B7F", border: "rgba(138, 150, 168, 0.25)" };
}

function getStageBadgeLabel(stage: string): string {
  if (!stage) return "No stage";
  const dashIdx = stage.indexOf(" —");
  return dashIdx > 0 ? stage.slice(0, dashIdx) : stage;
}

function formatDate(date: string): string {
  if (!date) return "Unknown";
  try {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return date;
  }
}

function parseMetaFromProfile(content: string): ClientMeta {
  const firstLine = content.split("\n")[0] ?? "";
  const name = firstLine.replace(/^#\s*/, "").trim();
  const stage = content.match(/\*\*Stage:\*\*\s*([^\n]+)/)?.[1]?.trim() ?? "";
  const location = content.match(/\*\*Location:\*\*\s*([^\n]+)/)?.[1]?.trim() ?? "";
  const lastUpdated = content.match(/## Last Updated\s*\n([^\n]+)/)?.[1]?.trim() ?? "";
  return { name, stage, location, lastUpdated };
}

function transcriptDateFromFilename(filename: string): string {
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return formatDate(match[1]);
  return "";
}

function transcriptLabel(filename: string): string {
  return filename.replace(/\.md$/, "").replace(/^[\d-]+/, "").replace(/^-/, "").replace(/-/g, " ");
}

// ─── Unified Client Information Header ───────────────────────────────────────

interface ClientInfoPanelProps {
  slug: string;
  meta: ClientMeta | null;
  displayName: string;
  stageColors: { bg: string; text: string; border: string } | null;
  stageBadge: string | null;
  hasAvatar: boolean;
}

function ClientInfoPanel({ slug, meta, displayName, stageColors, stageBadge, hasAvatar }: ClientInfoPanelProps) {
  const initials = getInitials(displayName);
  const [info, setInfo] = useState<ClientInfo>(DEFAULT_CLIENT_INFO);
  const [editing, setEditing] = useState(false);
  const [editInfo, setEditInfo] = useState<ClientInfo>(DEFAULT_CLIENT_INFO);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/clients/${slug}/info`);
        if (!res.ok) return;
        const data = await res.json() as ClientInfo;
        setInfo(data);
        setIsEmpty(Object.values(data).every((v) => !v));
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const handleEdit = () => {
    setEditInfo({ ...info });
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setEditInfo(DEFAULT_CLIENT_INFO);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${slug}/info`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editInfo),
      });
      if (!res.ok) throw new Error("Failed to save");
      setInfo(editInfo);
      setIsEmpty(Object.values(editInfo).every((v) => !v));
      setEditing(false);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  const INFO_FIELDS: { key: keyof ClientInfo; label: string; type?: string }[] = [
    { key: "legalBusinessName", label: "Legal Name" },
    { key: "phoneNumber", label: "Phone" },
    { key: "businessEmail", label: "Business Email", type: "email" },
    { key: "personalEmail", label: "Personal Email", type: "email" },
    { key: "vbsGhlLocationId", label: "GHL Location ID" },
    { key: "vbsGhlInternalPhone", label: "GHL Phone" },
    { key: "googleDriveFolderLink", label: "Drive Folder", type: "url" },
  ];

  return (
    <div
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "14px",
        padding: "18px 24px",
        marginBottom: "20px",
      }}
    >
      {/* ── Profile row: avatar + name + badges ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px", paddingBottom: "16px", borderBottom: "1px solid var(--border)" }}>
        {/* Avatar */}
        <div
          style={{ width: "52px", height: "52px", borderRadius: "50%", backgroundColor: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: 700, color: "#fff", fontFamily: "var(--font-heading)", overflow: "hidden", flexShrink: 0 }}
        >
          {hasAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/clients/${slug}/avatar`} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : initials}
        </div>
        {/* Name + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)", fontFamily: "var(--font-heading)", lineHeight: 1.2, marginBottom: "6px" }}>{displayName}</div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {stageBadge && stageColors && (
              <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.03em", backgroundColor: stageColors.bg, color: stageColors.text, border: `1px solid ${stageColors.border}` }}>
                {stageBadge}
              </span>
            )}
            {meta?.location && (
              <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "var(--text-muted)" }}>
                <MapPin style={{ width: "11px", height: "11px" }} />
                {meta.location}
              </div>
            )}
            {meta?.lastUpdated && (
              <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "var(--text-muted)" }}>
                <Calendar style={{ width: "11px", height: "11px" }} />
                {formatDate(meta.lastUpdated)}
              </div>
            )}
          </div>
        </div>
        {/* Edit/Save actions */}
        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
          {editing ? (
            <>
              <button
                onClick={handleCancel}
                style={{ padding: "6px 12px", borderRadius: "7px", border: "1px solid var(--border-strong)", backgroundColor: "transparent", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={() => { void handleSave(); }}
                disabled={saving}
                style={{ padding: "6px 12px", borderRadius: "7px", border: "none", backgroundColor: "var(--accent)", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "5px", opacity: saving ? 0.7 : 1 }}
              >
                {saving ? <Loader2 style={{ width: "11px", height: "11px", animation: "spin 1s linear infinite" }} /> : <Save style={{ width: "11px", height: "11px" }} />}
                Save
              </button>
            </>
          ) : (
            <button
              onClick={handleEdit}
              style={{ padding: "6px 12px", borderRadius: "7px", border: "1px solid var(--border-strong)", backgroundColor: "transparent", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}
            >
              <Edit3 style={{ width: "11px", height: "11px" }} />
              Edit Info
            </button>
          )}
        </div>
      </div>

      {/* ── Info fields row ── */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
        <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: "16px", minWidth: 0 }}>
        {isEmpty && !editing ? (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              Client info not filled in yet.
            </span>
            <button
              onClick={handleEdit}
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--accent)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              Fill in now →
            </button>
          </div>
        ) : editing ? (
          INFO_FIELDS.map(({ key, label, type }) => (
            <div key={key} style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: "130px" }}>
              <label style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {label}
              </label>
              <input
                type={type ?? "text"}
                value={editInfo[key]}
                onChange={(e) => setEditInfo((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder={label}
                style={{
                  padding: "5px 8px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-strong)",
                  backgroundColor: "var(--bg)",
                  color: "var(--text-primary)",
                  fontSize: "12px",
                  outline: "none",
                  width: "140px",
                  boxSizing: "border-box",
                }}
              />
            </div>
          ))
        ) : (
          INFO_FIELDS.map(({ key, label, type }) => {
            const value = info[key];
            if (!value) return null;
            return (
              <div key={key} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {label}
                </span>
                {type === "url" ? (
                  <a
                    href={value}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: "12px",
                      color: "var(--accent)",
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    Open Drive <ExternalLink style={{ width: "10px", height: "10px" }} />
                  </a>
                ) : (
                  <span style={{ fontSize: "12px", color: "var(--text-primary)", fontWeight: 500 }}>
                    {value}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
      </div>
    </div>
  );
}

// ─── Upload Transcript Modal ───────────────────────────────────────────────────

// ─── Document Tab ─────────────────────────────────────────────────────────────

interface DocTabProps {
  slug: string;
  file: string;
}

function DocTab({ slug, file }: DocTabProps) {
  const [content, setContent] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const fetchContent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${slug}/doc?file=${encodeURIComponent(file)}`);
      if (!res.ok) throw new Error("Failed to load document");
      const data = await res.json() as { content: string };
      setContent(data.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [slug, file]);

  useEffect(() => {
    void fetchContent();
    setEditing(false);
    setLastSaved(null);
  }, [fetchContent]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${slug}/doc?file=${encodeURIComponent(file)}`, {
        method: "PUT",
        body: editContent,
      });
      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json() as { savedAt: string };
      setContent(editContent);
      setLastSaved(data.savedAt);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
        <Loader2 style={{ width: "28px", height: "28px", color: "var(--accent)", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (error && !content) {
    return (
      <div style={{ padding: "24px", backgroundColor: "var(--negative-soft)", borderRadius: "12px", color: "var(--negative)", fontSize: "14px" }}>{error}</div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <FileText style={{ width: "16px", height: "16px", color: "var(--text-muted)" }} />
          <span style={{ fontSize: "13px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{file}</span>
          {lastSaved && <span style={{ fontSize: "12px", color: "var(--positive)", marginLeft: "8px" }}>✓ Saved {new Date(lastSaved).toLocaleTimeString()}</span>}
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {editing ? (
            <>
              <button onClick={() => { setEditing(false); setEditContent(""); }} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "8px", border: "1px solid var(--border-strong)", backgroundColor: "transparent", color: "var(--text-secondary)", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                <X style={{ width: "13px", height: "13px" }} /> Cancel
              </button>
              <button onClick={() => { void handleSave(); }} disabled={saving} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "8px", border: "none", backgroundColor: "var(--accent)", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? <Loader2 style={{ width: "13px", height: "13px", animation: "spin 1s linear infinite" }} /> : <Save style={{ width: "13px", height: "13px" }} />}
                Save
              </button>
            </>
          ) : (
            <button onClick={() => { setEditContent(content ?? ""); setEditing(true); }} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "8px", border: "1px solid var(--border-strong)", backgroundColor: "var(--surface)", color: "var(--text-secondary)", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
              <Edit3 style={{ width: "13px", height: "13px" }} /> Edit
            </button>
          )}
        </div>
      </div>
      {error && <div style={{ marginBottom: "12px", padding: "10px 14px", borderRadius: "8px", backgroundColor: "var(--negative-soft)", color: "var(--negative)", fontSize: "13px" }}>{error}</div>}
      <div style={{ flex: 1, borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden", minHeight: "400px" }}>
        {editing ? (
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            style={{ width: "100%", height: "100%", minHeight: "500px", padding: "20px", border: "none", outline: "none", resize: "vertical", fontFamily: "var(--font-mono)", fontSize: "13px", lineHeight: 1.7, backgroundColor: "var(--bg)", color: "var(--text-primary)", boxSizing: "border-box" }}
          />
        ) : (
          <MarkdownPreview content={content ?? ""} />
        )}
      </div>
    </div>
  );
}

// ─── Client Info Tab ─────────────────────────────────────────────────────────

interface ClientInfoTabProps {
  slug: string;
}

function ClientInfoTab({ slug }: ClientInfoTabProps) {
  const [info, setInfo] = useState<ClientInfo>(DEFAULT_CLIENT_INFO);
  const [editInfo, setEditInfo] = useState<ClientInfo>(DEFAULT_CLIENT_INFO);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const INFO_FIELDS: { key: keyof ClientInfo; label: string; type?: string }[] = [
    { key: "legalBusinessName", label: "Legal Business Name" },
    { key: "phoneNumber", label: "Phone Number", type: "tel" },
    { key: "businessEmail", label: "Business Email", type: "email" },
    { key: "personalEmail", label: "Personal Email", type: "email" },
    { key: "vbsGhlLocationId", label: "VBS GHL Location ID" },
    { key: "vbsGhlInternalPhone", label: "VBS GHL Internal Phone Number" },
    { key: "googleDriveFolderLink", label: "Google Drive Folder Link", type: "url" },
  ];

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/clients/${slug}/info`);
        if (!res.ok) return;
        const data = await res.json() as ClientInfo;
        setInfo(data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${slug}/info`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editInfo),
      });
      if (!res.ok) throw new Error("Failed to save");
      setInfo(editInfo);
      setEditing(false);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
        <Loader2 style={{ width: "28px", height: "28px", color: "var(--accent)", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-heading)", margin: "0 0 4px" }}>Client Info</h3>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>Contact details and account identifiers.</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {editing ? (
            <>
              <button
                onClick={() => { setEditing(false); setEditInfo({ ...info }); }}
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "8px", border: "1px solid var(--border-strong)", backgroundColor: "transparent", color: "var(--text-secondary)", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
              >
                <X style={{ width: "13px", height: "13px" }} /> Cancel
              </button>
              <button
                onClick={() => { void handleSave(); }}
                disabled={saving}
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "8px", border: "none", backgroundColor: "var(--accent)", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
              >
                {saving ? <Loader2 style={{ width: "13px", height: "13px", animation: "spin 1s linear infinite" }} /> : <Save style={{ width: "13px", height: "13px" }} />}
                Save
              </button>
            </>
          ) : (
            <button
              onClick={() => { setEditInfo({ ...info }); setEditing(true); }}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "8px", border: "1px solid var(--border-strong)", backgroundColor: "var(--surface)", color: "var(--text-secondary)", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
            >
              <Edit3 style={{ width: "13px", height: "13px" }} /> Edit Info
            </button>
          )}
        </div>
      </div>

      {/* Info card */}
      <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          {INFO_FIELDS.map(({ key, label, type }) => (
            <div key={key} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                {label}
              </label>
              {editing ? (
                <input
                  type={type ?? "text"}
                  value={editInfo[key]}
                  onChange={(e) => setEditInfo((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder={label}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "7px",
                    border: "1px solid var(--border-strong)",
                    backgroundColor: "var(--bg)",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                    outline: "none",
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                />
              ) : (
                <div>
                  {type === "url" && info[key] ? (
                    <a
                      href={info[key]}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: "13px", color: "var(--accent)", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}
                    >
                      Open Folder <ExternalLink style={{ width: "11px", height: "11px" }} />
                    </a>
                  ) : (
                    <span style={{ fontSize: "13px", color: info[key] ? "var(--text-primary)" : "var(--text-muted)", fontStyle: info[key] ? "normal" : "italic", fontWeight: info[key] ? 500 : 400 }}>
                      {info[key] || "Not set"}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Profile Tab Helpers ──────────────────────────────────────────────────────

function parseSections(markdown: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const parts = markdown.split(/\n## /);
  for (const part of parts) {
    const newlineIdx = part.indexOf("\n");
    if (newlineIdx === -1) continue;
    const heading = part.slice(0, newlineIdx).replace(/^## /, "").trim();
    const body = part.slice(newlineIdx + 1).trim();
    sections[heading] = body;
  }
  return sections;
}

function parseKeyValue(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = text.split("\n");
  for (const line of lines) {
    const match = line.match(/^\*\*(.+?):\*\*\s*(.+)/);
    if (match) result[match[1].trim()] = match[2].trim();
  }
  return result;
}

function parseBullets(text: string): string[] {
  return text
    .split("\n")
    .filter((l) => l.trim().startsWith("- "))
    .map((l) => l.replace(/^[\s-]+/, "").trim());
}

function parseTable(text: string): string[][] {
  return text
    .split("\n")
    .filter((l) => l.trim().startsWith("|") && !l.includes("---"))
    .map((l) => l.split("|").filter(Boolean).map((c) => c.trim()));
}

function updateSection(fullContent: string, sectionHeading: string, newBody: string): string {
  const parts = fullContent.split(/\n## /);
  const updated = parts.map((part, i) => {
    if (i === 0) return part;
    const newlineIdx = part.indexOf("\n");
    if (newlineIdx === -1) return part;
    const heading = part.slice(0, newlineIdx).trim();
    if (heading === sectionHeading) {
      return `${heading}\n${newBody}`;
    }
    return part;
  });
  return updated.join("\n## ");
}

// ─── Profile Section Card ─────────────────────────────────────────────────────

interface ProfileSectionCardProps {
  slug: string;
  title: string;
  sectionHeading: string;
  fullContent: string;
  onSaved: (newContent: string) => void;
  children: React.ReactNode;
  cardStyle?: React.CSSProperties;
}

function ProfileSectionCard({
  slug,
  title,
  sectionHeading,
  fullContent,
  onSaved,
  children,
  cardStyle: extraCardStyle,
}: ProfileSectionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  const sections = parseSections(fullContent);
  const sectionBody = sections[sectionHeading] ?? "";

  const handleEdit = () => {
    setEditContent(sectionBody);
    setIsEditing(true);
    setCardError(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditContent("");
    setCardError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setCardError(null);
    try {
      const newFullContent = updateSection(fullContent, sectionHeading, editContent);
      const res = await fetch(`/api/clients/${slug}/doc?file=PROFILE.md`, {
        method: "PUT",
        body: newFullContent,
      });
      if (!res.ok) throw new Error("Failed to save");
      onSaved(newFullContent);
      setIsEditing(false);
    } catch (err) {
      setCardError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const baseCardStyle: React.CSSProperties = {
    backgroundColor: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    overflow: "hidden",
    ...extraCardStyle,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
  };

  const btnBase: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    padding: "5px 10px",
    borderRadius: "7px",
    border: "1px solid var(--border-strong)",
    backgroundColor: "transparent",
    color: "var(--text-secondary)",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
  };

  return (
    <div style={baseCardStyle}>
      {/* Card header: subtle background, title + edit controls */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "11px 16px",
        backgroundColor: "#f5f5f5",
        borderBottom: "1px solid var(--border)",
      }}>
        <span style={titleStyle}>{title}</span>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          {isEditing ? (
            <>
              <button onClick={handleCancel} style={btnBase}>
                <X style={{ width: "11px", height: "11px" }} /> Cancel
              </button>
              <button
                onClick={() => { void handleSave(); }}
                disabled={saving}
                style={{ ...btnBase, border: "none", backgroundColor: "var(--accent)", color: "#fff", opacity: saving ? 0.7 : 1, cursor: saving ? "not-allowed" : "pointer" }}
              >
                {saving
                  ? <Loader2 style={{ width: "11px", height: "11px", animation: "spin 1s linear infinite" }} />
                  : <Save style={{ width: "11px", height: "11px" }} />}
                Save
              </button>
            </>
          ) : (
            <button onClick={handleEdit} style={btnBase}>
              <Edit3 style={{ width: "11px", height: "11px" }} /> Edit
            </button>
          )}
        </div>
      </div>

      {/* Card content */}
      <div style={{ padding: "16px", backgroundColor: "#fff" }}>
        {cardError && (
          <div style={{ marginBottom: "10px", padding: "8px 12px", borderRadius: "7px", backgroundColor: "var(--negative-soft)", color: "var(--negative)", fontSize: "12px" }}>
            {cardError}
          </div>
        )}

        {isEditing ? (
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            style={{
              width: "100%",
              minHeight: "160px",
              padding: "12px",
              border: "1px solid var(--border-strong)",
              borderRadius: "8px",
              outline: "none",
              resize: "vertical",
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              lineHeight: 1.7,
              backgroundColor: "var(--bg)",
              color: "var(--text-primary)",
              boxSizing: "border-box",
            }}
          />
        ) : (
          children
        )}
      </div>
    </div>
  );
}

// ─── Products Value Ladder Card ──────────────────────────────────────────────

interface ProductsValueLadderCardProps {
  slug: string;
  onNavigateToOffers?: () => void;
}

function ProductsValueLadderCard({ slug, onNavigateToOffers }: ProductsValueLadderCardProps) {
  const [tiers, setTiers] = useState<ValueLadderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/clients/${slug}/value-ladder`);
        if (res.ok) {
          const data = await res.json() as ValueLadderData;
          if (data.tiers?.length > 0) setTiers(data.tiers);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const btnBase: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    padding: "5px 10px",
    borderRadius: "7px",
    border: "1px solid var(--border-strong)",
    backgroundColor: "transparent",
    color: "var(--text-secondary)",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
  };

  return (
    <div style={{
      backgroundColor: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "12px",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "11px 16px",
        backgroundColor: "#f5f5f5",
        borderBottom: "1px solid var(--border)",
      }}>
        <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          CLIENT OFFERS
        </span>
        <button
          onClick={onNavigateToOffers}
          style={btnBase}
          title="Edit in Client Offers"
        >
          <Edit3 style={{ width: "11px", height: "11px" }} /> Edit
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: "16px", backgroundColor: "#fff" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "16px" }}>
            <Loader2 style={{ width: "16px", height: "16px", color: "var(--accent)", animation: "spin 1s linear infinite" }} />
          </div>
        ) : tiers.length === 0 ? (
          <p style={{ fontSize: "13px", color: "var(--text-muted)", fontStyle: "italic", margin: 0 }}>
            No products yet.{" "}
            {onNavigateToOffers && (
              <button
                onClick={onNavigateToOffers}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: "13px", fontWeight: 600, padding: 0 }}
              >
                Add in Client Offers →
              </button>
            )}
          </p>
        ) : (
          <div>
            {tiers.map((tier, i) => {
              const cfg = STATUS_CONFIG[tier.status] ?? { label: tier.status, color: "#9CA3AF" };
              return (
                <div
                  key={tier.step}
                  style={{
                    padding: "10px 0",
                    borderBottom: i < tiers.length - 1 ? "1px solid #e5e5e5" : "none",
                  }}
                >
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4 }}>
                    {tier.name}
                    {tier.productName && (
                      <span style={{ fontWeight: 400, color: "var(--text-muted)" }}> ({tier.productName})</span>
                    )}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "3px", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600 }}>{tier.price}</span>
                    {tier.frequency && (
                      <>
                        <span style={{ color: "var(--text-muted)" }}>•</span>
                        <span style={{ color: "var(--text-muted)" }}>{tier.frequency}</span>
                      </>
                    )}
                  </div>
                  <div style={{ fontSize: "12px", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ color: "var(--text-muted)" }}>Status:</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: cfg.color, display: "inline-block", flexShrink: 0 }} />
                      <span style={{ color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Profile Tab ─────────────────────────────────────────────────────────────

interface ProfileTabProps {
  slug: string;
  onNavigateToOffers?: () => void;
}

function ProfileTab({ slug, onNavigateToOffers }: ProfileTabProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${slug}/doc?file=PROFILE.md`);
      if (!res.ok) throw new Error("Failed to load profile");
      const data = await res.json() as { content: string };
      setContent(data.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void fetchContent();
  }, [fetchContent]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
        <Loader2 style={{ width: "28px", height: "28px", color: "var(--accent)", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (error && !content) {
    return (
      <div style={{ padding: "24px", backgroundColor: "var(--negative-soft)", borderRadius: "12px", color: "var(--negative)", fontSize: "14px" }}>{error}</div>
    );
  }

  // ── Parse sections ──
  const sections = parseSections(content ?? "");
  const businessSection = parseKeyValue(sections["Business"] ?? "");
  const backgroundBullets = parseBullets(sections["Background"] ?? "");
  const audienceBullets = parseBullets(sections["Audience"] ?? "");
  const coachingBullets = parseBullets(sections["Relationship with Vessel"] ?? "");

  // ── Card view ──
  return (
    <div>
      {error && (
        <div style={{ marginBottom: "12px", padding: "10px 14px", borderRadius: "8px", backgroundColor: "var(--negative-soft)", color: "var(--negative)", fontSize: "13px" }}>
          {error}
        </div>
      )}

      {/* Row 1: Business + Products (Products always from Value Ladder) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
        {Object.keys(businessSection).length > 0 && (
          <ProfileSectionCard
            slug={slug}
            title="Business"
            sectionHeading="Business"
            fullContent={content ?? ""}
            onSaved={setContent}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              {Object.entries(businessSection).map(([key, value], idx, arr) => (
                <div key={key} style={{ padding: "10px 0", borderBottom: idx < arr.length - 1 ? "1px solid #e5e5e5" : "none" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {key}
                  </span>
                  <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--text-primary)", lineHeight: 1.5 }}>{value}</p>
                </div>
              ))}
            </div>
          </ProfileSectionCard>
        )}

        {/* Products always synced from Value Ladder */}
        <ProductsValueLadderCard slug={slug} onNavigateToOffers={onNavigateToOffers} />
      </div>

      {/* Row 2: Background + Audience */}
      {(backgroundBullets.length > 0 || audienceBullets.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
          {backgroundBullets.length > 0 && (
            <ProfileSectionCard
              slug={slug}
              title="Background"
              sectionHeading="Background"
              fullContent={content ?? ""}
              onSaved={setContent}
            >
              <ul style={{ margin: 0, padding: "0 0 0 16px", display: "flex", flexDirection: "column", gap: "6px" }}>
                {backgroundBullets.map((b, i) => (
                  <li key={i} style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>{b}</li>
                ))}
              </ul>
            </ProfileSectionCard>
          )}
          {audienceBullets.length > 0 && (
            <ProfileSectionCard
              slug={slug}
              title="Audience"
              sectionHeading="Audience"
              fullContent={content ?? ""}
              onSaved={setContent}
            >
              <div style={{ display: "flex", flexDirection: "column" }}>
                {audienceBullets.map((b, i) => (
                  <div key={i} style={{ padding: "9px 0", borderBottom: i < audienceBullets.length - 1 ? "1px solid #e5e5e5" : "none", fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>{b}</div>
                ))}
              </div>
            </ProfileSectionCard>
          )}
        </div>
      )}

      {/* Full-width: Coaching Notes */}
      {coachingBullets.length > 0 && (
        <ProfileSectionCard
          slug={slug}
          title="Coaching Notes"
          sectionHeading="Relationship with Vessel"
          fullContent={content ?? ""}
          onSaved={setContent}
          cardStyle={{ marginBottom: "16px" }}
        >
          <ul style={{ margin: 0, padding: "0 0 0 16px", display: "flex", flexDirection: "column", gap: "6px" }}>
            {coachingBullets.map((b, i) => (
              <li key={i} style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>{b}</li>
            ))}
          </ul>
        </ProfileSectionCard>
      )}
    </div>
  );
}

// ─── Branding Tab ────────────────────────────────────────────────────────────

interface BrandingData {
  // Copy & Voice
  toneOfVoice: string;
  messagingPillars: string;
  tagline: string;
  languageTheyUse: string;
  // Visual Identity
  primaryColorName: string;
  primaryColorHex: string;
  secondaryColors: string;
  accentColor: string;
  primaryFont: string;
  secondaryFont: string;
  logoUrl: string;
  vibeAesthetic: string;
  // Brand Personality
  brandValues: string;
  whatSheStandsFor: string;
  whatSheAvoids: string;
}

const DEFAULT_BRANDING: BrandingData = {
  toneOfVoice: "",
  messagingPillars: "",
  tagline: "",
  languageTheyUse: "",
  primaryColorName: "",
  primaryColorHex: "",
  secondaryColors: "",
  accentColor: "",
  primaryFont: "",
  secondaryFont: "",
  logoUrl: "",
  vibeAesthetic: "",
  brandValues: "",
  whatSheStandsFor: "",
  whatSheAvoids: "",
};

function parseBrandingFromMd(content: string): BrandingData {
  const get = (key: string) => {
    const m = content.match(new RegExp(`<!-- ${key}: (.*?) -->`, "s"));
    return m ? m[1].trim() : "";
  };
  return {
    toneOfVoice: get("toneOfVoice"),
    messagingPillars: get("messagingPillars"),
    tagline: get("tagline"),
    languageTheyUse: get("languageTheyUse"),
    primaryColorName: get("primaryColorName"),
    primaryColorHex: get("primaryColorHex"),
    secondaryColors: get("secondaryColors"),
    accentColor: get("accentColor"),
    primaryFont: get("primaryFont") || get("typography"),
    secondaryFont: get("secondaryFont"),
    logoUrl: get("logoUrl"),
    vibeAesthetic: get("vibeAesthetic"),
    brandValues: get("brandValues"),
    whatSheStandsFor: get("whatSheStandsFor"),
    whatSheAvoids: get("whatSheAvoids"),
  };
}

function serializeBrandingToMd(data: BrandingData): string {
  return `# Branding

<!-- toneOfVoice: ${data.toneOfVoice} -->
<!-- messagingPillars: ${data.messagingPillars} -->
<!-- tagline: ${data.tagline} -->
<!-- languageTheyUse: ${data.languageTheyUse} -->
<!-- primaryColorName: ${data.primaryColorName} -->
<!-- primaryColorHex: ${data.primaryColorHex} -->
<!-- secondaryColors: ${data.secondaryColors} -->
<!-- accentColor: ${data.accentColor} -->
<!-- primaryFont: ${data.primaryFont} -->
<!-- secondaryFont: ${data.secondaryFont} -->
<!-- logoUrl: ${data.logoUrl} -->
<!-- vibeAesthetic: ${data.vibeAesthetic} -->
<!-- brandValues: ${data.brandValues} -->
<!-- whatSheStandsFor: ${data.whatSheStandsFor} -->
<!-- whatSheAvoids: ${data.whatSheAvoids} -->

## Copy & Voice

**Tone of Voice:** ${data.toneOfVoice}

**Tagline / Positioning Statement:** ${data.tagline}

**Key Messaging Pillars:**
${data.messagingPillars}

**Language They Use:**
${data.languageTheyUse}

## Visual Identity

**Primary Color:** ${data.primaryColorName} ${data.primaryColorHex}
**Secondary Colors:** ${data.secondaryColors}
**Accent Color:** ${data.accentColor}
**Primary Font:** ${data.primaryFont}
**Secondary Font:** ${data.secondaryFont}
**Logo:** ${data.logoUrl}

**Vibe / Aesthetic:**
${data.vibeAesthetic}

## Brand Personality

**Brand Values:**
${data.brandValues}

**What She Stands For:**
${data.whatSheStandsFor}

**What She Avoids:**
${data.whatSheAvoids}
`;
}

interface BrandingTabProps {
  slug: string;
}

function BrandingTab({ slug }: BrandingTabProps) {
  const [data, setData] = useState<BrandingData>(DEFAULT_BRANDING);
  const [editData, setEditData] = useState<BrandingData>(DEFAULT_BRANDING);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [messagingContent, setMessagingContent] = useState<string | null>(null);
  const [showMessaging, setShowMessaging] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/clients/${slug}/doc?file=BRANDING.md`);
        if (res.ok) {
          const result = await res.json() as { content: string };
          const parsed = parseBrandingFromMd(result.content);
          setData(parsed);
          setEditData(parsed);
        }
      } catch {
        // use defaults
      } finally {
        setLoading(false);
      }
      // Also fetch MESSAGING.md for the full document toggle
      try {
        const msgRes = await fetch(`/api/clients/${slug}/doc?file=MESSAGING.md`);
        if (msgRes.ok) {
          const msgResult = await msgRes.json() as { content: string };
          setMessagingContent(msgResult.content);
        }
      } catch {
        // ignore
      }
    })();
  }, [slug]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const content = serializeBrandingToMd(editData);
      const res = await fetch(`/api/clients/${slug}/doc?file=BRANDING.md`, {
        method: "PUT",
        body: content,
      });
      if (!res.ok) throw new Error("Failed to save");
      const result = await res.json() as { savedAt: string };
      setData(editData);
      setLastSaved(result.savedAt);
      setEditing(false);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    overflow: "hidden",
    marginBottom: "12px",
  };

  const sectionHeaderStyle = (open: boolean): React.CSSProperties => ({
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "14px 18px",
    border: "none",
    backgroundColor: "transparent",
    cursor: "pointer",
    textAlign: "left",
    borderBottom: open ? "1px solid var(--border)" : "none",
  });

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: "7px",
    border: "1px solid var(--border-strong)",
    backgroundColor: "var(--bg)",
    color: "var(--text-primary)",
    fontSize: "13px",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "var(--font-body)",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: 700,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: "5px",
    display: "block",
  };

  const viewFieldStyle: React.CSSProperties = {
    fontSize: "13px",
    color: "var(--text-primary)",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  };

  const field = (key: keyof BrandingData, label: string, multiline = false, rows = 3) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <label style={labelStyle}>{label}</label>
      {editing ? (
        multiline ? (
          <textarea
            value={editData[key]}
            onChange={(e) => setEditData((prev) => ({ ...prev, [key]: e.target.value }))}
            rows={rows}
            style={{ ...fieldStyle, resize: "vertical", lineHeight: 1.6 }}
          />
        ) : (
          <input
            type="text"
            value={editData[key]}
            onChange={(e) => setEditData((prev) => ({ ...prev, [key]: e.target.value }))}
            style={fieldStyle}
          />
        )
      ) : (
        <span style={viewFieldStyle}>{data[key] || <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Not set</span>}</span>
      )}
    </div>
  );

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
        <Loader2 style={{ width: "28px", height: "28px", color: "var(--accent)", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  // Visual Identity helpers
  const isValidHex = (hex: string): boolean => /^#[0-9A-Fa-f]{6}$/.test(hex.trim());
  const parseSecondaryColors = (input: string): string[] =>
    input.split(",").map((s) => s.trim()).filter(Boolean);
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setEditData((prev) => ({ ...prev, logoUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const sections: Array<{ id: string; title: string; content: React.ReactNode }> = [
    {
      id: "personality",
      title: "Brand Personality",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "18px" }}>
          {field("brandValues", "Brand Values", true, 4)}
          {field("whatSheStandsFor", "What She Stands For", true, 3)}
          {field("whatSheAvoids", "What She Avoids", true, 3)}
        </div>
      ),
    },
    {
      id: "copy",
      title: "Copy & Voice",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "18px" }}>
          {field("toneOfVoice", "Tone of Voice")}
          {field("messagingPillars", "Key Messaging Pillars", true, 4)}
          {field("tagline", "Tagline / Positioning Statement")}
          {field("languageTheyUse", "Language They Use", true, 3)}
        </div>
      ),
    },
    {
      id: "visual",
      title: "Visual Identity",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", padding: "18px" }}>

          {/* ── 1. Primary Color ── */}
          <div>
            <label style={labelStyle}>Primary Color</label>
            {editing ? (
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input
                  type="text"
                  value={editData.primaryColorName}
                  onChange={(e) => setEditData((prev) => ({ ...prev, primaryColorName: e.target.value }))}
                  placeholder="Name (e.g. Brand Blue)"
                  style={{ ...fieldStyle, flex: 1 }}
                />
                <input
                  type="text"
                  value={editData.primaryColorHex}
                  onChange={(e) => setEditData((prev) => ({ ...prev, primaryColorHex: e.target.value }))}
                  placeholder="#007ACC"
                  style={{ ...fieldStyle, flex: 1 }}
                />
                <div style={{
                  width: "36px", height: "36px", borderRadius: "8px", flexShrink: 0,
                  backgroundColor: isValidHex(editData.primaryColorHex) ? editData.primaryColorHex : "#888888",
                  border: "1px solid var(--border-strong)",
                }} />
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {(data.primaryColorHex || data.primaryColorName) ? (
                  <>
                    <div style={{
                      width: "28px", height: "28px", borderRadius: "6px", flexShrink: 0,
                      backgroundColor: isValidHex(data.primaryColorHex) ? data.primaryColorHex : "#888888",
                      border: "1px solid var(--border-strong)",
                    }} />
                    <span style={viewFieldStyle}>
                      {data.primaryColorName && <strong>{data.primaryColorName}</strong>}
                      {data.primaryColorName && data.primaryColorHex && " — "}
                      {data.primaryColorHex && <span style={{ fontFamily: "monospace" }}>{data.primaryColorHex}</span>}
                    </span>
                  </>
                ) : (
                  <span style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: "13px" }}>Not set</span>
                )}
              </div>
            )}
          </div>

          {/* ── 2. Secondary Colors ── */}
          <div>
            <label style={labelStyle}>Secondary Colors</label>
            {editing && (
              <textarea
                value={editData.secondaryColors}
                onChange={(e) => setEditData((prev) => ({ ...prev, secondaryColors: e.target.value }))}
                placeholder="#E8F4F8, #FF6B9D, #2D3748"
                rows={2}
                style={{ ...fieldStyle, resize: "vertical", lineHeight: 1.6, marginBottom: "10px" }}
              />
            )}
            {(() => {
              const src = editing ? editData.secondaryColors : data.secondaryColors;
              const colors = src ? parseSecondaryColors(src) : [];
              if (colors.length === 0) {
                return !editing ? <span style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: "13px" }}>Not set</span> : null;
              }
              return (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                  {colors.map((hex, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--bg)" }}>
                      <div style={{
                        width: "22px", height: "22px", borderRadius: "4px", flexShrink: 0,
                        backgroundColor: isValidHex(hex) ? hex : "#888888",
                        border: "1px solid var(--border-strong)",
                      }} />
                      <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontFamily: "monospace" }}>{hex}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* ── 3. Accent Color ── */}
          <div>
            <label style={labelStyle}>Accent Color</label>
            {editing ? (
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input
                  type="text"
                  value={editData.accentColor}
                  onChange={(e) => setEditData((prev) => ({ ...prev, accentColor: e.target.value }))}
                  placeholder="#FF6B9D"
                  style={{ ...fieldStyle, flex: 1 }}
                />
                <div style={{
                  width: "36px", height: "36px", borderRadius: "8px", flexShrink: 0,
                  backgroundColor: isValidHex(editData.accentColor) ? editData.accentColor : "#888888",
                  border: "1px solid var(--border-strong)",
                }} />
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {data.accentColor ? (
                  <>
                    <div style={{
                      width: "28px", height: "28px", borderRadius: "6px", flexShrink: 0,
                      backgroundColor: isValidHex(data.accentColor) ? data.accentColor : "#888888",
                      border: "1px solid var(--border-strong)",
                    }} />
                    <span style={{ ...viewFieldStyle, fontFamily: "monospace" }}>{data.accentColor}</span>
                  </>
                ) : (
                  <span style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: "13px" }}>Not set</span>
                )}
              </div>
            )}
          </div>

          {/* ── 4. Typography ── */}
          <div>
            <label style={labelStyle}>Fonts / Typography</label>
            {/* Primary Font */}
            <div style={{ marginBottom: "12px" }}>
              <label style={{ ...labelStyle, fontSize: "10px", marginBottom: "4px" }}>Primary Font</label>
              {editing ? (
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <input
                    type="text"
                    value={editData.primaryFont}
                    onChange={(e) => setEditData((prev) => ({ ...prev, primaryFont: e.target.value }))}
                    placeholder="e.g. Helvetica Neue, Inter, Georgia"
                    style={{ ...fieldStyle, flex: "0 0 220px" }}
                  />
                  {editData.primaryFont && (
                    <div style={{
                      flex: 1, padding: "8px 12px", borderRadius: "7px",
                      border: "1px solid var(--border)", backgroundColor: "var(--bg)",
                      fontFamily: editData.primaryFont, fontSize: "15px",
                      color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden",
                    }}>
                      Aa Bb Cc Dd Ee 1234
                    </div>
                  )}
                </div>
              ) : data.primaryFont ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span style={viewFieldStyle}>{data.primaryFont}</span>
                  <div style={{
                    padding: "8px 12px", borderRadius: "7px",
                    border: "1px solid var(--border)", backgroundColor: "var(--bg)",
                    fontFamily: data.primaryFont, fontSize: "15px",
                    color: "var(--text-primary)",
                  }}>
                    Aa Bb Cc Dd Ee 1234
                  </div>
                </div>
              ) : (
                <span style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: "13px" }}>Not set</span>
              )}
            </div>
            {/* Secondary Font */}
            <div>
              <label style={{ ...labelStyle, fontSize: "10px", marginBottom: "4px" }}>Secondary Font</label>
              {editing ? (
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <input
                    type="text"
                    value={editData.secondaryFont}
                    onChange={(e) => setEditData((prev) => ({ ...prev, secondaryFont: e.target.value }))}
                    placeholder="e.g. Georgia, Merriweather, Playfair Display"
                    style={{ ...fieldStyle, flex: "0 0 220px" }}
                  />
                  {editData.secondaryFont && (
                    <div style={{
                      flex: 1, padding: "8px 12px", borderRadius: "7px",
                      border: "1px solid var(--border)", backgroundColor: "var(--bg)",
                      fontFamily: editData.secondaryFont, fontSize: "15px",
                      color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden",
                    }}>
                      Aa Bb Cc Dd Ee 1234
                    </div>
                  )}
                </div>
              ) : data.secondaryFont ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span style={viewFieldStyle}>{data.secondaryFont}</span>
                  <div style={{
                    padding: "8px 12px", borderRadius: "7px",
                    border: "1px solid var(--border)", backgroundColor: "var(--bg)",
                    fontFamily: data.secondaryFont, fontSize: "15px",
                    color: "var(--text-primary)",
                  }}>
                    Aa Bb Cc Dd Ee 1234
                  </div>
                </div>
              ) : (
                <span style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: "13px" }}>Not set</span>
              )}
            </div>
          </div>

          {/* ── 5. Logo ── */}
          <div>
            <label style={labelStyle}>Logo</label>
            {editing && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "10px" }}>
                <input
                  type="text"
                  value={editData.logoUrl.startsWith("data:") ? "" : editData.logoUrl}
                  onChange={(e) => setEditData((prev) => ({ ...prev, logoUrl: e.target.value }))}
                  placeholder="Paste logo URL (https://...)"
                  style={fieldStyle}
                />
                <label style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  cursor: "pointer", padding: "6px 12px", borderRadius: "7px",
                  border: "1px solid var(--border-strong)", backgroundColor: "var(--bg)",
                  fontSize: "13px", color: "var(--text-secondary)", width: "fit-content",
                }}>
                  <Upload style={{ width: "14px", height: "14px" }} />
                  Upload file
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogoUpload} />
                </label>
              </div>
            )}
            {(() => {
              const src = editing ? editData.logoUrl : data.logoUrl;
              return src ? (
                <div style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--border)", backgroundColor: "var(--bg)", display: "inline-block" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="Brand logo" style={{ maxWidth: "200px", maxHeight: "120px", display: "block", objectFit: "contain" }} />
                </div>
              ) : (
                <div style={{
                  padding: "24px", borderRadius: "8px",
                  border: "1px dashed var(--border-strong)", backgroundColor: "var(--bg)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--text-muted)", fontStyle: "italic", fontSize: "13px",
                }}>
                  No logo uploaded
                </div>
              );
            })()}
          </div>

          {/* ── 6. Vibe / Aesthetic — keep as-is ── */}
          {field("vibeAesthetic", "Vibe / Aesthetic", true, 2)}

        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Header + toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-heading)", margin: "0 0 4px" }}>Branding</h3>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>Brand voice, visual identity, and personality.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {lastSaved && <span style={{ fontSize: "12px", color: "var(--positive)" }}>✓ Saved {new Date(lastSaved).toLocaleTimeString()}</span>}
          {editing ? (
            <>
              <button
                onClick={() => { setEditing(false); setEditData({ ...data }); }}
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "8px", border: "1px solid var(--border-strong)", backgroundColor: "transparent", color: "var(--text-secondary)", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
              >
                <X style={{ width: "13px", height: "13px" }} /> Cancel
              </button>
              <button
                onClick={() => { void handleSave(); }}
                disabled={saving}
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "8px", border: "none", backgroundColor: "var(--accent)", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
              >
                {saving ? <Loader2 style={{ width: "13px", height: "13px", animation: "spin 1s linear infinite" }} /> : <Save style={{ width: "13px", height: "13px" }} />}
                Save
              </button>
            </>
          ) : (
            <button
              onClick={() => { setEditData({ ...data }); setEditing(true); }}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "8px", border: "1px solid var(--border-strong)", backgroundColor: "var(--surface)", color: "var(--text-secondary)", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
            >
              <Edit3 style={{ width: "13px", height: "13px" }} /> Edit Branding
            </button>
          )}
        </div>
      </div>

      {/* Collapsible section cards */}
      {sections.map((section) => {
        const isOpen = openSections.has(section.id);
        return (
          <div key={section.id} style={cardStyle}>
            <button onClick={() => toggleSection(section.id)} style={sectionHeaderStyle(isOpen)}>
              <span style={{ fontSize: "10px", color: isOpen ? "var(--accent)" : "var(--text-muted)", display: "inline-block", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 150ms ease", flexShrink: 0 }}>▶</span>
              <span style={{ fontSize: "14px", fontWeight: 700, color: isOpen ? "var(--accent)" : "var(--text-primary)", fontFamily: "var(--font-heading)" }}>
                {section.title}
              </span>
            </button>
            {isOpen && section.content}
          </div>
        );
      })}

      {/* Full Brand Messaging Document toggle */}
      <div style={cardStyle}>
        <button
          onClick={() => setShowMessaging((v) => !v)}
          style={sectionHeaderStyle(showMessaging)}
        >
          <span style={{ fontSize: "10px", color: showMessaging ? "var(--accent)" : "var(--text-muted)", display: "inline-block", transform: showMessaging ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 150ms ease", flexShrink: 0 }}>▶</span>
          <span style={{ fontSize: "14px", fontWeight: 700, color: showMessaging ? "var(--accent)" : "var(--text-primary)", fontFamily: "var(--font-heading)" }}>
            Full Brand Messaging Document
          </span>
          <span style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic", marginLeft: "8px" }}>
            complete MESSAGING.md — use for Claude, ChatGPT, or reference
          </span>
        </button>
        {showMessaging && (
          <div style={{ padding: "20px 24px" }}>
            {messagingContent ? (
              <pre style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: "13px", lineHeight: 1.75, color: "var(--text-secondary)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {messagingContent}
              </pre>
            ) : (
              <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)", fontStyle: "italic" }}>
                No messaging document found (MESSAGING.md).
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Phase 4: Doc Section (inline editor for Deliverables tab) ────────────────

// ─── DocSectionBody — Overview + Full Document toggles ───────────────────────

function DocSectionBody({ content, overviewContent }: { content: string; overviewContent?: string | null }) {
  const [showOverview, setShowOverview] = useState(false);
  const [showFull, setShowFull] = useState(false);

  const innerToggleStyle = (open: boolean): React.CSSProperties => ({
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 20px",
    background: open ? "var(--accent-soft)" : "none",
    border: "none",
    borderTop: "1px solid var(--border)",
    cursor: "pointer",
    textAlign: "left",
  });

  const chevron = (open: boolean) => (
    <span style={{
      fontSize: "10px",
      color: open ? "var(--accent)" : "var(--text-muted)",
      display: "inline-block",
      transform: open ? "rotate(90deg)" : "rotate(0deg)",
      transition: "transform 150ms ease",
      flexShrink: 0,
    }}>▶</span>
  );

  return (
    <div>
      {/* ── Overview toggle (only shown when _OVERVIEW.md exists) ── */}
      {overviewContent && (
        <>
          <button onClick={() => setShowOverview((v) => !v)} style={innerToggleStyle(showOverview)}>
            {chevron(showOverview)}
            <span style={{ fontSize: "13px", fontWeight: 600, color: showOverview ? "var(--accent)" : "var(--text-secondary)", flexShrink: 0 }}>
              Quick Summary
            </span>
            <span style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              fontStyle: "italic",
              marginLeft: "8px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
              flex: 1,
            }}>
              AI-generated snapshot — does not contain the full document
            </span>
          </button>
          {showOverview && (
            <div style={{ padding: "20px 24px" }}>
              <pre style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: "13px", lineHeight: 1.75, color: "var(--text-secondary)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {overviewContent}
              </pre>
            </div>
          )}
        </>
      )}

      {/* ── Full Document toggle ── */}
      <button onClick={() => setShowFull((v) => !v)} style={innerToggleStyle(showFull)}>
        {chevron(showFull)}
        <span style={{ fontSize: "13px", fontWeight: 600, color: showFull ? "var(--accent)" : "var(--text-secondary)", flexShrink: 0 }}>
          Full Document
        </span>
        <span style={{
          fontSize: "11px",
          color: "var(--text-muted)",
          fontStyle: "italic",
          marginLeft: "8px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          minWidth: 0,
          flex: 1,
        }}>
          complete .md file — use for Claude, ChatGPT, or sharing with client
        </span>
      </button>
      {showFull && (
        <div style={{ padding: "20px 24px" }}>
          <pre style={{
            margin: 0,
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            lineHeight: 1.75,
            color: "var(--text-secondary)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}>
            {content}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── DocSection ───────────────────────────────────────────────────────────────

interface DocSectionProps {
  slug: string;
  file: string;
  title: string;
  description: string;
  shouldOpen?: boolean;
}

function DocSection({ slug, file, title, description, shouldOpen }: DocSectionProps) {
  const [content, setContent] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [overviewContent, setOverviewContent] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Auto-open and scroll when navigated from Phase Board
  useEffect(() => {
    if (shouldOpen) {
      setIsOpen(true);
      setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [shouldOpen]);

  const fetchContent = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const res = await fetch(`/api/clients/${slug}/doc?file=${encodeURIComponent(file)}`);
      if (res.status === 404) {
        setNotFound(true);
        setContent(null);
      } else if (!res.ok) {
        throw new Error("Failed to load");
      } else {
        const data = await res.json() as { content: string };
        setContent(data.content);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
    // Silently try to load the _OVERVIEW.md companion file
    const overviewFile = file.replace(/\.md$/i, "_OVERVIEW.md");
    try {
      const ovRes = await fetch(`/api/clients/${slug}/doc?file=${encodeURIComponent(overviewFile)}`);
      if (ovRes.ok) {
        const ovData = await ovRes.json() as { content: string };
        setOverviewContent(ovData.content);
      } else {
        setOverviewContent(null);
      }
    } catch {
      setOverviewContent(null);
    }
  }, [slug, file]);

  useEffect(() => {
    void fetchContent();
  }, [fetchContent]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${slug}/doc?file=${encodeURIComponent(file)}`, {
        method: "PUT",
        body: editContent,
      });
      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json() as { savedAt: string };
      setContent(editContent);
      setLastSaved(data.savedAt);
      setEditing(false);
      setNotFound(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    // Reset input so same file can be re-uploaded
    e.target.value = "";

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("targetFile", file);

      const res = await fetch(`/api/clients/${slug}/doc-upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json() as { success?: boolean; error?: string; overviewError?: string };

      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Upload failed");
      }

      // Refresh card content
      await fetchContent();
      setIsOpen(true);

      // Brief success state
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 2000);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      ref={cardRef}
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        overflow: "hidden",
        marginBottom: "16px",
      }}
    >
      {/* Card header — click anywhere to toggle */}
      <div
        onClick={() => { if (!editing) setIsOpen((v) => !v); }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: isOpen ? "1px solid var(--border)" : "none",
          gap: "12px",
          cursor: editing ? "default" : "pointer",
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}>
          <span style={{ color: "var(--text-muted)", fontSize: "13px", transition: "transform 150ms ease", display: "inline-block", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", flexShrink: 0 }}>▶</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-heading)", marginBottom: "3px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
              <span style={{ flexShrink: 0, fontSize: "14px" }} title={!loading && !notFound && (content?.trim().length ?? 0) > 0 ? "Has content" : "Empty"}>
                {!loading && (!notFound && (content?.trim().length ?? 0) > 0 ? "✅" : "⚠️")}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
              <span style={{ fontSize: "12px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: "0 1 auto" }}>{description}</span>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>· {file}</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
          {lastSaved && (
            <span style={{ fontSize: "11px", color: "var(--positive)" }}>✓ Saved</span>
          )}
          {!editing && content && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const blob = new Blob([content], { type: "text/markdown" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = file;
                a.click();
                URL.revokeObjectURL(url);
              }}
              title="Download full document as .md file"
              style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: "7px", border: "1px solid var(--border-strong)", backgroundColor: "transparent", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
            >
              ⬇ Download Full .md
            </button>
          )}
          {editing ? (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setEditing(false); setEditContent(""); }}
                style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: "7px", border: "1px solid var(--border-strong)", backgroundColor: "transparent", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
              >
                <X style={{ width: "12px", height: "12px" }} /> Cancel
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); void handleSave(); }}
                disabled={saving}
                style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: "7px", border: "none", backgroundColor: "var(--accent)", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
              >
                {saving ? <Loader2 style={{ width: "12px", height: "12px", animation: "spin 1s linear infinite" }} /> : <Save style={{ width: "12px", height: "12px" }} />}
                Save
              </button>
            </>
          ) : (
            <>
              {/* Hidden file input for upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.txt,.docx"
                style={{ display: "none" }}
                onChange={(e) => { void handleUploadFile(e); }}
              />
              {/* Upload button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                disabled={uploading}
                title="Upload a .md, .txt, or .docx file to replace this doc"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "6px 12px",
                  borderRadius: "7px",
                  border: "1px solid var(--border-strong)",
                  backgroundColor: uploadSuccess ? "rgba(16,185,129,0.1)" : "transparent",
                  color: uploadSuccess ? "#10B981" : uploading ? "var(--text-muted)" : "var(--text-secondary)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: uploading ? "not-allowed" : "pointer",
                  flexShrink: 0,
                  opacity: uploading ? 0.7 : 1,
                  transition: "all 200ms ease",
                }}
              >
                {uploading ? (
                  <>
                    <Loader2 style={{ width: "12px", height: "12px", animation: "spin 1s linear infinite" }} />
                    Uploading...
                  </>
                ) : uploadSuccess ? (
                  <>✓ Uploaded</>
                ) : (
                  <>↑ Upload</>
                )}
              </button>
              {/* Edit button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditContent(content ?? "");
                  setEditing(true);
                  setIsOpen(true);
                }}
                style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: "7px", border: "1px solid var(--border-strong)", backgroundColor: "transparent", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
              >
                <Edit3 style={{ width: "12px", height: "12px" }} /> Edit
              </button>
            </>
          )}
        </div>
      </div>

      {/* Upload error banner */}
      {uploadError && (
        <div style={{ padding: "10px 20px", backgroundColor: "var(--negative-soft)", color: "var(--negative)", fontSize: "12px", borderTop: "1px solid var(--border)" }}>
          ⚠ Upload error: {uploadError}
          <button
            onClick={() => setUploadError(null)}
            style={{ marginLeft: "8px", background: "none", border: "none", cursor: "pointer", color: "var(--negative)", fontWeight: 700, fontSize: "12px" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Card body — only renders when open */}
      {isOpen && (
        <div style={{ padding: "0" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "32px" }}>
              <Loader2 style={{ width: "20px", height: "20px", color: "var(--accent)", animation: "spin 1s linear infinite" }} />
            </div>
          ) : error ? (
            <div style={{ padding: "16px 20px", color: "var(--negative)", fontSize: "13px" }}>{error}</div>
          ) : editing ? (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder={notFound ? `Start writing ${title}...` : undefined}
              rows={16}
              style={{ width: "100%", padding: "20px", border: "none", outline: "none", resize: "vertical", fontFamily: "var(--font-mono)", fontSize: "13px", lineHeight: 1.7, backgroundColor: "var(--bg)", color: "var(--text-primary)", boxSizing: "border-box", minHeight: "300px" }}
            />
          ) : notFound ? (
            <div style={{ padding: "32px 20px", textAlign: "center" }}>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>No content yet. Use the Upload button above to add a file.</p>
            </div>
          ) : (
            <DocSectionBody content={content ?? ""} overviewContent={overviewContent} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Phase 4: Deliverables Tab ────────────────────────────────────────────────

interface DeliverablesTabProps {
  slug: string;
  scrollToDoc?: string;
}

function PhaseHeader({ label }: { label: string }) {
  return (
    <div style={{ margin: "28px 0 10px", paddingTop: "18px", borderTop: "1px solid var(--border)" }}>
      <span style={{ fontSize: "12px", fontWeight: 400, color: "#666", letterSpacing: "0.02em" }}>
        {label}
      </span>
    </div>
  );
}

function DeliverablesTab({ slug, scrollToDoc }: DeliverablesTabProps) {
  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "8px" }}>
        <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-heading)", margin: "0 0 4px" }}>
          Client Docs
        </h3>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
          Documents generated through the program. Click any card to expand.
        </p>
      </div>

      {/* ── Phase 1 ── */}
      <PhaseHeader label="Phase 1" />
      <DocSection
        slug={slug}
        file="CORE_CALLING.md"
        title="Core Calling Super Prompt"
        description="The foundational super prompt built from the client's calling clues."
        shouldOpen={scrollToDoc === "CORE_CALLING.md"}
      />

      {/* ── Phase 2 ── */}
      <PhaseHeader label="Phase 2" />
      <DocSection
        slug={slug}
        file="AUDIENCE_EXTRACTOR.md"
        title="Audience Extractor"
        description="GPT instructions and context for extracting ideal audience from Core Calling."
        shouldOpen={scrollToDoc === "AUDIENCE_EXTRACTOR.md"}
      />
      <DocSection
        slug={slug}
        file="MATE_VALIDATION.md"
        title="MATE Validation Prompt"
        description="Prompt used to validate the MATE offer with the target audience."
        shouldOpen={scrollToDoc === "MATE_VALIDATION.md"}
      />

      {/* ── Phase 3 ── */}
      <PhaseHeader label="Phase 3" />
      <DocSection
        slug={slug}
        file="MATE_LANDING_PAGE.md"
        title="MATE Sales Page"
        description="Sales page copy for the MATE / low-ticket front-end offer."
        shouldOpen={scrollToDoc === "MATE_LANDING_PAGE.md"}
      />
      <DocSection
        slug={slug}
        file="COMMUNITY_UPSELL_LANDING_PAGE.md"
        title="Community Upsell Sales Page"
        description="Sales page copy for the MEE community upsell."
        shouldOpen={scrollToDoc === "COMMUNITY_UPSELL_LANDING_PAGE.md"}
      />
    </div>
  );
}

// ─── Coaching Calls Tab ───────────────────────────────────────────────────────

interface CoachingCallTodo {
  id: string;
  description: string;
  owner: "sarah" | "bobby" | "client";
  completed: boolean;
  taskBoardId?: string;
}

interface CoachingCallData {
  id: string;
  date: string;
  videoUrl: string;
  overview: string;
  ahas: string[];
  decisions: string[];
  openLoops: string[];
  todos: CoachingCallTodo[];
  parkedIdeas: string[];
  followUpNotes: string;
  transcriptFile: string;
  analyzed: boolean;
}

interface CoachingCallsTabProps {
  slug: string;
  legacyTranscripts: string[]; // existing unanalyzed .md files from transcripts/ dir
}

function CoachingCallsTab({ slug, legacyTranscripts }: CoachingCallsTabProps) {
  const [calls, setCalls] = useState<CoachingCallData[]>([]);
  const [loadingCalls, setLoadingCalls] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedTranscriptId, setExpandedTranscriptId] = useState<string | null>(null);
  const [transcriptContents, setTranscriptContents] = useState<Record<string, string>>({});
  const [transcriptLoading, setTranscriptLoading] = useState<Record<string, boolean>>({});
  const [showUpload, setShowUpload] = useState(false);
  const [analyzingLegacy, setAnalyzingLegacy] = useState<string | null>(null);
  const [savingTodo, setSavingTodo] = useState<string | null>(null);

  const fetchCalls = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${slug}/calls`);
      if (!res.ok) return;
      const data = await res.json() as { calls: CoachingCallData[] };
      setCalls(data.calls ?? []);
    } catch {
      // ignore
    } finally {
      setLoadingCalls(false);
    }
  }, [slug]);

  useEffect(() => { void fetchCalls(); }, [fetchCalls]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const toggleTranscript = async (call: CoachingCallData) => {
    const key = call.id;
    if (expandedTranscriptId === key) {
      setExpandedTranscriptId(null);
      return;
    }
    setExpandedTranscriptId(key);
    if (transcriptContents[key]) return; // already loaded
    setTranscriptLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const filePath = encodeURIComponent(`calls/${call.transcriptFile}`);
      const res = await fetch(`/api/clients/${slug}/doc?file=${filePath}`);
      const data = await res.json() as { content: string };
      setTranscriptContents((prev) => ({ ...prev, [key]: data.content ?? "" }));
    } catch {
      setTranscriptContents((prev) => ({ ...prev, [key]: "Failed to load transcript." }));
    } finally {
      setTranscriptLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const toggleLegacyTranscript = async (filename: string) => {
    const key = `legacy:${filename}`;
    if (expandedTranscriptId === key) {
      setExpandedTranscriptId(null);
      return;
    }
    setExpandedTranscriptId(key);
    if (transcriptContents[key]) return;
    setTranscriptLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const filePath = encodeURIComponent(`transcripts/${filename}`);
      const res = await fetch(`/api/clients/${slug}/doc?file=${filePath}`);
      const data = await res.json() as { content: string };
      setTranscriptContents((prev) => ({ ...prev, [key]: data.content ?? "" }));
    } catch {
      setTranscriptContents((prev) => ({ ...prev, [key]: "Failed to load transcript." }));
    } finally {
      setTranscriptLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleAnalyzeLegacy = async (filename: string) => {
    setAnalyzingLegacy(filename);
    try {
      // Fetch the transcript content
      const filePath = encodeURIComponent(`transcripts/${filename}`);
      const res = await fetch(`/api/clients/${slug}/doc?file=${filePath}`);
      const data = await res.json() as { content: string };
      const content = data.content ?? "";

      // Upload as a new call via calls API
      const dateStr = filename.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? new Date().toISOString().slice(0, 10);
      const blob = new Blob([content], { type: "text/plain" });
      const file = new File([blob], filename.endsWith(".md") ? filename : `${filename}.md`, { type: "text/markdown" });
      const form = new FormData();
      form.append("file", file);
      form.append("date", dateStr);

      const uploadRes = await fetch(`/api/clients/${slug}/calls`, { method: "POST", body: form });
      if (uploadRes.ok) {
        await fetchCalls();
      }
    } catch {
      // ignore
    } finally {
      setAnalyzingLegacy(null);
    }
  };

  const updateTodo = async (callId: string, todoIdx: number, patch: Partial<CoachingCallTodo>) => {
    setSavingTodo(`${callId}-${todoIdx}`);
    try {
      const call = calls.find((c) => c.id === callId);
      if (!call) return;
      const updatedTodos = call.todos.map((t, i) => i === todoIdx ? { ...t, ...patch } : t);
      const res = await fetch(`/api/clients/${slug}/calls`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId, updates: { todos: updatedTodos } }),
      });
      if (res.ok) {
        const result = await res.json() as { call: CoachingCallData };
        setCalls((prev) => prev.map((c) => c.id === callId ? result.call : c));
      }
    } catch {
      // ignore
    } finally {
      setSavingTodo(null);
    }
  };

  const ownerLabel = (owner: string) => {
    if (owner === "sarah") return "Sarah";
    if (owner === "bobby") return "Bobby";
    if (owner === "client") return "Client";
    return owner;
  };

  const ownerColor = (owner: string) => {
    if (owner === "sarah") return "var(--accent)";
    if (owner === "bobby") return "#10b981";
    return "#f59e0b";
  };

  // Calls from the new calls/ directory
  const structuredCalls = calls;

  // Legacy transcripts that haven't been migrated to calls/ yet
  const analyzedCallIds = new Set(calls.map((c) => c.transcriptFile?.replace("CALL_", "").replace("_TRANSCRIPT.md", "").replace(/_/g, "-")));
  const unarchivedLegacy = legacyTranscripts.filter((f) => {
    const dateStr = f.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
    return !dateStr || !analyzedCallIds.has(dateStr);
  });

  const hasAnything = structuredCalls.length > 0 || unarchivedLegacy.length > 0;

  const sectionTitle: React.CSSProperties = { fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" };
  const bullet: React.CSSProperties = { fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6, paddingLeft: "4px" };
  const sectionBox: React.CSSProperties = { backgroundColor: "var(--bg)", borderRadius: "10px", padding: "14px 16px", marginBottom: "12px" };

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>Coaching Calls</h3>
        <button
          onClick={() => setShowUpload(true)}
          style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", borderRadius: "8px", border: "none", backgroundColor: "var(--accent)", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
        >
          <Upload style={{ width: "14px", height: "14px" }} />
          ↑ Upload Call
        </button>
      </div>

      {/* Loading */}
      {loadingCalls && (
        <div style={{ display: "flex", justifyContent: "center", padding: "48px" }}>
          <Loader2 style={{ width: "24px", height: "24px", color: "var(--accent)", animation: "spin 1s linear infinite" }} />
        </div>
      )}

      {/* Empty state */}
      {!loadingCalls && !hasAnything && (
        <div style={{ textAlign: "center", padding: "60px 24px", backgroundColor: "var(--surface)", border: "2px dashed var(--border)", borderRadius: "12px" }}>
          <FileText style={{ width: "36px", height: "36px", color: "var(--text-muted)", margin: "0 auto 12px" }} />
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", fontWeight: 600 }}>No coaching calls yet.</p>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "6px" }}>Upload a transcript (.md, .txt, or .docx) to get started.</p>
        </div>
      )}

      {/* Structured calls */}
      {!loadingCalls && structuredCalls.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
          {structuredCalls.map((call) => {
            const isExpanded = expandedId === call.id;
            const isTranscriptOpen = expandedTranscriptId === call.id;
            const dateLabel = formatDate(call.date);

            return (
              <div
                key={call.id}
                style={{
                  borderRadius: "14px",
                  border: `1px solid ${isExpanded ? "var(--accent)" : "var(--border)"}`,
                  overflow: "hidden",
                  backgroundColor: "var(--surface)",
                  transition: "border-color 150ms",
                }}
              >
                {/* Call Header */}
                <div
                  style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px 20px", cursor: "pointer" }}
                  onClick={() => toggleExpand(call.id)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>
                        📞 {dateLabel}
                      </span>
                      {!call.analyzed && (
                        <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "10px", backgroundColor: "var(--surface-elevated)", color: "var(--text-muted)" }}>
                          Unanalyzed
                        </span>
                      )}
                    </div>
                    {call.overview && (
                      <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "480px" }}>
                        {call.overview}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                    {call.videoUrl && (
                      <a
                        href={call.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", fontWeight: 600, color: "var(--accent)", textDecoration: "none", padding: "5px 10px", borderRadius: "8px", border: "1px solid var(--accent)", backgroundColor: "var(--accent-soft)" }}
                      >
                        🔗 Video
                      </a>
                    )}
                    <div style={{ color: "var(--text-muted)", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 150ms" }}>
                      <ChevronRight style={{ width: "18px", height: "18px" }} />
                    </div>
                  </div>
                </div>

                {/* Meeting Minutes (expanded) */}
                {isExpanded && (
                  <div style={{ borderTop: "1px solid var(--border)", padding: "20px", backgroundColor: "var(--bg)" }}>

                    {/* Overview */}
                    {call.overview && (
                      <div style={sectionBox}>
                        <div style={sectionTitle}>📋 Call Overview</div>
                        <p style={{ ...bullet, color: "var(--text-primary)" }}>{call.overview}</p>
                      </div>
                    )}

                    {/* Aha Moments */}
                    {call.ahas?.length > 0 && (
                      <div style={sectionBox}>
                        <div style={sectionTitle}>💡 Key Aha / Breakthrough Moments</div>
                        <ul style={{ margin: 0, paddingLeft: "18px" }}>
                          {call.ahas.map((aha, i) => (
                            <li key={i} style={bullet}>{aha}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Decisions Made */}
                    {call.decisions?.length > 0 && (
                      <div style={sectionBox}>
                        <div style={sectionTitle}>✅ Decisions Made</div>
                        <ul style={{ margin: 0, paddingLeft: "18px" }}>
                          {call.decisions.map((d, i) => (
                            <li key={i} style={bullet}>{d}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Open Loops */}
                    {call.openLoops?.length > 0 && (
                      <div style={sectionBox}>
                        <div style={sectionTitle}>🔄 Open Loops</div>
                        <ul style={{ margin: 0, paddingLeft: "18px" }}>
                          {call.openLoops.map((ol, i) => (
                            <li key={i} style={bullet}>{ol}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* To-Do List */}
                    {call.todos?.length > 0 && (
                      <div style={sectionBox}>
                        <div style={sectionTitle}>📝 To-Do List</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {call.todos.map((todo, idx) => {
                            const todoKey = `${call.id}-${idx}`;
                            const isSaving = savingTodo === todoKey;
                            return (
                              <div
                                key={todo.id ?? idx}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "10px",
                                  padding: "10px 12px",
                                  borderRadius: "8px",
                                  backgroundColor: todo.completed ? "var(--surface-elevated)" : "var(--surface)",
                                  border: "1px solid var(--border)",
                                  opacity: todo.completed ? 0.6 : 1,
                                }}
                              >
                                <button
                                  onClick={() => { void updateTodo(call.id, idx, { completed: !todo.completed }); }}
                                  style={{ background: "none", border: "none", cursor: "pointer", padding: "0", flexShrink: 0, color: todo.completed ? "var(--accent)" : "var(--border-strong)" }}
                                >
                                  {todo.completed
                                    ? <CheckCircle style={{ width: "16px", height: "16px" }} />
                                    : <Square style={{ width: "16px", height: "16px" }} />
                                  }
                                </button>
                                <span style={{ flex: 1, fontSize: "13px", color: "var(--text-primary)", textDecoration: todo.completed ? "line-through" : "none" }}>
                                  {todo.description}
                                </span>
                                <select
                                  value={todo.owner}
                                  onChange={(e) => { void updateTodo(call.id, idx, { owner: e.target.value as CoachingCallTodo["owner"] }); }}
                                  disabled={isSaving}
                                  style={{
                                    padding: "3px 8px",
                                    borderRadius: "6px",
                                    border: `1px solid ${ownerColor(todo.owner)}`,
                                    backgroundColor: "transparent",
                                    color: ownerColor(todo.owner),
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                  }}
                                >
                                  <option value="sarah">Sarah</option>
                                  <option value="bobby">Bobby</option>
                                  <option value="client">Client</option>
                                </select>
                                {isSaving && <Loader2 style={{ width: "12px", height: "12px", color: "var(--text-muted)", animation: "spin 1s linear infinite", flexShrink: 0 }} />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Parked Ideas */}
                    {call.parkedIdeas?.length > 0 && (
                      <div style={sectionBox}>
                        <div style={sectionTitle}>🅿️ Parked Ideas</div>
                        <ul style={{ margin: 0, paddingLeft: "18px" }}>
                          {call.parkedIdeas.map((idea, i) => (
                            <li key={i} style={bullet}>{idea}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Follow-up Notes */}
                    {call.followUpNotes && (
                      <div style={sectionBox}>
                        <div style={sectionTitle}>📅 Follow-up Notes</div>
                        <p style={bullet}>{call.followUpNotes}</p>
                      </div>
                    )}

                    {/* Full Transcript Toggle */}
                    {call.transcriptFile && (
                      <div style={{ marginTop: "8px" }}>
                        <button
                          onClick={() => { void toggleTranscript(call); }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "8px 14px",
                            borderRadius: "8px",
                            border: "1px solid var(--border-strong)",
                            backgroundColor: isTranscriptOpen ? "var(--accent-soft)" : "transparent",
                            color: isTranscriptOpen ? "var(--accent)" : "var(--text-secondary)",
                            fontSize: "13px",
                            fontWeight: 600,
                            cursor: "pointer",
                            width: "100%",
                            justifyContent: "space-between",
                          }}
                        >
                          <span>📄 Full Transcript</span>
                          {isTranscriptOpen
                            ? <ChevronUp style={{ width: "14px", height: "14px" }} />
                            : <ChevronDown style={{ width: "14px", height: "14px" }} />
                          }
                        </button>
                        {isTranscriptOpen && (
                          <div style={{ marginTop: "8px", borderRadius: "10px", border: "1px solid var(--border)", backgroundColor: "var(--surface)", overflow: "hidden" }}>
                            {transcriptLoading[call.id] ? (
                              <div style={{ display: "flex", justifyContent: "center", padding: "32px" }}>
                                <Loader2 style={{ width: "20px", height: "20px", color: "var(--accent)", animation: "spin 1s linear infinite" }} />
                              </div>
                            ) : (
                              <pre style={{
                                fontSize: "12px",
                                lineHeight: 1.7,
                                color: "var(--text-secondary)",
                                fontFamily: "var(--font-body)",
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                                margin: 0,
                                padding: "20px",
                                maxHeight: "500px",
                                overflow: "auto",
                              }}>
                                {transcriptContents[call.id] ?? ""}
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Legacy / Unanalyzed Transcripts */}
      {!loadingCalls && unarchivedLegacy.length > 0 && (
        <div style={{ marginBottom: "24px" }}>
          <div style={{ ...sectionTitle, marginBottom: "12px" }}>📁 Unanalyzed Transcripts</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {unarchivedLegacy.map((filename) => {
              const dateStr = transcriptDateFromFilename(filename);
              const label = transcriptLabel(filename) || filename.replace(/\.md$/, "");
              const legacyKey = `legacy:${filename}`;
              const isLegacyOpen = expandedTranscriptId === legacyKey;
              const isAnalyzing = analyzingLegacy === filename;

              return (
                <div key={filename} style={{ borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden", backgroundColor: "var(--surface)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px" }}>
                    <FileText style={{ width: "15px", height: "15px", color: "var(--text-muted)", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", textTransform: "capitalize" }}>{label}</div>
                      {dateStr && <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{dateStr}</div>}
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                      <button
                        onClick={() => { void toggleLegacyTranscript(filename); }}
                        style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 10px", borderRadius: "7px", border: "1px solid var(--border-strong)", backgroundColor: isLegacyOpen ? "var(--accent-soft)" : "transparent", color: isLegacyOpen ? "var(--accent)" : "var(--text-secondary)", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                      >
                        <Eye style={{ width: "12px", height: "12px" }} />
                        {isLegacyOpen ? "Hide" : "View"}
                      </button>
                      <button
                        onClick={() => { void handleAnalyzeLegacy(filename); }}
                        disabled={isAnalyzing}
                        style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 10px", borderRadius: "7px", border: "none", backgroundColor: "var(--accent)", color: "#fff", fontSize: "12px", fontWeight: 600, cursor: isAnalyzing ? "not-allowed" : "pointer", opacity: isAnalyzing ? 0.7 : 1 }}
                      >
                        {isAnalyzing
                          ? <Loader2 style={{ width: "12px", height: "12px", animation: "spin 1s linear infinite" }} />
                          : <CheckCircle style={{ width: "12px", height: "12px" }} />
                        }
                        {isAnalyzing ? "Analyzing..." : "Analyze"}
                      </button>
                    </div>
                  </div>
                  {isLegacyOpen && (
                    <div style={{ borderTop: "1px solid var(--border)", backgroundColor: "var(--bg)", maxHeight: "400px", overflow: "auto", padding: "16px" }}>
                      {transcriptLoading[legacyKey] ? (
                        <div style={{ display: "flex", justifyContent: "center", padding: "24px" }}>
                          <Loader2 style={{ width: "20px", height: "20px", color: "var(--accent)", animation: "spin 1s linear infinite" }} />
                        </div>
                      ) : (
                        <pre style={{ fontSize: "12px", lineHeight: 1.7, color: "var(--text-secondary)", fontFamily: "var(--font-body)", whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>
                          {transcriptContents[legacyKey] ?? ""}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <UploadCallModal
          slug={slug}
          onClose={() => setShowUpload(false)}
          onSuccess={() => { setShowUpload(false); void fetchCalls(); }}
        />
      )}
    </div>
  );
}

// ─── Upload Call Modal ────────────────────────────────────────────────────────

interface UploadCallModalProps {
  slug: string;
  onClose: () => void;
  onSuccess: () => void;
}

function UploadCallModal({ slug, onClose, onSuccess }: UploadCallModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [videoUrl, setVideoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);
    setProgress("Uploading & analyzing transcript...");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("date", date);
      if (videoUrl.trim()) form.append("videoUrl", videoUrl.trim());

      const res = await fetch(`/api/clients/${slug}/calls`, { method: "POST", body: form });
      const data = await res.json() as { success?: boolean; error?: string; analyzed?: boolean; aiError?: string };

      if (!res.ok) throw new Error(data.error ?? "Upload failed");

      if (data.aiError) {
        setProgress(`Saved! (AI analysis failed: ${data.aiError})`);
        await new Promise((r) => setTimeout(r, 1500));
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          padding: "32px",
          width: "100%",
          maxWidth: "560px",
          maxHeight: "85vh",
          overflow: "auto",
          boxShadow: "0 24px 64px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>Upload Coaching Call</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
            <X style={{ width: "20px", height: "20px" }} />
          </button>
        </div>

        <form onSubmit={(e) => { void handleSubmit(e); }} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* File picker */}
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
              Transcript File <span style={{ color: "var(--negative)" }}>*</span>
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${file ? "var(--accent)" : "var(--border-strong)"}`,
                borderRadius: "10px",
                padding: "20px",
                textAlign: "center",
                cursor: "pointer",
                backgroundColor: file ? "var(--accent-soft)" : "var(--bg)",
              }}
            >
              {file ? (
                <div style={{ fontSize: "13px", color: "var(--accent)", fontWeight: 600 }}>
                  📄 {file.name} ({Math.round(file.size / 1024)} KB)
                </div>
              ) : (
                <div>
                  <Upload style={{ width: "24px", height: "24px", color: "var(--text-muted)", margin: "0 auto 8px" }} />
                  <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Click to select .md, .txt, or .docx file</div>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.txt,.docx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              style={{ display: "none" }}
            />
          </div>

          {/* Date */}
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
              Call Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border-strong)", backgroundColor: "var(--bg)", color: "var(--text-primary)", fontSize: "14px", outline: "none", boxSizing: "border-box" }}
            />
          </div>

          {/* Video URL */}
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
              Video Link (Descript / Loom URL) <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>optional</span>
            </label>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://share.descript.com/..."
              style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border-strong)", backgroundColor: "var(--bg)", color: "var(--text-primary)", fontSize: "14px", outline: "none", boxSizing: "border-box" }}
            />
          </div>

          {/* Progress */}
          {progress && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px", borderRadius: "8px", backgroundColor: "var(--accent-soft)", color: "var(--accent)", fontSize: "13px", fontWeight: 600 }}>
              <Loader2 style={{ width: "14px", height: "14px", animation: "spin 1s linear infinite", flexShrink: 0 }} />
              {progress}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ color: "var(--negative)", fontSize: "13px", padding: "10px 14px", borderRadius: "8px", backgroundColor: "var(--negative-soft)" }}>{error}</div>
          )}

          <div style={{ display: "flex", gap: "12px" }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid var(--border-strong)", backgroundColor: "transparent", color: "var(--text-secondary)", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button
              type="submit"
              disabled={uploading || !file}
              style={{ flex: 2, padding: "10px", borderRadius: "8px", border: "none", backgroundColor: "var(--accent)", color: "#fff", fontSize: "14px", fontWeight: 700, cursor: uploading || !file ? "not-allowed" : "pointer", opacity: uploading || !file ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
            >
              {uploading && <Loader2 style={{ width: "14px", height: "14px", animation: "spin 1s linear infinite" }} />}
              {uploading ? "Analyzing..." : "Upload & Analyze"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Client Info Header ───────────────────────────────────────────────────────

type ClientTypeOption = "Accelerator" | "1:1 Coaching" | "A La Carte" | "Group";

const CLIENT_TYPE_OPTIONS: ClientTypeOption[] = ["Accelerator", "1:1 Coaching", "A La Carte", "Group"];

interface ClientInfoHeaderProps {
  slug: string;
  displayName: string;
}

function ClientInfoHeader({ slug, displayName }: ClientInfoHeaderProps) {
  const [clientType, setClientType] = useState<ClientTypeOption>("Accelerator");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [editingPhone, setEditingPhone] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/clients/${slug}/info`);
        if (!res.ok) return;
        const data = await res.json() as ClientInfo;
        setPhone(data.phoneNumber ?? "");
        setEmail(data.businessEmail || data.personalEmail || "");
      } catch {
        // ignore
      }
    })();
  }, [slug]);

  const saveField = async (field: "phoneNumber" | "businessEmail", value: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${slug}/info`);
      const current = res.ok ? await res.json() as ClientInfo : { ...DEFAULT_CLIENT_INFO };
      const updated = { ...current, [field]: value };
      await fetch(`/api/clients/${slug}/info`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const commitPhone = async () => {
    setPhone(phoneInput);
    setEditingPhone(false);
    await saveField("phoneNumber", phoneInput);
  };

  const commitEmail = async () => {
    setEmail(emailInput);
    setEditingEmail(false);
    await saveField("businessEmail", emailInput);
  };

  const inlineInputStyle: React.CSSProperties = {
    padding: "3px 8px",
    borderRadius: "6px",
    border: "1px solid var(--accent)",
    backgroundColor: "var(--bg)",
    color: "var(--text-primary)",
    fontSize: "13px",
    outline: "none",
    minWidth: "160px",
  };

  const placeholderBtnStyle: React.CSSProperties = {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "2px 0",
    fontSize: "13px",
    color: "var(--text-muted)",
    fontStyle: "italic",
    textDecoration: "underline dotted",
    display: "flex",
    alignItems: "center",
    gap: "4px",
  };

  const valueBtnStyle: React.CSSProperties = {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "2px 0",
    fontSize: "13px",
    color: "var(--text-primary)",
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    gap: "4px",
    textDecoration: "none",
  };

  return (
    <div
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "14px",
        padding: "18px 24px",
        marginBottom: "24px",
        display: "flex",
        alignItems: "center",
        gap: "24px",
        flexWrap: "wrap",
      }}
    >
      {/* Name */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", fontFamily: "var(--font-heading)", lineHeight: 1.1 }}>
          {displayName}
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: "1px", height: "36px", backgroundColor: "var(--border)", flexShrink: 0 }} />

      {/* Client Type Dropdown */}
      <div style={{ display: "flex", flexDirection: "column", gap: "3px", flexShrink: 0 }}>
        <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Client Type
        </span>
        <select
          value={clientType}
          onChange={(e) => setClientType(e.target.value as ClientTypeOption)}
          style={{
            padding: "4px 28px 4px 10px",
            borderRadius: "7px",
            border: "1px solid var(--border-strong)",
            backgroundColor: "var(--bg)",
            color: "var(--text-primary)",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            outline: "none",
            appearance: "none",
            WebkitAppearance: "none",
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238A96A8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 10px center",
          }}
        >
          {CLIENT_TYPE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>

      {/* Divider */}
      <div style={{ width: "1px", height: "36px", backgroundColor: "var(--border)", flexShrink: 0 }} />

      {/* Phone */}
      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
        <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Phone
        </span>
        {editingPhone ? (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <input
              autoFocus
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void commitPhone();
                if (e.key === "Escape") setEditingPhone(false);
              }}
              style={inlineInputStyle}
              placeholder="e.g. +1 555-123-4567"
            />
            <button onClick={() => { void commitPhone(); }} disabled={saving} style={{ padding: "3px 8px", borderRadius: "5px", border: "none", backgroundColor: "var(--accent)", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
              {saving ? "…" : "Save"}
            </button>
            <button onClick={() => setEditingPhone(false)} style={{ padding: "3px 8px", borderRadius: "5px", border: "1px solid var(--border-strong)", backgroundColor: "transparent", color: "var(--text-secondary)", fontSize: "12px", cursor: "pointer" }}>✕</button>
          </div>
        ) : phone ? (
          <button onClick={() => { setPhoneInput(phone); setEditingPhone(true); }} style={valueBtnStyle} title="Click to edit">
            {phone} <Pencil style={{ width: "10px", height: "10px", color: "var(--text-muted)", opacity: 0.6 }} />
          </button>
        ) : (
          <button onClick={() => { setPhoneInput(""); setEditingPhone(true); }} style={placeholderBtnStyle}>
            <Plus style={{ width: "11px", height: "11px" }} /> Add phone
          </button>
        )}
      </div>

      {/* Email */}
      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
        <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Email
        </span>
        {editingEmail ? (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <input
              autoFocus
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void commitEmail();
                if (e.key === "Escape") setEditingEmail(false);
              }}
              style={inlineInputStyle}
              placeholder="e.g. client@example.com"
            />
            <button onClick={() => { void commitEmail(); }} disabled={saving} style={{ padding: "3px 8px", borderRadius: "5px", border: "none", backgroundColor: "var(--accent)", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
              {saving ? "…" : "Save"}
            </button>
            <button onClick={() => setEditingEmail(false)} style={{ padding: "3px 8px", borderRadius: "5px", border: "1px solid var(--border-strong)", backgroundColor: "transparent", color: "var(--text-secondary)", fontSize: "12px", cursor: "pointer" }}>✕</button>
          </div>
        ) : email ? (
          <button onClick={() => { setEmailInput(email); setEditingEmail(true); }} style={valueBtnStyle} title="Click to edit">
            {email} <Pencil style={{ width: "10px", height: "10px", color: "var(--text-muted)", opacity: 0.6 }} />
          </button>
        ) : (
          <button onClick={() => { setEmailInput(""); setEditingEmail(true); }} style={placeholderBtnStyle}>
            <Plus style={{ width: "11px", height: "11px" }} /> Add email
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Phase 3: Tasks Tab ───────────────────────────────────────────────────────

interface ClientTodo {
  id: string;
  title: string;
  description: string | null;
  assignee: "sarah" | "bobby" | "both" | "client";
  priority: "high" | "medium" | "low";
  status: "open" | "in_progress" | "done";
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  client_slug: string | null;
}

const TASK_PRIORITY_DOT: Record<string, string> = {
  high: "#EF4444",
  medium: "#F59E0B",
  low: "#10B981",
};

const TASK_ASSIGNEE_COLOR: Record<string, string> = {
  sarah: "#8B5CF6",
  bobby: "#3B82F6",
  both: "#D97706",
  client: "#EC4899",
};

const TASK_ASSIGNEE_LABEL: Record<string, string> = {
  sarah: "Sarah",
  bobby: "Bobby",
  both: "Both",
  client: "Client",
};

const TASK_STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  done: "Done",
};

const TASK_STATUS_COLOR: Record<string, string> = {
  open: "#6B7280",
  in_progress: "#F59E0B",
  done: "#10B981",
};

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return dueDate < new Date().toISOString().split("T")[0];
}

// ─── Add Task Modal ───────────────────────────────────────────────────────────

interface AddTaskModalProps {
  slug: string;
  onClose: () => void;
  onSuccess: () => void;
}

function AddTaskModal({ slug, onClose, onSuccess }: AddTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState<"sarah" | "bobby" | "both" | "client">("sarah");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          assignee,
          priority,
          due_date: dueDate || null,
          client_slug: slug,
        }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Failed to create task");
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid var(--border-strong)",
    backgroundColor: "var(--bg)",
    color: "var(--text-primary)",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--text-secondary)",
    marginBottom: "6px",
  };

  const segmentBase: React.CSSProperties = {
    flex: 1,
    padding: "8px 0",
    border: "1px solid var(--border-strong)",
    backgroundColor: "transparent",
    color: "var(--text-secondary)",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 150ms ease",
  };

  const assigneeOptions: Array<"sarah" | "bobby" | "both" | "client"> = ["sarah", "bobby", "both", "client"];

  return (
    <div
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px", padding: "32px", width: "100%", maxWidth: "560px", maxHeight: "85vh", overflow: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>Add Task</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
            <X style={{ width: "20px", height: "20px" }} />
          </button>
        </div>
        <form onSubmit={(e) => { void handleSubmit(e); }} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Title <span style={{ color: "var(--negative)" }}>*</span></label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be done?" required style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Description <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add more context..." rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-body)", lineHeight: 1.6 }} />
          </div>
          {/* Assignee — 4 buttons */}
          <div>
            <label style={labelStyle}>Assignee</label>
            <div style={{ display: "flex", borderRadius: "8px", overflow: "hidden" }}>
              {assigneeOptions.map((a, i) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAssignee(a)}
                  style={{
                    ...segmentBase,
                    borderRadius: i === 0 ? "8px 0 0 8px" : i === assigneeOptions.length - 1 ? "0 8px 8px 0" : "0",
                    borderLeft: i > 0 ? "none" : "1px solid var(--border-strong)",
                    backgroundColor: assignee === a ? TASK_ASSIGNEE_COLOR[a] : "transparent",
                    color: assignee === a ? "#fff" : "var(--text-secondary)",
                    fontWeight: assignee === a ? 700 : 500,
                  }}
                >
                  {TASK_ASSIGNEE_LABEL[a]}
                </button>
              ))}
            </div>
          </div>
          {/* Priority */}
          <div>
            <label style={labelStyle}>Priority</label>
            <div style={{ display: "flex", borderRadius: "8px", overflow: "hidden" }}>
              {(["high", "medium", "low"] as const).map((p, i) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  style={{ ...segmentBase, borderRadius: i === 0 ? "8px 0 0 8px" : i === 2 ? "0 8px 8px 0" : "0", borderLeft: i > 0 ? "none" : "1px solid var(--border-strong)", backgroundColor: priority === p ? TASK_PRIORITY_DOT[p] : "transparent", color: priority === p ? "#fff" : "var(--text-secondary)", fontWeight: priority === p ? 700 : 500 }}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Due Date <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
          </div>
          {error && <div style={{ color: "var(--negative)", fontSize: "13px", padding: "10px 14px", borderRadius: "8px", backgroundColor: "var(--negative-soft)" }}>{error}</div>}
          <div style={{ display: "flex", gap: "12px" }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid var(--border-strong)", backgroundColor: "transparent", color: "var(--text-secondary)", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button type="submit" disabled={saving || !title.trim()} style={{ flex: 2, padding: "10px", borderRadius: "8px", border: "none", backgroundColor: "var(--accent)", color: "#fff", fontSize: "14px", fontWeight: 700, cursor: saving || !title.trim() ? "not-allowed" : "pointer", opacity: saving || !title.trim() ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              {saving && <Loader2 style={{ width: "14px", height: "14px", animation: "spin 1s linear infinite" }} />}
              Add Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Tasks Tab Component (swim lanes) ────────────────────────────────────────

interface TasksTabProps {
  slug: string;
}

function TasksTab({ slug }: TasksTabProps) {
  const [allTodos, setAllTodos] = useState<ClientTodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchTodos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/todos?client_slug=${encodeURIComponent(slug)}&limit=200`);
      if (!res.ok) throw new Error("Failed to load tasks");
      const data = await res.json() as { todos: ClientTodo[] };
      setAllTodos(data.todos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void fetchTodos();
  }, [fetchTodos]);

  const updateStatus = async (id: string, status: "open" | "in_progress" | "done") => {
    setUpdating(id);
    try {
      const res = await fetch(`/api/todos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update task");
      await fetchTodos();
    } catch {
      // silent
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
        <Loader2 style={{ width: "28px", height: "28px", color: "var(--accent)", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (error) {
    return <div style={{ padding: "24px", backgroundColor: "var(--negative-soft)", borderRadius: "12px", color: "var(--negative)", fontSize: "14px" }}>{error}</div>;
  }

  const activeTodos = allTodos.filter((t) => t.status !== "done");
  const doneTodos = allTodos.filter((t) => t.status === "done");

  const SWIM_LANES: Array<{ key: "sarah" | "bobby" | "both" | "client"; label: string }> = [
    { key: "sarah", label: "Sarah's Tasks" },
    { key: "bobby", label: "Bobby's Tasks" },
    { key: "both", label: "Both" },
    { key: "client", label: "Client Tasks" },
  ];

  const renderTask = (todo: ClientTodo) => {
    const overdue = isOverdue(todo.due_date);
    const isUpdating = updating === todo.id;
    return (
      <div
        key={todo.id}
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "6px" }}
      >
        <div style={{ width: "9px", height: "9px", borderRadius: "50%", backgroundColor: TASK_PRIORITY_DOT[todo.priority], flexShrink: 0, marginTop: "5px" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginBottom: "2px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{todo.title}</span>
            <span style={{ fontSize: "10px", fontWeight: 600, padding: "1px 6px", borderRadius: "8px", backgroundColor: `${TASK_STATUS_COLOR[todo.status]}20`, color: TASK_STATUS_COLOR[todo.status] }}>
              {TASK_STATUS_LABEL[todo.status]}
            </span>
            {todo.due_date && (
              <span style={{ fontSize: "11px", color: overdue ? "#EF4444" : "var(--text-muted)" }}>
                {overdue ? "⚠ " : ""}Due {formatDate(todo.due_date)}
              </span>
            )}
          </div>
          {todo.description && <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.4 }}>{todo.description}</p>}
        </div>
        <div style={{ display: "flex", gap: "5px", flexShrink: 0 }}>
          {todo.status !== "in_progress" && (
            <button
              onClick={() => { void updateStatus(todo.id, "in_progress"); }}
              disabled={isUpdating}
              style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--border-strong)", backgroundColor: "transparent", color: "#F59E0B", fontSize: "11px", fontWeight: 600, cursor: isUpdating ? "not-allowed" : "pointer", opacity: isUpdating ? 0.5 : 1 }}
            >
              {isUpdating ? <Loader2 style={{ width: "10px", height: "10px", animation: "spin 1s linear infinite" }} /> : <Clock style={{ width: "10px", height: "10px" }} />}
              WIP
            </button>
          )}
          <button
            onClick={() => { void updateStatus(todo.id, "done"); }}
            disabled={isUpdating}
            style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px 8px", borderRadius: "6px", border: "none", backgroundColor: "var(--accent)", color: "#fff", fontSize: "11px", fontWeight: 700, cursor: isUpdating ? "not-allowed" : "pointer", opacity: isUpdating ? 0.5 : 1 }}
          >
            {isUpdating ? <Loader2 style={{ width: "10px", height: "10px", animation: "spin 1s linear infinite" }} /> : <CheckCircle style={{ width: "10px", height: "10px" }} />}
            Done
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-heading)", margin: 0 }}>Client Tasks</h3>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={() => setShowAddModal(true)} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", borderRadius: "8px", border: "none", backgroundColor: "var(--accent)", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            <Plus style={{ width: "14px", height: "14px" }} />
            Add Task
          </button>
        </div>
      </div>

      {/* Swim lanes */}
      {SWIM_LANES.map(({ key, label }) => {
        const laneTasks = activeTodos.filter((t) => t.assignee === key);
        if (laneTasks.length === 0) return null;
        const color = TASK_ASSIGNEE_COLOR[key];
        return (
          <div key={key}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "3px", backgroundColor: color, flexShrink: 0 }} />
              <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-secondary)" }}>{label}</span>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", padding: "1px 6px", borderRadius: "8px", backgroundColor: "var(--surface-elevated)" }}>{laneTasks.length}</span>
            </div>
            <div>{laneTasks.map(renderTask)}</div>
          </div>
        );
      })}

      {activeTodos.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 24px", backgroundColor: "var(--surface)", border: "2px dashed var(--border)", borderRadius: "12px" }}>
          <CheckCircle style={{ width: "32px", height: "32px", color: "var(--text-muted)", margin: "0 auto 12px" }} />
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: 0 }}>No open tasks for this client — add one above</p>
        </div>
      )}

      {/* Completed tasks */}
      {doneTodos.length > 0 && (
        <div style={{ border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden", backgroundColor: "var(--surface)" }}>
          <button onClick={() => setShowDone((v) => !v)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", border: "none", backgroundColor: "transparent", cursor: "pointer", color: "var(--text-secondary)", fontSize: "13px", fontWeight: 600 }}>
            <span>Completed Tasks ({doneTodos.length})</span>
            {showDone ? <ChevronUp style={{ width: "16px", height: "16px" }} /> : <ChevronDown style={{ width: "16px", height: "16px" }} />}
          </button>
          {showDone && (
            <div style={{ borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "1px", backgroundColor: "var(--border)" }}>
              {doneTodos.map((todo) => (
                <div key={todo.id} style={{ backgroundColor: "var(--bg)", padding: "10px 14px", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <CheckCircle style={{ width: "13px", height: "13px", color: "#10B981", flexShrink: 0, marginTop: "3px" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: "13px", color: "var(--text-muted)", textDecoration: "line-through" }}>{todo.title}</span>
                    <div style={{ display: "flex", gap: "6px", marginTop: "2px", alignItems: "center" }}>
                      <span style={{ fontSize: "10px", fontWeight: 600, padding: "1px 6px", borderRadius: "8px", backgroundColor: `${TASK_ASSIGNEE_COLOR[todo.assignee]}20`, color: TASK_ASSIGNEE_COLOR[todo.assignee] }}>
                        {TASK_ASSIGNEE_LABEL[todo.assignee]}
                      </span>
                      {todo.completed_at && <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Completed {formatDate(todo.completed_at)}</span>}
                    </div>
                  </div>
                  <button onClick={() => { void updateStatus(todo.id, "open"); }} disabled={updating === todo.id} style={{ padding: "3px 8px", borderRadius: "5px", border: "1px solid var(--border-strong)", backgroundColor: "transparent", color: "var(--text-muted)", fontSize: "11px", fontWeight: 600, cursor: updating === todo.id ? "not-allowed" : "pointer", opacity: updating === todo.id ? 0.5 : 1, flexShrink: 0 }}>
                    Reopen
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showAddModal && (
        <AddTaskModal slug={slug} onClose={() => setShowAddModal(false)} onSuccess={() => { void fetchTodos(); }} />
      )}
    </div>
  );
}

// ─── Phase 5: Phase Board Tab ─────────────────────────────────────────────────

interface PhaseBoardTabProps {
  slug: string;
  onNavigate: (tabId: TabId, docFile?: string) => void;
}

type PhaseFilterKey = "phase-1" | "phase-2" | "phase-3" | "phase-4";

const PHASE_FILTER_BUTTONS: Array<{ key: PhaseFilterKey; label: string }> = [
  { key: "phase-1", label: "Phase 1" },
  { key: "phase-2", label: "Phase 2" },
  { key: "phase-3", label: "Phase 3" },
  { key: "phase-4", label: "Phase 4" },
];

function phaseMatchesFilter(phaseId: string, filter: PhaseFilterKey): boolean {
  if (filter === "phase-3") {
    return phaseId === "phase-3a" || phaseId === "phase-3b";
  }
  return phaseId === filter || phaseId.startsWith(filter + "-") || phaseId === filter;
}

function PhaseBoardTab({ slug, onNavigate }: PhaseBoardTabProps) {
  const [board, setBoard] = useState<PhaseBoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [activePhaseFilter, setActivePhaseFilter] = useState<PhaseFilterKey>("phase-1");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/clients/${slug}/phase-board`);
        if (!res.ok) return;
        const data = await res.json() as PhaseBoardData;
        setBoard(data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const saveBoard = useCallback((data: PhaseBoardData) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void fetch(`/api/clients/${slug}/phase-board`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    }, 500);
  }, [slug]);

  const toggleCollapse = (phaseId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  };

  const updateTaskInPhase = (
    phases: PhaseBoardPhase[],
    taskId: string,
    updater: (t: PhaseBoardTask) => PhaseBoardTask
  ): PhaseBoardPhase[] => {
    return phases.map((phase) => ({
      ...phase,
      tasks: updateTasksRecursive(phase.tasks, taskId, updater),
    }));
  };

  const updateTasksRecursive = (
    tasks: PhaseBoardTask[],
    taskId: string,
    updater: (t: PhaseBoardTask) => PhaseBoardTask
  ): PhaseBoardTask[] => {
    return tasks.map((task) => {
      if (task.id === taskId) return updater(task);
      if (task.subtasks) {
        const updatedSubtasks = updateTasksRecursive(task.subtasks, taskId, updater);
        // Auto-complete parent if all subtasks are done
        const allDone = updatedSubtasks.every((s) => s.completed);
        const anyChanged = JSON.stringify(updatedSubtasks) !== JSON.stringify(task.subtasks);
        if (anyChanged) {
          return {
            ...task,
            subtasks: updatedSubtasks,
            completed: allDone,
            completedAt: allDone && !task.completed ? new Date().toISOString() : (!allDone ? null : task.completedAt),
          };
        }
      }
      return task;
    });
  };

  const handleToggleTask = (taskId: string) => {
    if (!board) return;
    const newPhases = updateTaskInPhase(board.phases, taskId, (task) => {
      const nowCompleted = !task.completed;
      let newSubtasks = task.subtasks;
      if (nowCompleted && task.subtasks) {
        newSubtasks = task.subtasks.map((s) => ({
          ...s,
          completed: true,
          completedAt: s.completed ? s.completedAt : new Date().toISOString(),
        }));
      } else if (!nowCompleted && task.subtasks) {
        newSubtasks = task.subtasks.map((s) => ({
          ...s,
          completed: false,
          completedAt: null,
        }));
      }
      return {
        ...task,
        completed: nowCompleted,
        completedAt: nowCompleted ? new Date().toISOString() : null,
        subtasks: newSubtasks,
      };
    });
    const newBoard = { phases: newPhases };
    setBoard(newBoard);
    saveBoard(newBoard);
  };

  const countTasksInPhase = (phase: PhaseBoardPhase): { total: number; done: number } => {
    let total = 0;
    let done = 0;
    const countRecursive = (tasks: PhaseBoardTask[]) => {
      for (const task of tasks) {
        if (task.subtasks && task.subtasks.length > 0) {
          countRecursive(task.subtasks);
        } else {
          total++;
          if (task.completed) done++;
        }
      }
    };
    countRecursive(phase.tasks);
    return { total, done };
  };

  const renderTask = (task: PhaseBoardTask, depth = 0): React.ReactNode => {
    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
    const indent = depth * 20;

    return (
      <div key={task.id}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "8px 16px",
            paddingLeft: `${16 + indent}px`,
            borderBottom: "1px solid var(--border)",
            backgroundColor: task.completed ? "var(--bg)" : "transparent",
            transition: "background-color 150ms ease",
          }}
        >
          {/* Checkbox */}
          <button
            onClick={() => handleToggleTask(task.id)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              flexShrink: 0,
              color: task.completed ? "var(--positive)" : "var(--border-strong)",
              display: "flex",
              alignItems: "center",
            }}
          >
            {task.completed ? (
              <CheckCircle style={{ width: "16px", height: "16px", color: "var(--positive)" }} />
            ) : (
              <Square style={{ width: "16px", height: "16px" }} />
            )}
          </button>

          {/* Label */}
          <span
            style={{
              flex: 1,
              fontSize: depth > 0 ? "12px" : "13px",
              fontWeight: depth > 0 ? 400 : 500,
              color: task.completed ? "var(--text-muted)" : "var(--text-primary)",
              textDecoration: task.completed ? "line-through" : "none",
              lineHeight: 1.4,
            }}
          >
            {task.label}
          </span>

          {/* Completed timestamp */}
          {task.completed && task.completedAt && (
            <span style={{ fontSize: "11px", color: "var(--text-muted)", flexShrink: 0 }}>
              ✓ {formatDate(task.completedAt)}
            </span>
          )}

          {/* View doc button */}
          {task.viewDoc && !task.completed && (
            <button
              onClick={() => onNavigate(task.viewDoc as TabId, task.viewDocFile)}
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--accent)",
                background: "none",
                border: "1px solid var(--accent)",
                borderRadius: "5px",
                padding: "2px 8px",
                cursor: "pointer",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                gap: "3px",
              }}
            >
              View <ChevronRight style={{ width: "10px", height: "10px" }} />
            </button>
          )}

          {/* Check icon for parent with subtasks */}
          {hasSubtasks && (
            <span style={{ fontSize: "11px", color: "var(--text-muted)", flexShrink: 0 }}>
              {task.subtasks!.filter((s) => s.completed).length}/{task.subtasks!.length}
            </span>
          )}
        </div>

        {/* Subtasks */}
        {hasSubtasks && task.subtasks!.map((sub) => renderTask(sub, depth + 1))}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
        <Loader2 style={{ width: "28px", height: "28px", color: "var(--accent)", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (!board) {
    return <div style={{ padding: "24px", backgroundColor: "var(--negative-soft)", borderRadius: "12px", color: "var(--negative)", fontSize: "14px" }}>Failed to load phase board.</div>;
  }

  // Overall stats (across all phases)
  let totalAll = 0;
  let doneAll = 0;
  for (const phase of board.phases) {
    const { total, done } = countTasksInPhase(phase);
    totalAll += total;
    doneAll += done;
  }
  const overallPct = totalAll > 0 ? Math.round((doneAll / totalAll) * 100) : 0;

  // Filter phases by active filter
  const filteredPhases = board.phases.filter((p) => phaseMatchesFilter(p.id, activePhaseFilter));

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-heading)", margin: 0 }}>Phase Board</h3>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>{doneAll}/{totalAll} tasks · {overallPct}%</span>
        </div>

        {/* Phase filter segmented control */}
        <div style={{ display: "flex", borderRadius: "10px", overflow: "hidden", border: "1px solid var(--border-strong)", marginBottom: "12px", width: "fit-content" }}>
          {PHASE_FILTER_BUTTONS.map((btn, i) => {
            const isActive = activePhaseFilter === btn.key;
            return (
              <button
                key={btn.key}
                onClick={() => setActivePhaseFilter(btn.key)}
                style={{
                  padding: "7px 18px",
                  border: "none",
                  borderLeft: i > 0 ? "1px solid var(--border-strong)" : "none",
                  backgroundColor: isActive ? "var(--accent)" : "var(--surface)",
                  color: isActive ? "#fff" : "var(--text-secondary)",
                  fontSize: "13px",
                  fontWeight: isActive ? 700 : 500,
                  cursor: "pointer",
                  transition: "all 150ms ease",
                }}
              >
                {btn.label}
              </button>
            );
          })}
        </div>

        {/* Overall progress bar */}
        <div style={{ height: "6px", borderRadius: "3px", backgroundColor: "var(--border)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${overallPct}%`, backgroundColor: "var(--accent)", borderRadius: "3px", transition: "width 300ms ease" }} />
        </div>
      </div>

      {/* Phases (filtered by active phase button) */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {filteredPhases.length === 0 && (
          <div style={{ padding: "32px 24px", textAlign: "center", backgroundColor: "var(--surface)", borderRadius: "12px", border: "1px solid var(--border)" }}>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>No phases for this filter yet.</p>
          </div>
        )}
        {filteredPhases.map((phase) => {
          const { total, done } = countTasksInPhase(phase);
          const phasePct = total > 0 ? Math.round((done / total) * 100) : 0;
          const isCollapsed = collapsed.has(phase.id);

          return (
            <div key={phase.id} style={{ border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden", backgroundColor: "var(--surface)" }}>
              {/* Phase header */}
              <button
                onClick={() => toggleCollapse(phase.id)}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", border: "none", backgroundColor: "transparent", cursor: "pointer", gap: "12px" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}>
                  {isCollapsed ? <ChevronRight style={{ width: "14px", height: "14px", color: "var(--text-muted)", flexShrink: 0 }} /> : <ChevronDown style={{ width: "14px", height: "14px", color: "var(--text-muted)", flexShrink: 0 }} />}
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-heading)", textAlign: "left" }}>{phase.label}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{done}/{total}</span>
                  <div style={{ width: "80px", height: "4px", borderRadius: "2px", backgroundColor: "var(--border)" }}>
                    <div style={{ height: "100%", width: `${phasePct}%`, backgroundColor: phasePct === 100 ? "var(--positive)" : "var(--accent)", borderRadius: "2px", transition: "width 300ms ease" }} />
                  </div>
                  {phasePct === 100 && <Check style={{ width: "13px", height: "13px", color: "var(--positive)" }} />}
                </div>
              </button>

              {/* Tasks */}
              {!isCollapsed && (
                <div style={{ borderTop: "1px solid var(--border)" }}>
                  {phase.tasks.map((task) => renderTask(task))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Value Ladder Tab ────────────────────────────────────────────────────────

type ValueLadderStatus = "ideation" | "in-progress" | "ready-to-launch" | "live" | "scaling";
type ValueLadderFrequency = "one-time" | "monthly" | "annual";

interface ValueLadderItem {
  step: number;
  name: string;
  productName: string;
  price: string;
  frequency: ValueLadderFrequency;
  status: ValueLadderStatus;
  description: string;
  liveUrl?: string;
  vbsEditUrl?: string;
}

interface ValueLadderData {
  tiers: ValueLadderItem[];
}

const STATUS_CONFIG: Record<ValueLadderStatus, { label: string; color: string }> = {
  "ideation":        { label: "Ideation",        color: "#9CA3AF" },
  "in-progress":     { label: "In Progress",     color: "#FBBF24" },
  "ready-to-launch": { label: "Ready to Launch", color: "#3B82F6" },
  "live":            { label: "Live",            color: "#10B981" },
  "scaling":         { label: "Scaling",         color: "#A855F7" },
};

const DEFAULT_VALUE_LADDER: ValueLadderData = {
  tiers: [
    {
      step: 1,
      name: "Symptom Decoder",
      productName: "MATE",
      price: "$7–$27",
      frequency: "one-time",
      status: "live",
      description: "Low-ticket entry point to identify core health issues",
      liveUrl: "https://go.fullbloomacres.com/sd",
      vbsEditUrl: "",
    },
    {
      step: 2,
      name: "The Food Freedom Bundle",
      productName: "Community Upsell (MEE)",
      price: "$127",
      frequency: "monthly",
      status: "live",
      description: "Community membership with micro-course",
      liveUrl: "",
      vbsEditUrl: "",
    },
    {
      step: 3,
      name: "Back To Self",
      productName: "Core Product (MTM)",
      price: "$997–$2,400",
      frequency: "one-time",
      status: "ideation",
      description: "5-course bundle with group coaching and support",
      liveUrl: "",
      vbsEditUrl: "",
    },
  ],
};

// ─── Value Ladder Tier Card ────────────────────────────────────────────────────

interface ValueLadderTierCardProps {
  item: ValueLadderItem;
  isEditing: boolean;
  editItem?: ValueLadderItem;
  saving?: boolean;
  onEditStart: () => void;
  onEditChange?: (updated: ValueLadderItem) => void;
  onSave?: () => void;
  onCancel?: () => void;
}

function ValueLadderTierCard({
  item,
  isEditing,
  editItem,
  saving,
  onEditStart,
  onEditChange,
  onSave,
  onCancel,
}: ValueLadderTierCardProps) {
  const cfg = STATUS_CONFIG[item.status];
  const editCfg = editItem ? (STATUS_CONFIG[editItem.status] ?? cfg) : cfg;

  const fieldInput = (
    label: string,
    key: keyof ValueLadderItem,
    type: "text" | "url" = "text",
    placeholder = ""
  ) => {
    const val = editItem ? String(editItem[key] ?? "") : "";
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
        <label style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </label>
        <input
          type={type}
          value={val}
          onChange={(e) => onEditChange?.({ ...editItem!, [key]: e.target.value })}
          placeholder={placeholder || label}
          style={{
            padding: "6px 10px",
            borderRadius: "6px",
            border: "1px solid var(--border-strong)",
            backgroundColor: "var(--bg)",
            color: "var(--text-primary)",
            fontSize: "13px",
            outline: "none",
            width: "100%",
            boxSizing: "border-box",
          }}
        />
      </div>
    );
  };

  // ── Edit mode ──
  if (isEditing && editItem && onEditChange) {
    return (
      <div style={{ backgroundColor: "var(--surface)", border: "2px solid var(--accent)", borderRadius: "14px", padding: "20px 24px", display: "flex", flexDirection: "column", gap: "14px" }}>
        {/* Edit header + Save/Cancel */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: 400, letterSpacing: "0.06em", textTransform: "uppercase", color: "#666", fontVariant: "small-caps" }}>
              Step {item.step} — {editItem.productName || item.productName}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: editCfg.color, display: "inline-block", flexShrink: 0 }} />
              <span style={{ fontSize: "11px", fontWeight: 600, color: editCfg.color }}>{editCfg.label}</span>
            </span>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={onCancel}
              style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 12px", borderRadius: "7px", border: "1px solid var(--border-strong)", backgroundColor: "transparent", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
            >
              <X style={{ width: "11px", height: "11px" }} /> Cancel
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 12px", borderRadius: "7px", border: "none", backgroundColor: "var(--accent)", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
            >
              {saving
                ? <Loader2 style={{ width: "11px", height: "11px", animation: "spin 1s linear infinite" }} />
                : <Save style={{ width: "11px", height: "11px" }} />}
              Save
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {fieldInput("Tier Name", "name", "text", "e.g. Symptom Decoder")}
          {fieldInput("Product Name", "productName", "text", "e.g. MATE")}
          {fieldInput("Price", "price", "text", "e.g. $7–$27")}
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            <label style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Frequency</label>
            <select
              value={editItem.frequency}
              onChange={(e) => onEditChange({ ...editItem, frequency: e.target.value as ValueLadderFrequency })}
              style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border-strong)", backgroundColor: "var(--bg)", color: "var(--text-primary)", fontSize: "13px", outline: "none" }}
            >
              <option value="one-time">One-time</option>
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            <label style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Status</label>
            <select
              value={editItem.status}
              onChange={(e) => onEditChange({ ...editItem, status: e.target.value as ValueLadderStatus })}
              style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border-strong)", backgroundColor: "var(--bg)", color: "var(--text-primary)", fontSize: "13px", outline: "none" }}
            >
              {(Object.entries(STATUS_CONFIG) as Array<[ValueLadderStatus, { label: string }]>).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {fieldInput("Live Funnel URL", "liveUrl", "url", "https://...")}
          {fieldInput("VBS Edit URL", "vbsEditUrl", "url", "https://...")}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          <label style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Description</label>
          <textarea
            value={editItem.description}
            onChange={(e) => onEditChange({ ...editItem, description: e.target.value })}
            rows={3}
            placeholder="Short description of this offer tier..."
            style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border-strong)", backgroundColor: "var(--bg)", color: "var(--text-primary)", fontSize: "13px", outline: "none", resize: "vertical", lineHeight: 1.5, fontFamily: "var(--font-body)", boxSizing: "border-box", width: "100%" }}
          />
        </div>
      </div>
    );
  }

  // ── View mode (clean typography) ──
  return (
    <div
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "14px",
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: "0",
      }}
    >
      {/* Header row: STEP label + status dot + Edit button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "11px", fontWeight: 400, letterSpacing: "0.06em", textTransform: "uppercase", color: "#666", fontVariant: "small-caps" }}>
            Step {item.step}: {item.productName}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: cfg.color, display: "inline-block", flexShrink: 0 }} />
            <span style={{ fontSize: "11px", fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
          </span>
        </div>
        <button
          onClick={onEditStart}
          style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 10px", borderRadius: "7px", border: "1px solid var(--border-strong)", backgroundColor: "transparent", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
        >
          <Edit3 style={{ width: "11px", height: "11px" }} /> Edit
        </button>
      </div>

      {/* Name */}
      <div style={{ marginBottom: "8px" }}>
        <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3 }}>{item.name}</span>
      </div>

      {/* Price • Frequency */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
        <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}>{item.price}</span>
        <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>•</span>
        <span style={{ fontSize: "13px", fontWeight: 400, color: "var(--text-secondary)" }}>{item.frequency}</span>
      </div>

      {/* Description */}
      {item.description && (
        <div style={{ marginBottom: "12px" }}>
          <span style={{ fontSize: "13px", fontWeight: 400, lineHeight: 1.6, color: "var(--text-secondary)" }}>{item.description}</span>
        </div>
      )}

      {/* Funnel links */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", borderTop: "1px solid #e5e5e5", paddingTop: "12px" }}>
        {item.liveUrl && item.liveUrl !== "(TBD)" ? (
          <a
            href={item.liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "5px 12px", borderRadius: "8px", border: "1.5px solid var(--accent)", backgroundColor: "var(--accent-soft)", color: "var(--accent)", fontSize: "12px", fontWeight: 700, textDecoration: "none" }}
          >
            🔗 Live Funnel
          </a>
        ) : (
          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "5px 12px", borderRadius: "8px", border: "1.5px solid var(--border-strong)", color: "var(--text-muted)", fontSize: "12px", fontWeight: 600, opacity: 0.5 }}>
            🔗 Live Funnel
          </span>
        )}
        <span style={{ color: "var(--border-strong)" }}>|</span>
        {item.vbsEditUrl && item.vbsEditUrl !== "(TBD)" ? (
          <a
            href={item.vbsEditUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "5px 12px", borderRadius: "8px", border: "1.5px solid var(--border-strong)", backgroundColor: "transparent", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 700, textDecoration: "none" }}
          >
            ✏️ VBS Edit
          </a>
        ) : (
          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "5px 12px", borderRadius: "8px", border: "1.5px solid var(--border-strong)", color: "var(--text-muted)", fontSize: "12px", fontWeight: 600, opacity: 0.5 }}>
            ✏️ VBS Edit
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Value Ladder Tab (per-tier editing, persisted) ───────────────────────────

// ─── Idea Board Tab ──────────────────────────────────────────────────────────

interface Idea {
  id: string;
  text: string;
  created_at: string;
}

interface IdeaBoardData {
  ideas: Idea[];
}

interface IdeaBoardTabProps {
  slug: string;
}

function IdeaBoardTab({ slug }: IdeaBoardTabProps) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newIdea, setNewIdea] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchIdeas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${slug}/ideas`);
      if (!res.ok) {
        if (res.status === 404) {
          // No ideas yet, that's fine
          setIdeas([]);
        } else {
          throw new Error("Failed to load ideas");
        }
      } else {
        const data = await res.json() as IdeaBoardData;
        setIdeas(data.ideas ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ideas");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void fetchIdeas();
  }, [fetchIdeas]);

  const handleAddIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIdea.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/clients/${slug}/ideas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newIdea.trim() }),
      });
      if (!res.ok) throw new Error("Failed to add idea");
      await fetchIdeas();
      setNewIdea("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add idea");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteIdea = async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/clients/${slug}/ideas/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete idea");
      await fetchIdeas();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete idea");
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
        <Loader2 style={{ width: "28px", height: "28px", color: "var(--accent)", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-heading)", margin: "0 0 4px" }}>
          Idea Board
        </h3>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
          Capture and organize ideas from client calls and sessions.
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div style={{ padding: "12px 16px", backgroundColor: "var(--negative-soft)", color: "var(--negative)", borderRadius: "10px", fontSize: "13px", marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {error}
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--negative)", fontSize: "16px", padding: 0 }}>✕</button>
        </div>
      )}

      {/* Add Idea Form */}
      <form onSubmit={(e) => { void handleAddIdea(e); }} style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
          <textarea
            value={newIdea}
            onChange={(e) => setNewIdea(e.target.value)}
            placeholder="Add a new idea..."
            rows={3}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: "10px",
              border: "1px solid var(--border-strong)",
              backgroundColor: "var(--bg)",
              color: "var(--text-primary)",
              fontSize: "13px",
              fontFamily: "var(--font-body)",
              outline: "none",
              resize: "vertical",
              lineHeight: 1.6,
            }}
          />
          <button
            type="submit"
            disabled={submitting || !newIdea.trim()}
            style={{
              padding: "12px 20px",
              borderRadius: "10px",
              border: "none",
              backgroundColor: "var(--accent)",
              color: "#fff",
              fontSize: "13px",
              fontWeight: 700,
              cursor: submitting || !newIdea.trim() ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              opacity: submitting || !newIdea.trim() ? 0.6 : 1,
              flexShrink: 0,
              marginTop: "2px",
            }}
          >
            {submitting ? (
              <>
                <Loader2 style={{ width: "14px", height: "14px", animation: "spin 1s linear infinite" }} />
                Adding...
              </>
            ) : (
              <>
                <Plus style={{ width: "14px", height: "14px" }} />
                Add Idea
              </>
            )}
          </button>
        </div>
      </form>

      {/* Ideas List */}
      {ideas.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px", backgroundColor: "var(--surface)", border: "2px dashed var(--border)", borderRadius: "12px" }}>
          <Plus style={{ width: "36px", height: "36px", color: "var(--text-muted)", margin: "0 auto 12px" }} />
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", fontWeight: 600, margin: "0 0 6px" }}>
            No ideas yet
          </p>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
            Add your first idea above to get started
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
          {ideas.map((idea) => (
            <div
              key={idea.id}
              style={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <p style={{ fontSize: "14px", color: "var(--text-primary)", lineHeight: 1.6, margin: 0, wordBreak: "break-word" }}>
                {idea.text}
              </p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  {formatDate(idea.created_at)}
                </span>
                <button
                  onClick={() => { void handleDeleteIdea(idea.id); }}
                  disabled={deleting === idea.id}
                  style={{
                    padding: "5px 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-strong)",
                    backgroundColor: "transparent",
                    color: "var(--negative)",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: deleting === idea.id ? "not-allowed" : "pointer",
                    opacity: deleting === idea.id ? 0.6 : 1,
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  {deleting === idea.id ? (
                    <Loader2 style={{ width: "11px", height: "11px", animation: "spin 1s linear infinite" }} />
                  ) : (
                    <X style={{ width: "11px", height: "11px" }} />
                  )}
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ValueLadderTab({ slug }: { slug: string }) {
  const [ladder, setLadder] = useState<ValueLadderItem[]>(DEFAULT_VALUE_LADDER.tiers);
  const [loading, setLoading] = useState(true);
  const [editingStep, setEditingStep] = useState<number | null>(null);
  const [editItems, setEditItems] = useState<Record<number, ValueLadderItem>>({});
  const [savingStep, setSavingStep] = useState<number | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/clients/${slug}/value-ladder`);
        if (res.ok) {
          const data = await res.json() as ValueLadderData;
          if (data.tiers?.length > 0) {
            setLadder(data.tiers);
          }
        }
      } catch {
        // use defaults
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const handleEditStart = (step: number) => {
    const tier = ladder.find((t) => t.step === step);
    if (!tier) return;
    setEditItems((prev) => ({ ...prev, [step]: { ...tier } }));
    setEditingStep(step);
  };

  const handleEditChange = (step: number, updated: ValueLadderItem) => {
    setEditItems((prev) => ({ ...prev, [step]: updated }));
  };

  const handleSave = async (step: number) => {
    const editItem = editItems[step];
    if (!editItem) return;
    setSavingStep(step);
    try {
      const updatedTiers = ladder.map((t) => t.step === step ? editItem : t);
      const res = await fetch(`/api/clients/${slug}/value-ladder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tiers: updatedTiers }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setLadder(updatedTiers);
      setLastSaved(new Date().toISOString());
      setEditingStep(null);
      setEditItems((prev) => {
        const next = { ...prev };
        delete next[step];
        return next;
      });
    } catch {
      // silent
    } finally {
      setSavingStep(null);
    }
  };

  const handleCancel = (step: number) => {
    setEditingStep(null);
    setEditItems((prev) => {
      const next = { ...prev };
      delete next[step];
      return next;
    });
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
        <Loader2 style={{ width: "28px", height: "28px", color: "var(--accent)", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-heading)", margin: "0 0 4px" }}>
            Client Offers
          </h3>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
            Client offer stack from entry-point to core product. Click Edit on any tier to update it.
          </p>
        </div>
        {lastSaved && editingStep === null && (
          <span style={{ fontSize: "12px", color: "var(--positive)" }}>
            ✓ Saved {new Date(lastSaved).toLocaleTimeString()}
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {ladder.map((item) => {
          const isEditing = editingStep === item.step;
          return (
            <ValueLadderTierCard
              key={item.step}
              item={item}
              isEditing={isEditing}
              editItem={isEditing ? editItems[item.step] : undefined}
              saving={savingStep === item.step}
              onEditStart={() => handleEditStart(item.step)}
              onEditChange={isEditing ? (updated) => handleEditChange(item.step, updated) : undefined}
              onSave={isEditing ? () => { void handleSave(item.step); } : undefined}
              onCancel={isEditing ? () => handleCancel(item.step) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function ClientDetailPage({ params }: PageProps) {
  const { slug } = use(params);

  const [clientFiles, setClientFiles] = useState<ClientFiles | null>(null);
  const [meta, setMeta] = useState<ClientMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [scrollToDoc, setScrollToDoc] = useState<string | undefined>(undefined);
  const [selectedPhase, setSelectedPhase] = useState<string>("Phase 1");
  const fetchedMeta = useRef(false);

  const fetchClientFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${slug}`);
      if (!res.ok) throw new Error("Client not found");
      const data = await res.json() as ClientFiles;
      setClientFiles(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      return null;
    }
  }, [slug]);

  const fetchMeta = useCallback(async () => {
    if (fetchedMeta.current) return;
    fetchedMeta.current = true;
    try {
      const res = await fetch(`/api/clients/${slug}/doc?file=PROFILE.md`);
      if (!res.ok) return;
      const data = await res.json() as { content: string };
      setMeta(parseMetaFromProfile(data.content));
    } catch {
      // Non-fatal
    }
  }, [slug]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchClientFiles(), fetchMeta()]).finally(() => setLoading(false));
  }, [fetchClientFiles, fetchMeta]);

  const displayName = meta?.name ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <Loader2 style={{ width: "32px", height: "32px", color: "var(--accent)", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Link href="/clients" style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "var(--text-secondary)", textDecoration: "none", marginBottom: "24px" }}>
          <ArrowLeft style={{ width: "16px", height: "16px" }} />
          Back to Clients
        </Link>
        <div style={{ padding: "24px", backgroundColor: "var(--negative-soft)", borderRadius: "12px", color: "var(--negative)" }}>{error}</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1400px" }}>
      {/* Back nav */}
      <Link
        href="/clients"
        style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--text-muted)", textDecoration: "none", marginBottom: "20px", transition: "color 150ms ease" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
      >
        <ArrowLeft style={{ width: "14px", height: "14px" }} />
        Clients
      </Link>

      {/* Two-column layout */}
      <div style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>

        {/* ─── Left Sidebar ─────────────────────────────────────────────── */}
        <aside
          style={{
            width: "220px",
            flexShrink: 0,
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "20px",
            position: "sticky",
            top: "24px",
          }}
        >
          {/* ── Client Card ── */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", marginBottom: "16px", paddingBottom: "16px", borderBottom: "1px solid var(--border)", textAlign: "center" }}>
            {/* Avatar */}
            <div style={{ width: "60px", height: "60px", borderRadius: "50%", backgroundColor: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: 700, color: "#fff", fontFamily: "var(--font-heading)", overflow: "hidden", flexShrink: 0 }}>
              {clientFiles?.hasAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/clients/${slug}/avatar`} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : getInitials(displayName)}
            </div>
            {/* Name only — no subtitle */}
            <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-heading)", lineHeight: 1.2 }}>{displayName}</div>
            {/* Phase dropdown (replaces stage badge) */}
            <select
              value={selectedPhase}
              onChange={(e) => setSelectedPhase(e.target.value)}
              style={{
                padding: "4px 24px 4px 8px",
                borderRadius: "7px",
                border: "1px solid var(--border-strong)",
                backgroundColor: "var(--bg)",
                color: "var(--text-primary)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                outline: "none",
                appearance: "none",
                WebkitAppearance: "none",
                backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238A96A8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 8px center",
                width: "100%",
              }}
            >
              <option value="Phase 1">Phase 1</option>
              <option value="Phase 2">Phase 2</option>
              <option value="Phase 3">Phase 3</option>
              <option value="Phase 4">Phase 4</option>
            </select>
            {/* Location */}
            {meta?.location && (
              <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "var(--text-muted)" }}>
                <MapPin style={{ width: "11px", height: "11px" }} />
                {meta.location}
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
              {NAV_ITEMS.map((section, sectionIdx) => (
              <div key={sectionIdx}>
                {section.section && (
                  <div style={{ padding: "12px 10px 6px", fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                    {section.section}
                  </div>
                )}
                {section.items.map((item) => {
                  const isActive = activeTab === item.id;
                  const isTranscripts = item.id === "transcripts";
                  return (
                    <div key={item.id} style={{ display: "flex" }}>
                      <button
                        onClick={() => setActiveTab(item.id)}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 10px",
                          marginBottom: "2px",
                          borderRadius: "8px",
                          border: "none",
                          backgroundColor: isActive ? "var(--accent-soft)" : "transparent",
                          color: isActive ? "var(--accent)" : "var(--text-secondary)",
                          fontSize: "13px",
                          fontWeight: isActive ? 700 : 500,
                          cursor: "pointer",
                          transition: "all 150ms ease",
                          textAlign: "left",
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface-hover)";
                            (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                            (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                          }
                        }}
                      >
                        <span>{item.label}</span>
                        {isTranscripts && (
                          <span style={{ fontSize: "11px", fontWeight: 600, padding: "1px 6px", borderRadius: "10px", backgroundColor: isActive ? "var(--accent)" : "var(--surface-elevated)", color: isActive ? "#fff" : "var(--text-muted)" }}>
                            {clientFiles?.transcripts.length ?? 0}
                          </span>
                        )}
                        {isActive && !isTranscripts && (
                          <ChevronRight style={{ width: "13px", height: "13px", color: "var(--accent)" }} />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
            </ul>
          </nav>
        </aside>

        {/* ─── Main Content ──────────────────────────────────────────────── */}
        <main style={{ flex: 1, minWidth: 0 }}>
          {(() => {
            if (activeTab === "client-info") {
              return <ClientInfoTab key={`${slug}-client-info`} slug={slug} />;
            }
            if (activeTab === "overview") {
              return <ProfileTab key={`${slug}-overview`} slug={slug} onNavigateToOffers={() => setActiveTab("offer")} />;
            }
            if (activeTab === "branding") {
              return <BrandingTab key={`${slug}-branding`} slug={slug} />;
            }
            if (activeTab === "offer") {
              return <ValueLadderTab key={`${slug}-offer`} slug={slug} />;
            }
            if (activeTab === "deliverables") {
              return <DeliverablesTab key={`${slug}-deliverables`} slug={slug} scrollToDoc={scrollToDoc} />;
            }
            if (activeTab === "phase-board") {
              return <PhaseBoard key={`${slug}-phase-board`} slug={slug} />;
            }
            if (activeTab === "tasks") {
              return <EnhancedTodoList key={`${slug}-tasks`} slug={slug} />;
            }
            if (activeTab === "transcripts") {
              return (
                <CoachingCallsTab
                  key={`${slug}-coaching-calls`}
                  slug={slug}
                  legacyTranscripts={clientFiles?.transcripts ?? []}
                />
              );
            }
            if (activeTab === "idea-board") {
              return <IdeaBoardTab key={`${slug}-idea-board`} slug={slug} />;
            }
            return null;
          })()}
        </main>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
