"use client";

/**
 * Vessel Command Center — Main Dashboard
 * The first thing Sarah & Bobby see every morning.
 * Calm, spacious, human-centered briefing on what matters most.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Users,
  AlertTriangle,
  Trophy,
  CheckCircle,
  Clock,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  ChevronRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StripeSummary {
  mrr: number;
  activeSubscriptions: number;
  pendingPayout: number;
  isLive: boolean;
}

interface MetricsSnapshot {
  snapshot: {
    active_members: number | null;
    mrr: number | null;
    date: string;
  } | null;
}

interface FrictionStats {
  highPriorityOpen: number;
  total: number;
}

interface WinsStats {
  thisWeek: number;
  total: number;
}

interface FrictionItem {
  id: string;
  issue_title: string;
  phase: string | null;
  occurrence_count: number;
  suggested_fix: string | null;
  priority: string;
  status: string;
  description: string;
  tool_involved: string | null;
}

interface Win {
  id: string;
  student_name: string | null;
  win_text: string;
  category: string | null;
  posted_at: string;
  featured: number;
}

interface Todo {
  id: string;
  title: string;
  description: string | null;
  assignee: "sarah" | "bobby" | "both";
  priority: "high" | "medium" | "low";
  status: "open" | "in_progress" | "done";
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

interface MtmItem {
  id: string;
  item_name: string;
  category: string;
  status: "not_started" | "in_progress" | "done";
  owner: string | null;
  notes: string | null;
}

interface MtmData {
  items: MtmItem[];
  completionPct: number;
  byCategory: Record<string, { total: number; done: number; pct: number }>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

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

const PRIORITY_COLORS: Record<string, string> = {
  high: "#EF4444",
  medium: "#F59E0B",
  low: "#10B981",
};

const ASSIGNEE_COLORS: Record<string, string> = {
  sarah: "#8B5CF6",
  bobby: "#3B82F6",
  both: "#D97706",
};

const MTM_STATUS_COLORS: Record<string, string> = {
  done: "#10B981",
  in_progress: "#F59E0B",
  not_started: "#6B7280",
};

const MTM_STATUS_SYMBOLS: Record<string, string> = {
  done: "✓",
  in_progress: "⟳",
  not_started: "○",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toLocaleString()}`;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  accent,
  badge,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  accent: string;
  badge?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3"
      style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-start justify-between">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${accent}20`, color: accent }}
        >
          {icon}
        </div>
        {badge}
      </div>
      <div>
        <div
          className="text-2xl font-bold mb-0.5"
          style={{
            fontFamily: "var(--font-heading)",
            color: "var(--text-primary)",
            letterSpacing: "-1px",
          }}
        >
          {value}
        </div>
        <div className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          {title}
        </div>
        {subtitle && (
          <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  icon,
  href,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  href?: string;
  children: React.ReactNode;
}) {
  return (
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
            {icon}
            {title}
          </h2>
        </div>
        {href && (
          <Link
            href={href}
            className="text-sm font-medium flex items-center gap-1 transition-opacity hover:opacity-80"
            style={{ color: "var(--accent)" }}
          >
            View all
            <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [stripe, setStripe] = useState<StripeSummary | null>(null);
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null);
  const [frictionStats, setFrictionStats] = useState<FrictionStats | null>(null);
  const [winsStats, setWinsStats] = useState<WinsStats | null>(null);
  const [frictionItems, setFrictionItems] = useState<FrictionItem[]>([]);
  const [wins, setWins] = useState<Win[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [mtm, setMtm] = useState<MtmData | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [
        stripeRes,
        metricsRes,
        frictionStatsRes,
        winsStatsRes,
        frictionRes,
        winsRes,
        todosRes,
        mtmRes,
      ] = await Promise.all([
        fetch("/api/stripe/summary").then((r) => r.json()),
        fetch("/api/metrics/snapshot").then((r) => r.json()),
        fetch("/api/friction/stats").then((r) => r.json()),
        fetch("/api/wins/stats").then((r) => r.json()),
        fetch("/api/friction?priority=high&status=open&limit=3").then((r) => r.json()),
        fetch("/api/wins?limit=5").then((r) => r.json()),
        fetch("/api/todos?status=open&limit=5").then((r) => r.json()),
        fetch("/api/mtm").then((r) => r.json()),
      ]);

      setStripe(stripeRes as StripeSummary);
      setMetrics(metricsRes as MetricsSnapshot);
      setFrictionStats(frictionStatsRes as FrictionStats);
      setWinsStats(winsStatsRes as WinsStats);
      setFrictionItems((frictionRes as { friction: FrictionItem[] }).friction ?? []);
      setWins((winsRes as { wins: Win[] }).wins ?? []);
      setTodos((todosRes as { todos: Todo[] }).todos ?? []);
      setMtm(mtmRes as MtmData);
    } catch (err) {
      console.error("[dashboard] fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleResolveFriction = async (id: string) => {
    setResolvingId(id);
    try {
      await fetch(`/api/friction/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      });
      setFrictionItems((prev) => prev.filter((f) => f.id !== id));
      setFrictionStats((prev) =>
        prev ? { ...prev, highPriorityOpen: Math.max(0, prev.highPriorityOpen - 1) } : prev
      );
    } finally {
      setResolvingId(null);
    }
  };

  const handleMarkDone = async (id: string) => {
    setCompletingId(id);
    try {
      await fetch(`/api/todos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      setTodos((prev) => prev.filter((t) => t.id !== id));
    } finally {
      setCompletingId(null);
    }
  };

  // Group MTM items by category for compact view
  const mtmByCategory = (mtm?.items ?? []).reduce<Record<string, MtmItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="p-4 md:p-8 flex items-center justify-center" style={{ minHeight: "60vh" }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Loading command center…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      {/* ── Header ── */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl" aria-hidden>⚓</span>
            <h1
              className="text-2xl md:text-3xl font-bold"
              style={{
                fontFamily: "var(--font-heading)",
                color: "var(--text-primary)",
                letterSpacing: "-1.5px",
              }}
            >
              Vessel Command Center
            </h1>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            {greeting()}, Sarah &amp; Bobby. Here&rsquo;s where things stand today.
          </p>
        </div>
        <button
          onClick={() => fetchAll()}
          aria-label="Refresh dashboard"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all flex-shrink-0"
          style={{
            backgroundColor: "var(--card-elevated)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
          }}
        >
          <RefreshCw className="w-4 h-4" />
          <span className="hidden md:inline">Refresh</span>
        </button>
      </div>

      {/* ── Row 1 — Key Metrics ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Monthly Revenue"
          value={stripe ? formatCurrency(stripe.mrr) : "—"}
          subtitle={
            stripe?.activeSubscriptions
              ? `${stripe.activeSubscriptions} active subscribers`
              : undefined
          }
          icon={<TrendingUp className="w-5 h-5" />}
          accent="#D97706"
          badge={
            stripe && !stripe.isLive ? (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}
              >
                Demo
              </span>
            ) : undefined
          }
        />

        <MetricCard
          title="Active Members"
          value={metrics?.snapshot?.active_members?.toString() ?? "—"}
          subtitle="MEE community"
          icon={<Users className="w-5 h-5" />}
          accent="#3B82F6"
        />

        <MetricCard
          title="Open Friction"
          value={frictionStats?.highPriorityOpen?.toString() ?? "—"}
          subtitle="High priority issues"
          icon={<AlertTriangle className="w-5 h-5" />}
          accent="#EF4444"
        />

        <MetricCard
          title="Wins This Week"
          value={winsStats?.thisWeek?.toString() ?? "—"}
          subtitle="Student wins logged"
          icon={<Trophy className="w-5 h-5" />}
          accent="#10B981"
        />
      </div>

      {/* ── Row 2 — Two Columns ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6">

        {/* ── Left Column (~60%) ── */}
        <div className="lg:col-span-3 flex flex-col gap-4 md:gap-6">

          {/* Priority Friction */}
          <SectionCard
            title="Priority Friction"
            icon={<AlertTriangle className="w-4 h-4" style={{ color: "#EF4444" }} />}
            href="/community"
          >
            {frictionItems.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-3xl mb-2">🎉</div>
                <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  All clear!
                </p>
                <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                  No high-priority friction items right now.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {frictionItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg p-4"
                    style={{
                      backgroundColor: "var(--card-elevated)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
                          style={{ backgroundColor: PRIORITY_COLORS[item.priority] ?? "#6B7280" }}
                        />
                        <p
                          className="font-semibold text-sm"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {item.issue_title}
                        </p>
                      </div>
                      <button
                        onClick={() => handleResolveFriction(item.id)}
                        disabled={resolvingId === item.id}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium flex-shrink-0 flex items-center gap-1 transition-opacity"
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
                    </div>

                    <div
                      className="flex items-center gap-3 text-xs mb-2 flex-wrap"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {item.phase && (
                        <span
                          className="px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: "var(--card)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          {item.phase.replace(/_/g, " ")}
                        </span>
                      )}
                      <span>{item.occurrence_count}× reported</span>
                    </div>

                    {item.suggested_fix && (
                      <p
                        className="text-xs italic pl-3 pt-2"
                        style={{
                          color: "var(--text-secondary)",
                          borderLeft: "2px solid var(--accent)",
                          lineHeight: "1.5",
                        }}
                      >
                        💡 {item.suggested_fix}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Wins Feed */}
          <SectionCard
            title="Student Wins"
            icon={<Sparkles className="w-4 h-4" style={{ color: "#D97706" }} />}
            href="/community"
          >
            {wins.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-3xl mb-2">📝</div>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  No wins logged yet.
                </p>
                <Link
                  href="/community"
                  className="inline-block mt-3 text-sm font-medium px-4 py-2 rounded-lg transition-opacity hover:opacity-80"
                  style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
                >
                  Log a Win
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {wins.map((win) => (
                  <div
                    key={win.id}
                    className="flex gap-3 p-3 rounded-lg"
                    style={{
                      backgroundColor: "var(--card-elevated)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {/* Avatar */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0"
                      style={{ backgroundColor: "#D9770620", color: "#D97706" }}
                      aria-hidden
                    >
                      {(win.student_name ?? "A")[0].toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                          className="text-sm font-semibold"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {win.student_name ?? "Anonymous"}
                        </span>
                        {win.category && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                              backgroundColor: `${WIN_CATEGORY_COLORS[win.category] ?? "#6B7280"}20`,
                              color: WIN_CATEGORY_COLORS[win.category] ?? "#6B7280",
                            }}
                          >
                            {WIN_CATEGORY_LABELS[win.category] ?? win.category}
                          </span>
                        )}
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {formatRelativeTime(win.posted_at)}
                        </span>
                      </div>
                      <p
                        className="text-sm"
                        style={{ color: "var(--text-secondary)", lineHeight: "1.55" }}
                      >
                        {win.win_text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* ── Right Column (~40%) ── */}
        <div className="lg:col-span-2 flex flex-col gap-4 md:gap-6">

          {/* My Tasks */}
          <SectionCard
            title="My Tasks"
            icon={<CheckCircle className="w-4 h-4" style={{ color: "#3B82F6" }} />}
            href="/todos"
          >
            {todos.length === 0 ? (
              <div className="text-center py-6">
                <div className="text-2xl mb-2">✅</div>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  No open tasks.
                </p>
                <Link
                  href="/todos"
                  className="inline-block mt-3 text-xs font-medium px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                  style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
                >
                  + New Task
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {todos.map((todo) => {
                  const isOverdue =
                    todo.due_date != null && new Date(todo.due_date) < new Date();
                  return (
                    <div
                      key={todo.id}
                      className="flex items-start gap-3 p-3 rounded-lg"
                      style={{
                        backgroundColor: "var(--card-elevated)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {/* Priority dot */}
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                        style={{
                          backgroundColor: PRIORITY_COLORS[todo.priority] ?? "#6B7280",
                        }}
                        title={`Priority: ${todo.priority}`}
                      />

                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-medium mb-1"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {todo.title}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                              backgroundColor: `${ASSIGNEE_COLORS[todo.assignee] ?? "#6B7280"}20`,
                              color: ASSIGNEE_COLORS[todo.assignee] ?? "#6B7280",
                            }}
                          >
                            {todo.assignee === "both"
                              ? "👥 Both"
                              : todo.assignee === "sarah"
                              ? "👤 Sarah"
                              : "👤 Bobby"}
                          </span>
                          {todo.due_date && (
                            <span
                              className="text-xs flex items-center gap-0.5"
                              style={{ color: isOverdue ? "#EF4444" : "var(--text-muted)" }}
                            >
                              <Clock className="w-3 h-3" />
                              {new Date(todo.due_date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                              {isOverdue && " ⚠"}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Mark done */}
                      <button
                        onClick={() => handleMarkDone(todo.id)}
                        disabled={completingId === todo.id}
                        className="flex-shrink-0 p-1.5 rounded-lg transition-opacity"
                        style={{
                          backgroundColor: "#10B98118",
                          color: "#10B981",
                          opacity: completingId === todo.id ? 0.6 : 1,
                        }}
                        title="Mark as done"
                        aria-label={`Mark done: ${todo.title}`}
                      >
                        {completingId === todo.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          {/* MTM Launch Tracker */}
          <SectionCard
            title="MTM Launch"
            icon={<Target className="w-4 h-4" style={{ color: "#8B5CF6" }} />}
            href="/business"
          >
            {!mtm ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
              </div>
            ) : (
              <>
                {/* Progress bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      Overall Progress
                    </span>
                    <span
                      className="text-sm font-bold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {mtm.completionPct}%
                    </span>
                  </div>
                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ backgroundColor: "var(--card-elevated)" }}
                    role="progressbar"
                    aria-valuenow={mtm.completionPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${mtm.completionPct}%`,
                        backgroundColor:
                          mtm.completionPct === 100 ? "#10B981" : "#8B5CF6",
                      }}
                    />
                  </div>
                </div>

                {/* Items grouped by category */}
                <div className="flex flex-col gap-4">
                  {Object.entries(mtmByCategory).map(([cat, items]) => (
                    <div key={cat}>
                      <p
                        className="text-xs font-semibold uppercase tracking-wide mb-2"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {cat.replace(/_/g, " ")}
                      </p>
                      <div className="flex flex-col gap-1">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-2 py-1 text-sm"
                            style={{ borderBottom: "1px solid var(--border)" }}
                          >
                            <span
                              className="text-xs font-bold flex-shrink-0 w-4 text-center"
                              style={{
                                color:
                                  MTM_STATUS_COLORS[item.status] ?? "#6B7280",
                              }}
                            >
                              {MTM_STATUS_SYMBOLS[item.status] ?? "○"}
                            </span>
                            <span
                              className="flex-1"
                              style={{
                                color:
                                  item.status === "done"
                                    ? "var(--text-muted)"
                                    : "var(--text-secondary)",
                                textDecoration:
                                  item.status === "done" ? "line-through" : "none",
                                fontSize: "13px",
                              }}
                            >
                              {item.item_name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {mtm.items.length === 0 && (
                    <p className="text-sm text-center py-4" style={{ color: "var(--text-muted)" }}>
                      No MTM items yet.{" "}
                      <Link href="/business" style={{ color: "var(--accent)" }}>
                        Add items →
                      </Link>
                    </p>
                  )}
                </div>
              </>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
