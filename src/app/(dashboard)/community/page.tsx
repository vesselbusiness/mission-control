"use client";

/**
 * Community Intelligence — /community
 * Full friction log + student wins management.
 * Sarah & Bobby's window into community health and momentum.
 */

import { useEffect, useState, useCallback } from "react";
import {
  Users,
  AlertTriangle,
  Trophy,
  CheckCircle,
  Loader2,
  Plus,
  X,
  ChevronUp,
  ChevronDown,
  Star,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MetricsSnapshot {
  snapshot: {
    active_members: number | null;
    date: string;
  } | null;
}

interface FrictionItem {
  id: string;
  issue_title: string;
  description: string;
  phase: string | null;
  tool_involved: string | null;
  priority: "high" | "medium" | "low";
  status: "open" | "in_progress" | "resolved";
  occurrence_count: number;
  suggested_fix: string | null;
  created_at: string;
}

interface Win {
  id: string;
  student_name: string | null;
  win_text: string;
  category: string | null;
  posted_at: string;
  featured: number;
}

type SortField = "occurrence_count" | "created_at" | "priority";
type SortDir = "asc" | "desc";

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  high: "#EF4444",
  medium: "#F59E0B",
  low: "#10B981",
};

const STATUS_COLORS: Record<string, string> = {
  open: "#EF4444",
  in_progress: "#F59E0B",
  resolved: "#10B981",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
};

const WIN_CATEGORY_COLORS: Record<string, string> = {
  first_client: "#D97706",
  mate_launch: "#3B82F6",
  revenue: "#10B981",
  breakthrough: "#8B5CF6",
  other: "#6B7280",
};

const WIN_CATEGORY_LABELS: Record<string, string> = {
  first_client: "First Client",
  mate_launch: "MATE Launch",
  revenue: "Revenue",
  breakthrough: "Breakthrough",
  other: "Other",
};

const PHASE_OPTIONS = [
  { value: "", label: "All Phases" },
  { value: "mate_build", label: "MATE Build" },
  { value: "icp", label: "ICP" },
  { value: "vsl", label: "VSL" },
  { value: "community", label: "Community" },
  { value: "technical", label: "Technical" },
  { value: "other", label: "Other" },
];

const PRIORITY_OPTIONS = [
  { value: "", label: "All Priorities" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
];

const WIN_CATEGORY_OPTIONS = [
  { value: "first_client", label: "First Client" },
  { value: "mate_launch", label: "MATE Launch" },
  { value: "revenue", label: "Revenue" },
  { value: "breakthrough", label: "Breakthrough" },
  { value: "other", label: "Other" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Add Win Modal ────────────────────────────────────────────────────────────

interface AddWinModalProps {
  onClose: () => void;
  onAdded: (win: Win) => void;
}

function AddWinModal({ onClose, onAdded }: AddWinModalProps) {
  const [studentName, setStudentName] = useState("");
  const [winText, setWinText] = useState("");
  const [category, setCategory] = useState("other");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!winText.trim()) {
      setError("Win description is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/wins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_name: studentName.trim() || null,
          win_text: winText.trim(),
          category,
          source: "manual",
          featured: false,
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to add win");
      }
      const win = (await res.json()) as Win;
      onAdded(win);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-win-title"
    >
      <div
        className="w-full max-w-md rounded-xl p-6"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2
            id="add-win-title"
            className="text-lg font-semibold"
            style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}
          >
            🏆 Log a Win
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg"
            style={{ color: "var(--text-muted)" }}
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Student name */}
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Student Name <span style={{ color: "var(--text-muted)" }}>(optional)</span>
            </label>
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="e.g. Jane D."
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: "var(--card-elevated)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                outline: "none",
              }}
            />
          </div>

          {/* Win text */}
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              What was the win? <span style={{ color: "#EF4444" }}>*</span>
            </label>
            <textarea
              value={winText}
              onChange={(e) => setWinText(e.target.value)}
              placeholder="e.g. Landed their first client at $500/month after completing the MATE module!"
              rows={3}
              className="w-full px-3 py-2 rounded-lg text-sm resize-none"
              style={{
                backgroundColor: "var(--card-elevated)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                outline: "none",
                lineHeight: "1.55",
              }}
            />
          </div>

          {/* Category */}
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: "var(--card-elevated)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                outline: "none",
              }}
            >
              {WIN_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-sm" style={{ color: "#EF4444" }}>
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium"
              style={{
                backgroundColor: "var(--card-elevated)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-opacity"
              style={{
                backgroundColor: "var(--accent)",
                color: "var(--text-primary)",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
              {submitting ? "Logging…" : "Log Win"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CommunityPage() {
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null);
  const [friction, setFriction] = useState<FrictionItem[]>([]);
  const [frictionTotal, setFrictionTotal] = useState(0);
  const [wins, setWins] = useState<Win[]>([]);
  const [loading, setLoading] = useState(true);
  const [frictionLoading, setFrictionLoading] = useState(false);

  // Friction filters
  const [filterPriority, setFilterPriority] = useState("");
  const [filterPhase, setFilterPhase] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Friction sort
  const [sortField, setSortField] = useState<SortField>("occurrence_count");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Resolving state
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [featuringId, setFeaturingId] = useState<string | null>(null);

  // Add win modal
  const [showAddWin, setShowAddWin] = useState(false);

  const fetchFriction = useCallback(async () => {
    setFrictionLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (filterPriority) params.set("priority", filterPriority);
      if (filterPhase) params.set("phase", filterPhase);
      if (filterStatus) params.set("status", filterStatus);

      const res = await fetch(`/api/friction?${params}`);
      const data = (await res.json()) as { friction: FrictionItem[]; total: number };
      setFriction(data.friction ?? []);
      setFrictionTotal(data.total ?? 0);
    } catch (err) {
      console.error("[community] friction fetch failed:", err);
    } finally {
      setFrictionLoading(false);
    }
  }, [filterPriority, filterPhase, filterStatus]);

  const fetchInitial = useCallback(async () => {
    setLoading(true);
    try {
      const [metricsRes, winsRes] = await Promise.all([
        fetch("/api/metrics/snapshot").then((r) => r.json()),
        fetch("/api/wins?limit=50").then((r) => r.json()),
      ]);
      setMetrics(metricsRes as MetricsSnapshot);
      setWins((winsRes as { wins: Win[] }).wins ?? []);
    } catch (err) {
      console.error("[community] initial fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

  useEffect(() => {
    fetchFriction();
  }, [fetchFriction]);

  const handleResolveFriction = async (id: string) => {
    setResolvingId(id);
    try {
      await fetch(`/api/friction/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      });
      setFriction((prev) =>
        prev.map((f) => (f.id === id ? { ...f, status: "resolved" as const } : f))
      );
    } finally {
      setResolvingId(null);
    }
  };

  const handleToggleFeatured = async (win: Win) => {
    setFeaturingId(win.id);
    try {
      const newFeatured = win.featured === 0 ? 1 : 0;
      await fetch(`/api/wins/${win.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featured: newFeatured === 1 }),
      });
      setWins((prev) => prev.map((w) => (w.id === win.id ? { ...w, featured: newFeatured } : w)));
    } finally {
      setFeaturingId(null);
    }
  };

  const handleSortChange = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  // Client-side sort
  const sortedFriction = [...friction].sort((a, b) => {
    const mult = sortDir === "asc" ? 1 : -1;
    if (sortField === "occurrence_count") {
      return (a.occurrence_count - b.occurrence_count) * mult;
    }
    if (sortField === "priority") {
      const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return ((order[a.priority] ?? 3) - (order[b.priority] ?? 3)) * mult;
    }
    if (sortField === "created_at") {
      return (
        (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * mult
      );
    }
    return 0;
  });

  function SortButton({ field, label }: { field: SortField; label: string }) {
    const active = sortField === field;
    return (
      <button
        onClick={() => handleSortChange(field)}
        className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors"
        style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      >
        {label}
        {active ? (
          sortDir === "asc" ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )
        ) : (
          <ChevronDown className="w-3 h-3" style={{ opacity: 0.3 }} />
        )}
      </button>
    );
  }

  if (loading) {
    return (
      <div className="p-4 md:p-8 flex items-center justify-center" style={{ minHeight: "60vh" }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Loading community data…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      {/* ── Header ── */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl" aria-hidden>🌊</span>
          <h1
            className="text-2xl md:text-3xl font-bold"
            style={{
              fontFamily: "var(--font-heading)",
              color: "var(--text-primary)",
              letterSpacing: "-1.5px",
            }}
          >
            Community Intelligence
          </h1>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
          Monitor community health, remove friction, and celebrate wins.
        </p>
      </div>

      {/* ── Top Stats ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Active Members */}
        <div
          className="rounded-xl p-5"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "#3B82F620", color: "#3B82F6" }}
            >
              <Users className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              Active Members
            </p>
          </div>
          <div
            className="text-3xl font-bold"
            style={{
              fontFamily: "var(--font-heading)",
              color: "var(--text-primary)",
              letterSpacing: "-1px",
            }}
          >
            {metrics?.snapshot?.active_members ?? "—"}
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            MEE community this week
          </p>
        </div>

        {/* Avg Course Completion */}
        <div
          className="rounded-xl p-5"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "#8B5CF620", color: "#8B5CF6" }}
            >
              <Trophy className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              Avg Course Completion
            </p>
          </div>
          <div
            className="text-3xl font-bold"
            style={{
              fontFamily: "var(--font-heading)",
              color: "var(--text-muted)",
              letterSpacing: "-1px",
            }}
          >
            —
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Coming soon
          </p>
        </div>

        {/* At-Risk Students */}
        <div
          className="rounded-xl p-5"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "#EF444420", color: "#EF4444" }}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              At-Risk Students
            </p>
          </div>
          <div
            className="text-3xl font-bold"
            style={{
              fontFamily: "var(--font-heading)",
              color: "var(--text-primary)",
              letterSpacing: "-1px",
            }}
          >
            0
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Connect Discord to track
          </p>
        </div>
      </div>

      {/* ── Friction Dashboard ── */}
      <div
        className="rounded-xl overflow-hidden mb-8"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        {/* Section header + filters */}
        <div
          className="px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="accent-line" />
              <h2
                className="text-base font-semibold flex items-center gap-2"
                style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}
              >
                <AlertTriangle className="w-4 h-4" style={{ color: "#EF4444" }} />
                Friction Log
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "var(--card-elevated)", color: "var(--text-muted)" }}
                >
                  {frictionTotal}
                </span>
              </h2>
            </div>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
              {[
                { value: filterPriority, setter: setFilterPriority, options: PRIORITY_OPTIONS },
                { value: filterPhase, setter: setFilterPhase, options: PHASE_OPTIONS },
                { value: filterStatus, setter: setFilterStatus, options: STATUS_OPTIONS },
              ].map((filter, i) => (
                <select
                  key={i}
                  value={filter.value}
                  onChange={(e) => filter.setter(e.target.value)}
                  className="text-xs px-2.5 py-1.5 rounded-lg"
                  style={{
                    backgroundColor: "var(--card-elevated)",
                    border: "1px solid var(--border)",
                    color: "var(--text-secondary)",
                    outline: "none",
                  }}
                >
                  {filter.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {frictionLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
            </div>
          ) : sortedFriction.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-3xl mb-2">🎉</div>
              <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                No friction items match your filters.
              </p>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                {filterPriority || filterPhase || filterStatus
                  ? "Try clearing some filters."
                  : "All clear!"}
              </p>
            </div>
          ) : (
            <table className="w-full" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th
                    className="text-left px-5 py-3 w-6"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <SortButton field="priority" label="P" />
                  </th>
                  <th
                    className="text-left px-3 py-3"
                    style={{ color: "var(--text-muted)", fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}
                  >
                    Issue
                  </th>
                  <th
                    className="text-left px-3 py-3 hidden md:table-cell"
                    style={{ color: "var(--text-muted)", fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}
                  >
                    Phase
                  </th>
                  <th
                    className="text-left px-3 py-3 hidden lg:table-cell"
                    style={{ color: "var(--text-muted)", fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}
                  >
                    Tool
                  </th>
                  <th
                    className="text-left px-3 py-3"
                  >
                    <SortButton field="occurrence_count" label="Count" />
                  </th>
                  <th
                    className="text-left px-3 py-3"
                    style={{ color: "var(--text-muted)", fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}
                  >
                    Status
                  </th>
                  <th
                    className="text-right px-5 py-3"
                    style={{ color: "var(--text-muted)", fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}
                  >
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedFriction.map((item, i) => (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: i < sortedFriction.length - 1 ? "1px solid var(--border)" : "none",
                    }}
                  >
                    {/* Priority dot */}
                    <td className="px-5 py-3">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{
                          backgroundColor: PRIORITY_COLORS[item.priority] ?? "#6B7280",
                        }}
                        title={item.priority}
                      />
                    </td>

                    {/* Issue */}
                    <td className="px-3 py-3" style={{ maxWidth: "300px" }}>
                      <p
                        className="text-sm font-medium mb-0.5"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {item.issue_title}
                      </p>
                      {item.suggested_fix && (
                        <p
                          className="text-xs italic"
                          style={{ color: "var(--text-muted)", lineHeight: "1.4" }}
                        >
                          💡 {item.suggested_fix}
                        </p>
                      )}
                    </td>

                    {/* Phase */}
                    <td className="px-3 py-3 hidden md:table-cell">
                      {item.phase ? (
                        <span
                          className="text-xs px-2 py-1 rounded-full"
                          style={{
                            backgroundColor: "var(--card-elevated)",
                            color: "var(--text-secondary)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          {item.phase.replace(/_/g, " ")}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>—</span>
                      )}
                    </td>

                    {/* Tool */}
                    <td
                      className="px-3 py-3 text-sm hidden lg:table-cell"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {item.tool_involved ?? "—"}
                    </td>

                    {/* Count */}
                    <td className="px-3 py-3">
                      <span
                        className="text-sm font-semibold"
                        style={{
                          color:
                            item.occurrence_count >= 5
                              ? "#EF4444"
                              : item.occurrence_count >= 3
                              ? "#F59E0B"
                              : "var(--text-secondary)",
                        }}
                      >
                        {item.occurrence_count}×
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-3">
                      <span
                        className="text-xs px-2 py-1 rounded-full font-medium"
                        style={{
                          backgroundColor: `${STATUS_COLORS[item.status] ?? "#6B7280"}18`,
                          color: STATUS_COLORS[item.status] ?? "#6B7280",
                        }}
                      >
                        {STATUS_LABELS[item.status] ?? item.status}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="px-5 py-3 text-right">
                      {item.status !== "resolved" ? (
                        <button
                          onClick={() => handleResolveFriction(item.id)}
                          disabled={resolvingId === item.id}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 ml-auto transition-opacity"
                          style={{
                            backgroundColor: "#10B98118",
                            color: "#10B981",
                            border: "1px solid #10B98130",
                            opacity: resolvingId === item.id ? 0.6 : 1,
                          }}
                          aria-label={`Resolve: ${item.issue_title}`}
                        >
                          {resolvingId === item.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <CheckCircle className="w-3 h-3" />
                          )}
                          Resolve
                        </button>
                      ) : (
                        <span
                          className="text-xs"
                          style={{ color: "#10B981" }}
                        >
                          ✓ Resolved
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Student Wins ── */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <div className="accent-line" />
            <h2
              className="text-base font-semibold flex items-center gap-2"
              style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}
            >
              <span>🏆</span>
              Student Wins
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "var(--card-elevated)", color: "var(--text-muted)" }}
              >
                {wins.length}
              </span>
            </h2>
          </div>
          <button
            onClick={() => setShowAddWin(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
            style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
          >
            <Plus className="w-4 h-4" />
            Add Win
          </button>
        </div>

        <div className="p-5">
          {wins.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">🌟</div>
              <p className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                No wins logged yet
              </p>
              <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
                Start celebrating your students&rsquo; wins!
              </p>
              <button
                onClick={() => setShowAddWin(true)}
                className="text-sm font-medium px-4 py-2 rounded-lg"
                style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
              >
                Log First Win
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {wins.map((win) => {
                const catColor = WIN_CATEGORY_COLORS[win.category ?? "other"] ?? "#6B7280";
                const catLabel = WIN_CATEGORY_LABELS[win.category ?? "other"] ?? "Other";
                return (
                  <div
                    key={win.id}
                    className="rounded-xl p-4 flex flex-col gap-3"
                    style={{
                      backgroundColor: "var(--card-elevated)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {/* Avatar */}
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0"
                          style={{ backgroundColor: `${catColor}20`, color: catColor }}
                          aria-hidden
                        >
                          {(win.student_name ?? "A")[0].toUpperCase()}
                        </div>
                        <div>
                          <p
                            className="text-sm font-semibold"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {win.student_name ?? "Anonymous"}
                          </p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {formatDate(win.posted_at)}
                          </p>
                        </div>
                      </div>

                      {/* Feature toggle */}
                      <button
                        onClick={() => handleToggleFeatured(win)}
                        disabled={featuringId === win.id}
                        className="p-1.5 rounded-lg transition-all"
                        style={{
                          color: win.featured === 1 ? "#D97706" : "var(--text-muted)",
                          backgroundColor:
                            win.featured === 1 ? "#D9770618" : "transparent",
                        }}
                        title={win.featured === 1 ? "Unfeature" : "Feature"}
                        aria-label={win.featured === 1 ? "Unfeature win" : "Feature win"}
                      >
                        {featuringId === win.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Star
                            className="w-4 h-4"
                            style={{ fill: win.featured === 1 ? "#D97706" : "none" }}
                          />
                        )}
                      </button>
                    </div>

                    {/* Win text */}
                    <p
                      className="text-sm"
                      style={{ color: "var(--text-secondary)", lineHeight: "1.55" }}
                    >
                      {win.win_text}
                    </p>

                    {/* Category badge */}
                    {win.category && (
                      <span
                        className="text-xs px-2.5 py-1 rounded-full font-medium self-start"
                        style={{
                          backgroundColor: `${catColor}18`,
                          color: catColor,
                        }}
                      >
                        {catLabel}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Add Win Modal ── */}
      {showAddWin && (
        <AddWinModal
          onClose={() => setShowAddWin(false)}
          onAdded={(win) => setWins((prev) => [win, ...prev])}
        />
      )}
    </div>
  );
}
