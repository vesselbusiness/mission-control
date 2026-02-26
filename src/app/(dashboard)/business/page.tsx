"use client";

/**
 * Business Metrics — /business
 * Revenue overview, 30-day MRR trend, and full MTM Launch Tracker.
 * Sarah & Bobby's financial and launch pulse.
 */

import { useEffect, useState, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Target,
  AlertCircle,
  CheckCircle,
  Loader2,
  Plus,
  X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MetricsSummary {
  mrr: number;
  mrrGrowthRate: number;
  churnRate: number;
  clv: number;
  activeMembers: number;
  newMembers: number;
  churnedMembers: number;
  netMemberGrowth: number;
  snapshotDate: string | null;
}

interface StripeSummary {
  mrr: number;
  activeSubscriptions: number;
  pendingPayout: number;
  isLive: boolean;
  cachedAt: string;
}

interface MetricsSnapshot {
  date: string;
  mrr: number | null;
  active_members: number | null;
}

interface MetricsHistory {
  snapshots: MetricsSnapshot[];
  days: number;
  count: number;
}

interface MtmItem {
  id: string;
  item_name: string;
  category: string;
  status: "not_started" | "in_progress" | "done";
  owner: string | null;
  notes: string | null;
  updated_at: string;
}

interface MtmData {
  items: MtmItem[];
  total: number;
  completionPct: number;
  byCategory: Record<string, { total: number; done: number; pct: number }>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MTM_STATUS_COLORS: Record<string, string> = {
  done: "#10B981",
  in_progress: "#F59E0B",
  not_started: "#6B7280",
};

const MTM_STATUS_LABELS: Record<string, string> = {
  done: "Done",
  in_progress: "In Progress",
  not_started: "Not Started",
};

const MTM_OWNER_COLORS: Record<string, string> = {
  sarah: "#8B5CF6",
  bobby: "#3B82F6",
  agent: "#10B981",
};

const MTM_CATEGORY_OPTIONS = [
  { value: "vsl", label: "VSL" },
  { value: "copy", label: "Copy" },
  { value: "landing_page", label: "Landing Page" },
  { value: "email", label: "Email" },
  { value: "other", label: "Other" },
];

const MTM_OWNER_OPTIONS = [
  { value: "", label: "No owner" },
  { value: "sarah", label: "Sarah" },
  { value: "bobby", label: "Bobby" },
  { value: "agent", label: "Agent" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(n: number, compact = false): string {
  if (compact && n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatPct(n: number): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
}

// ─── Add MTM Item Modal ───────────────────────────────────────────────────────

interface AddMtmModalProps {
  onClose: () => void;
  onAdded: (item: MtmItem) => void;
}

function AddMtmModal({ onClose, onAdded }: AddMtmModalProps) {
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("other");
  const [owner, setOwner] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) {
      setError("Item name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/mtm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_name: itemName.trim(),
          category,
          owner: owner || null,
          notes: notes.trim() || null,
          status: "not_started",
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to add item");
      }
      const item = (await res.json()) as MtmItem;
      onAdded(item);
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
      aria-labelledby="add-mtm-title"
    >
      <div
        className="w-full max-w-md rounded-xl p-6"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2
            id="add-mtm-title"
            className="text-lg font-semibold"
            style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}
          >
            🚀 Add Launch Item
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
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Item Name <span style={{ color: "#EF4444" }}>*</span>
            </label>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. Write VSL script opening hook"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: "var(--card-elevated)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                outline: "none",
              }}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
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
                {MTM_CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Owner
              </label>
              <select
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: "var(--card-elevated)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              >
                {MTM_OWNER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Notes <span style={{ color: "var(--text-muted)" }}>(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any context, links, or details…"
              rows={2}
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
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {submitting ? "Adding…" : "Add Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BusinessPage() {
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [stripe, setStripe] = useState<StripeSummary | null>(null);
  const [history, setHistory] = useState<MetricsHistory | null>(null);
  const [mtm, setMtm] = useState<MtmData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingMtmId, setUpdatingMtmId] = useState<string | null>(null);
  const [showAddMtm, setShowAddMtm] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, stripeRes, historyRes, mtmRes] = await Promise.all([
        fetch("/api/metrics/summary").then((r) => r.json()),
        fetch("/api/stripe/summary").then((r) => r.json()),
        fetch("/api/metrics/history?days=30").then((r) => r.json()),
        fetch("/api/mtm").then((r) => r.json()),
      ]);
      setSummary(summaryRes as MetricsSummary);
      setStripe(stripeRes as StripeSummary);
      setHistory(historyRes as MetricsHistory);
      setMtm(mtmRes as MtmData);
    } catch (err) {
      console.error("[business] fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleMtmStatusChange = async (id: string, newStatus: MtmItem["status"]) => {
    setUpdatingMtmId(id);
    try {
      const res = await fetch(`/api/mtm/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const updated = (await res.json()) as MtmItem;
      setMtm((prev) => {
        if (!prev) return prev;
        const items = prev.items.map((i) => (i.id === id ? updated : i));
        const done = items.filter((i) => i.status === "done").length;
        const completionPct = items.length > 0 ? Math.round((done / items.length) * 100) : 0;
        return { ...prev, items, completionPct };
      });
    } finally {
      setUpdatingMtmId(null);
    }
  };

  // Build chart data: keep at most 15 bars, normalize for display
  const chartData = (() => {
    const snaps = history?.snapshots ?? [];
    if (snaps.length === 0) return [];
    // Sample evenly if more than 15
    const step = Math.max(1, Math.ceil(snaps.length / 15));
    const sampled = snaps.filter((_, i) => i % step === 0 || i === snaps.length - 1);
    const maxMrr = Math.max(...sampled.map((s) => s.mrr ?? 0), 1);
    return sampled.map((s) => ({
      date: s.date,
      mrr: s.mrr ?? 0,
      pct: Math.max(2, Math.round(((s.mrr ?? 0) / maxMrr) * 100)),
    }));
  })();

  if (loading) {
    return (
      <div className="p-4 md:p-8 flex items-center justify-center" style={{ minHeight: "60vh" }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Loading business metrics…
          </p>
        </div>
      </div>
    );
  }

  const isDemo = stripe ? !stripe.isLive : true;

  return (
    <div className="p-4 md:p-8">
      {/* ── Header ── */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl" aria-hidden>📈</span>
          <h1
            className="text-2xl md:text-3xl font-bold"
            style={{
              fontFamily: "var(--font-heading)",
              color: "var(--text-primary)",
              letterSpacing: "-1.5px",
            }}
          >
            Business Metrics
          </h1>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
          Revenue, growth, and launch tracker for Vessel Business.
        </p>
      </div>

      {/* ── Demo Mode Banner ── */}
      {isDemo && (
        <div
          className="rounded-xl px-5 py-3 mb-6 flex items-center gap-3"
          style={{
            backgroundColor: "#FEF3C7",
            border: "1px solid #FDE68A",
          }}
          role="alert"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: "#92400E" }} />
          <p className="text-sm" style={{ color: "#92400E" }}>
            <strong>Demo Mode</strong> — Revenue figures are sample data. Add your{" "}
            <code className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: "#FDE68A" }}>
              STRIPE_SECRET_KEY
            </code>{" "}
            to .env.local to connect live Stripe data.
          </p>
        </div>
      )}

      {/* ── Revenue Overview ── */}
      <div className="mb-8">
        <h2
          className="text-base font-semibold mb-4 flex items-center gap-2"
          style={{ fontFamily: "var(--font-heading)", color: "var(--text-secondary)" }}
        >
          <DollarSign className="w-4 h-4" />
          Revenue Overview
        </h2>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {/* MRR — big feature card */}
          <div
            className="lg:col-span-1 rounded-xl p-6 flex flex-col justify-between"
            style={{
              backgroundColor: "var(--card)",
              border: "2px solid var(--accent)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-5"
              style={{ backgroundColor: "var(--accent)", transform: "translate(20%, -20%)" }}
              aria-hidden
            />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4" style={{ color: "var(--accent)" }} />
                <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                  Monthly Recurring Revenue
                </p>
              </div>
              <div
                className="text-4xl font-bold mt-3"
                style={{
                  fontFamily: "var(--font-heading)",
                  color: "var(--accent)",
                  letterSpacing: "-2px",
                }}
              >
                {stripe ? formatCurrency(stripe.mrr) : "—"}
              </div>
            </div>
            {summary && (
              <div className="flex items-center gap-1.5 mt-4">
                {summary.mrrGrowthRate >= 0 ? (
                  <TrendingUp className="w-4 h-4" style={{ color: "#10B981" }} />
                ) : (
                  <TrendingDown className="w-4 h-4" style={{ color: "#EF4444" }} />
                )}
                <span
                  className="text-sm font-semibold"
                  style={{ color: summary.mrrGrowthRate >= 0 ? "#10B981" : "#EF4444" }}
                >
                  {formatPct(summary.mrrGrowthRate)}
                </span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  vs last month
                </span>
              </div>
            )}
          </div>

          {/* Churn Rate */}
          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "#EF444420", color: "#EF4444" }}
              >
                <TrendingDown className="w-4 h-4" />
              </div>
              <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                Churn Rate
              </p>
            </div>
            <div
              className="text-2xl font-bold"
              style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)", letterSpacing: "-1px" }}
            >
              {summary ? `${summary.churnRate.toFixed(1)}%` : "—"}
            </div>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Monthly member churn
            </p>
          </div>

          {/* CLV */}
          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "#10B98120", color: "#10B981" }}
              >
                <Users className="w-4 h-4" />
              </div>
              <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                Customer Lifetime Value
              </p>
            </div>
            <div
              className="text-2xl font-bold"
              style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)", letterSpacing: "-1px" }}
            >
              {summary ? formatCurrency(summary.clv, true) : "—"}
            </div>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Avg revenue per member
            </p>
          </div>

          {/* Growth Rate */}
          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "#3B82F620", color: "#3B82F6" }}
              >
                <TrendingUp className="w-4 h-4" />
              </div>
              <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                Growth Rate MoM
              </p>
            </div>
            <div
              className="text-2xl font-bold"
              style={{
                fontFamily: "var(--font-heading)",
                color:
                  (summary?.mrrGrowthRate ?? 0) >= 0 ? "#10B981" : "#EF4444",
                letterSpacing: "-1px",
              }}
            >
              {summary ? formatPct(summary.mrrGrowthRate) : "—"}
            </div>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              MRR change vs prev snapshot
            </p>
          </div>

          {/* Pending Payout */}
          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "#8B5CF620", color: "#8B5CF6" }}
              >
                <DollarSign className="w-4 h-4" />
              </div>
              <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                Stripe Payout Pending
              </p>
            </div>
            <div
              className="text-2xl font-bold"
              style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)", letterSpacing: "-1px" }}
            >
              {stripe ? formatCurrency(stripe.pendingPayout, true) : "—"}
            </div>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Awaiting bank transfer
            </p>
          </div>

          {/* Active Subscribers */}
          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "#D9770620", color: "#D97706" }}
              >
                <Users className="w-4 h-4" />
              </div>
              <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                Active Subscribers
              </p>
            </div>
            <div
              className="text-2xl font-bold"
              style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)", letterSpacing: "-1px" }}
            >
              {stripe?.activeSubscriptions ?? "—"}
            </div>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Active Stripe subscriptions
            </p>
          </div>
        </div>
      </div>

      {/* ── 30-Day MRR Trend ── */}
      <div
        className="rounded-xl overflow-hidden mb-8"
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
              <TrendingUp className="w-4 h-4" style={{ color: "var(--accent)" }} />
              30-Day MRR Trend
            </h2>
          </div>
          {history && history.count > 0 && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {history.count} data point{history.count !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="p-5">
          {chartData.length === 0 ? (
            <div className="text-center py-8">
              <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                No historical data yet. Metrics snapshots will appear here.
              </p>
            </div>
          ) : (
            <>
              {/* Bar chart */}
              <div
                className="flex items-end gap-1.5"
                style={{ height: "120px" }}
                role="img"
                aria-label="30-day MRR trend chart"
              >
                {chartData.map((pt, i) => (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center justify-end gap-1 group"
                    title={`${pt.date}: ${formatCurrency(pt.mrr)}`}
                  >
                    <div
                      className="w-full rounded-t-sm transition-all duration-200"
                      style={{
                        height: `${pt.pct}%`,
                        backgroundColor:
                          i === chartData.length - 1
                            ? "var(--accent)"
                            : "var(--card-elevated)",
                        border: "1px solid var(--border)",
                        minHeight: "4px",
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* X-axis labels (first, mid, last) */}
              <div
                className="flex justify-between mt-2"
                style={{ color: "var(--text-muted)", fontSize: "11px" }}
                aria-hidden
              >
                <span>{chartData[0]?.date ?? ""}</span>
                <span>{formatCurrency(Math.max(...chartData.map((d) => d.mrr)), true)} peak</span>
                <span>{chartData[chartData.length - 1]?.date ?? ""}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── MTM Launch Tracker ── */}
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
              <Target className="w-4 h-4" style={{ color: "#8B5CF6" }} />
              MTM Launch Tracker
            </h2>
          </div>
          <button
            onClick={() => setShowAddMtm(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
            style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        </div>

        {/* Progress bar */}
        {mtm && (
          <div
            className="px-5 py-4"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                {mtm.items.filter((i) => i.status === "done").length} / {mtm.total} items complete
              </span>
              <span
                className="text-sm font-bold"
                style={{ color: mtm.completionPct === 100 ? "#10B981" : "var(--text-primary)" }}
              >
                {mtm.completionPct}%
              </span>
            </div>
            <div
              className="h-2.5 rounded-full overflow-hidden"
              style={{ backgroundColor: "var(--card-elevated)" }}
              role="progressbar"
              aria-valuenow={mtm.completionPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`MTM Launch progress: ${mtm.completionPct}%`}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${mtm.completionPct}%`,
                  backgroundColor: mtm.completionPct === 100 ? "#10B981" : "#8B5CF6",
                }}
              />
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          {!mtm ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
            </div>
          ) : mtm.items.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-3xl mb-2">🚀</div>
              <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                No launch items yet
              </p>
              <p className="text-sm mt-1 mb-4" style={{ color: "var(--text-muted)" }}>
                Build your Message to Market launch checklist.
              </p>
              <button
                onClick={() => setShowAddMtm(true)}
                className="text-sm font-medium px-4 py-2 rounded-lg"
                style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
              >
                Add First Item
              </button>
            </div>
          ) : (
            <table className="w-full" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Item", "Category", "Owner", "Status", "Notes"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-5 py-3"
                      style={{
                        color: "var(--text-muted)",
                        fontSize: "12px",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mtm.items.map((item, i) => (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: i < mtm.items.length - 1 ? "1px solid var(--border)" : "none",
                      opacity: item.status === "done" ? 0.65 : 1,
                    }}
                  >
                    {/* Item name */}
                    <td className="px-5 py-3" style={{ maxWidth: "240px" }}>
                      <p
                        className="text-sm font-medium"
                        style={{
                          color: "var(--text-primary)",
                          textDecoration: item.status === "done" ? "line-through" : "none",
                        }}
                      >
                        {item.item_name}
                      </p>
                    </td>

                    {/* Category */}
                    <td className="px-5 py-3">
                      <span
                        className="text-xs px-2 py-1 rounded-full"
                        style={{
                          backgroundColor: "var(--card-elevated)",
                          color: "var(--text-secondary)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        {item.category.replace(/_/g, " ")}
                      </span>
                    </td>

                    {/* Owner */}
                    <td className="px-5 py-3">
                      {item.owner ? (
                        <span
                          className="text-xs px-2 py-1 rounded-full font-medium capitalize"
                          style={{
                            backgroundColor: `${MTM_OWNER_COLORS[item.owner] ?? "#6B7280"}18`,
                            color: MTM_OWNER_COLORS[item.owner] ?? "#6B7280",
                          }}
                        >
                          {item.owner}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>—</span>
                      )}
                    </td>

                    {/* Status — inline dropdown */}
                    <td className="px-5 py-3">
                      <div className="relative inline-block">
                        {updatingMtmId === item.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--text-muted)" }} />
                        ) : (
                          <select
                            value={item.status}
                            onChange={(e) =>
                              handleMtmStatusChange(item.id, e.target.value as MtmItem["status"])
                            }
                            aria-label={`Status for ${item.item_name}`}
                            className="text-xs pl-2.5 pr-6 py-1.5 rounded-lg font-medium appearance-none"
                            style={{
                              backgroundColor: `${MTM_STATUS_COLORS[item.status] ?? "#6B7280"}18`,
                              color: MTM_STATUS_COLORS[item.status] ?? "#6B7280",
                              border: `1px solid ${MTM_STATUS_COLORS[item.status] ?? "#6B7280"}30`,
                              outline: "none",
                              cursor: "pointer",
                            }}
                          >
                            {(["not_started", "in_progress", "done"] as const).map((s) => (
                              <option key={s} value={s}>
                                {MTM_STATUS_LABELS[s]}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </td>

                    {/* Notes */}
                    <td
                      className="px-5 py-3 text-sm hidden md:table-cell"
                      style={{ color: "var(--text-muted)", maxWidth: "200px" }}
                    >
                      <span
                        style={{
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitLineClamp: 1,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {item.notes ?? "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add MTM Modal */}
      {showAddMtm && (
        <AddMtmModal
          onClose={() => setShowAddMtm(false)}
          onAdded={(item) =>
            setMtm((prev) => {
              if (!prev) return prev;
              const items = [item, ...prev.items];
              const done = items.filter((i) => i.status === "done").length;
              const completionPct = items.length > 0 ? Math.round((done / items.length) * 100) : 0;
              return { ...prev, items, total: prev.total + 1, completionPct };
            })
          }
        />
      )}
    </div>
  );
}
