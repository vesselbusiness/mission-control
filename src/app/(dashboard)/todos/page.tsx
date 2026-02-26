"use client";

/**
 * To-Do List — /todos
 * Full task management for Sarah and Bobby.
 * Clean, prioritized, with clear ownership and due dates.
 */

import { useEffect, useState, useCallback } from "react";
import {
  CheckCircle,
  Clock,
  Trash2,
  Plus,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
  Play,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  updated_at: string;
}

type AssigneeFilter = "all" | "sarah" | "bobby" | "both";
type StatusFilter = "open" | "in_progress" | "done";

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  high: "#EF4444",
  medium: "#F59E0B",
  low: "#10B981",
};

const PRIORITY_LABELS: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const ASSIGNEE_COLORS: Record<string, string> = {
  sarah: "#8B5CF6",
  bobby: "#3B82F6",
  both: "#D97706",
};

const ASSIGNEE_LABELS: Record<string, string> = {
  sarah: "👤 Sarah",
  bobby: "👤 Bobby",
  both: "👥 Both",
};

const STATUS_COLORS: Record<string, string> = {
  open: "#6B7280",
  in_progress: "#F59E0B",
  done: "#10B981",
};

const PRIORITY_SORT_ORDER: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isOverdue(due: string | null): boolean {
  if (!due) return false;
  return new Date(due) < new Date();
}

// ─── New Task Modal ───────────────────────────────────────────────────────────

interface NewTaskModalProps {
  onClose: () => void;
  onCreated: (todo: Todo) => void;
}

function NewTaskModal({ onClose, onCreated }: NewTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState<"sarah" | "bobby" | "both">("both");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          assignee,
          priority,
          status: "open",
          due_date: dueDate || null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to create task");
      }
      const todo = (await res.json()) as Todo;
      onCreated(todo);
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
      aria-labelledby="new-task-title"
    >
      <div
        className="w-full max-w-md rounded-xl p-6"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2
            id="new-task-title"
            className="text-lg font-semibold"
            style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}
          >
            ✅ New Task
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
          {/* Title */}
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Title <span style={{ color: "#EF4444" }}>*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Write email sequence for MATE launch"
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

          {/* Description */}
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Description{" "}
              <span style={{ color: "var(--text-muted)" }}>(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any details, context, or links…"
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

          {/* Assignee + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Assign to
              </label>
              <select
                value={assignee}
                onChange={(e) => setAssignee(e.target.value as typeof assignee)}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: "var(--card-elevated)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              >
                <option value="sarah">Sarah</option>
                <option value="bobby">Bobby</option>
                <option value="both">Both</option>
              </select>
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as typeof priority)}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: "var(--card-elevated)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              >
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Due Date{" "}
              <span style={{ color: "var(--text-muted)" }}>(optional)</span>
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: "var(--card-elevated)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                outline: "none",
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
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {submitting ? "Creating…" : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Todo Card ────────────────────────────────────────────────────────────────

interface TodoCardProps {
  todo: Todo;
  onMarkInProgress: (id: string) => void;
  onMarkDone: (id: string) => void;
  onDelete: (id: string) => void;
  actingId: string | null;
}

function TodoCard({ todo, onMarkInProgress, onMarkDone, onDelete, actingId }: TodoCardProps) {
  const busy = actingId === todo.id;
  const overdue = isOverdue(todo.due_date);

  return (
    <div
      className="rounded-xl p-4 flex gap-3"
      style={{
        backgroundColor: "var(--card)",
        border: `1px solid ${overdue && todo.status !== "done" ? "#EF444430" : "var(--border)"}`,
      }}
    >
      {/* Priority dot */}
      <div
        className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5"
        style={{ backgroundColor: PRIORITY_COLORS[todo.priority] ?? "#6B7280" }}
        title={`Priority: ${PRIORITY_LABELS[todo.priority] ?? todo.priority}`}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p
            className="text-sm font-semibold leading-snug"
            style={{
              color: "var(--text-primary)",
              textDecoration: todo.status === "done" ? "line-through" : "none",
            }}
          >
            {todo.title}
          </p>
          {/* Status badge */}
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
            style={{
              backgroundColor: `${STATUS_COLORS[todo.status] ?? "#6B7280"}18`,
              color: STATUS_COLORS[todo.status] ?? "#6B7280",
            }}
          >
            {todo.status === "open" ? "Open" : todo.status === "in_progress" ? "In Progress" : "Done"}
          </span>
        </div>

        {/* Description */}
        {todo.description && (
          <p
            className="text-xs mb-2"
            style={{ color: "var(--text-muted)", lineHeight: "1.5" }}
          >
            {todo.description}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {/* Assignee chip */}
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{
              backgroundColor: `${ASSIGNEE_COLORS[todo.assignee] ?? "#6B7280"}18`,
              color: ASSIGNEE_COLORS[todo.assignee] ?? "#6B7280",
            }}
          >
            {ASSIGNEE_LABELS[todo.assignee] ?? todo.assignee}
          </span>

          {/* Priority chip */}
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: `${PRIORITY_COLORS[todo.priority] ?? "#6B7280"}12`,
              color: PRIORITY_COLORS[todo.priority] ?? "#6B7280",
            }}
          >
            {PRIORITY_LABELS[todo.priority] ?? todo.priority}
          </span>

          {/* Due date */}
          {todo.due_date && (
            <span
              className="text-xs flex items-center gap-0.5"
              style={{ color: overdue ? "#EF4444" : "var(--text-muted)" }}
            >
              <Clock className="w-3 h-3" />
              {new Date(todo.due_date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
              {overdue && " ⚠"}
            </span>
          )}

          {/* Completion timestamp */}
          {todo.completed_at && (
            <span className="text-xs" style={{ color: "#10B981" }}>
              ✓ Done {formatDate(todo.completed_at)}
            </span>
          )}
        </div>

        {/* Actions */}
        {todo.status !== "done" && (
          <div className="flex gap-2 flex-wrap">
            {todo.status === "open" && (
              <button
                onClick={() => onMarkInProgress(todo.id)}
                disabled={busy}
                className="text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 transition-opacity"
                style={{
                  backgroundColor: "#F59E0B18",
                  color: "#F59E0B",
                  border: "1px solid #F59E0B30",
                  opacity: busy ? 0.6 : 1,
                }}
                aria-label={`Start: ${todo.title}`}
              >
                {busy ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Play className="w-3 h-3" />
                )}
                In Progress
              </button>
            )}

            <button
              onClick={() => onMarkDone(todo.id)}
              disabled={busy}
              className="text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 transition-opacity"
              style={{
                backgroundColor: "#10B98118",
                color: "#10B981",
                border: "1px solid #10B98130",
                opacity: busy ? 0.6 : 1,
              }}
              aria-label={`Mark done: ${todo.title}`}
            >
              {busy ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <CheckCircle className="w-3 h-3" />
              )}
              Mark Done
            </button>

            <button
              onClick={() => onDelete(todo.id)}
              disabled={busy}
              className="text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 transition-opacity ml-auto"
              style={{
                color: "var(--text-muted)",
                opacity: busy ? 0.6 : 1,
              }}
              aria-label={`Delete: ${todo.title}`}
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [doneTodos, setDoneTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [showDone, setShowDone] = useState(false);

  // Filters
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");

  const fetchTodos = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch active and done in parallel
      const params = new URLSearchParams({ limit: "100" });
      if (assigneeFilter !== "all") params.set("assignee", assigneeFilter);
      if (statusFilter !== "done") params.set("status", statusFilter);

      const [activeRes, doneRes] = await Promise.all([
        fetch(`/api/todos?${params}`).then((r) => r.json()),
        fetch("/api/todos?status=done&limit=10").then((r) => r.json()),
      ]);

      const active = ((activeRes as { todos: Todo[] }).todos ?? []).filter(
        (t) => t.status !== "done"
      );
      setTodos(
        [...active].sort(
          (a, b) =>
            (PRIORITY_SORT_ORDER[a.priority] ?? 3) - (PRIORITY_SORT_ORDER[b.priority] ?? 3)
        )
      );
      setDoneTodos((doneRes as { todos: Todo[] }).todos ?? []);
    } catch (err) {
      console.error("[todos] fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [assigneeFilter, statusFilter]);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  const handleMarkInProgress = async (id: string) => {
    setActingId(id);
    try {
      const res = await fetch(`/api/todos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "in_progress" }),
      });
      const updated = (await res.json()) as Todo;
      setTodos((prev) =>
        prev.map((t) => (t.id === id ? updated : t)).sort(
          (a, b) =>
            (PRIORITY_SORT_ORDER[a.priority] ?? 3) - (PRIORITY_SORT_ORDER[b.priority] ?? 3)
        )
      );
    } finally {
      setActingId(null);
    }
  };

  const handleMarkDone = async (id: string) => {
    setActingId(id);
    try {
      const res = await fetch(`/api/todos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      const updated = (await res.json()) as Todo;
      setTodos((prev) => prev.filter((t) => t.id !== id));
      setDoneTodos((prev) => [updated, ...prev].slice(0, 10));
    } finally {
      setActingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setActingId(id);
    try {
      await fetch(`/api/todos/${id}`, { method: "DELETE" });
      setTodos((prev) => prev.filter((t) => t.id !== id));
    } finally {
      setActingId(null);
    }
  };

  // Filter todos for the "in_progress" status filter tab
  const displayedTodos =
    statusFilter === "in_progress"
      ? todos.filter((t) => t.status === "in_progress")
      : statusFilter === "open"
      ? todos.filter((t) => t.status !== "done")
      : todos;

  const openCount = todos.filter((t) => t.status !== "done").length;
  const inProgressCount = todos.filter((t) => t.status === "in_progress").length;

  return (
    <div className="p-4 md:p-8">
      {/* ── Header ── */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl" aria-hidden>✅</span>
          <h1
            className="text-2xl md:text-3xl font-bold"
            style={{
              fontFamily: "var(--font-heading)",
              color: "var(--text-primary)",
              letterSpacing: "-1.5px",
            }}
          >
            Tasks
          </h1>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
          Sarah &amp; Bobby&rsquo;s shared task board.
        </p>
      </div>

      {/* ── Top Bar ── */}
      <div
        className="rounded-xl p-4 mb-6 flex flex-col md:flex-row md:items-center gap-4"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        {/* New Task button */}
        <button
          onClick={() => setShowNewTask(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold flex-shrink-0 transition-opacity hover:opacity-80"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
        >
          <Plus className="w-4 h-4" />
          New Task
        </button>

        {/* Divider */}
        <div className="hidden md:block w-px h-6" style={{ backgroundColor: "var(--border)" }} />

        {/* Assignee filter tabs */}
        <div className="flex gap-1 flex-wrap">
          {(
            [
              { value: "all", label: "All" },
              { value: "sarah", label: "Sarah" },
              { value: "bobby", label: "Bobby" },
              { value: "both", label: "Both" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setAssigneeFilter(opt.value)}
              className="text-sm px-3 py-1.5 rounded-lg font-medium transition-all"
              style={
                assigneeFilter === opt.value
                  ? {
                      backgroundColor: "var(--accent)",
                      color: "var(--text-primary)",
                    }
                  : {
                      backgroundColor: "var(--card-elevated)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border)",
                    }
              }
              aria-pressed={assigneeFilter === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="hidden md:block w-px h-6" style={{ backgroundColor: "var(--border)" }} />

        {/* Status filter */}
        <div className="flex gap-1 flex-wrap">
          {(
            [
              { value: "open", label: `Open (${openCount})` },
              { value: "in_progress", label: `In Progress (${inProgressCount})` },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className="text-sm px-3 py-1.5 rounded-lg font-medium transition-all"
              style={
                statusFilter === opt.value
                  ? {
                      backgroundColor: "var(--card-elevated)",
                      border: `1px solid ${STATUS_COLORS[opt.value] ?? "var(--border)"}`,
                      color: STATUS_COLORS[opt.value] ?? "var(--text-primary)",
                    }
                  : {
                      backgroundColor: "var(--card-elevated)",
                      border: "1px solid var(--border)",
                      color: "var(--text-muted)",
                    }
              }
              aria-pressed={statusFilter === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Todo List ── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-7 h-7 animate-spin" style={{ color: "var(--accent)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Loading tasks…
            </p>
          </div>
        </div>
      ) : displayedTodos.length === 0 ? (
        <div
          className="rounded-xl p-12 text-center"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="text-4xl mb-3">🎯</div>
          <p
            className="font-semibold text-lg mb-1"
            style={{ color: "var(--text-primary)" }}
          >
            {statusFilter === "in_progress"
              ? "Nothing in progress right now"
              : "No open tasks"}
          </p>
          <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
            {assigneeFilter !== "all"
              ? `No tasks assigned to ${assigneeFilter} with this filter.`
              : "Add a task to get started."}
          </p>
          <button
            onClick={() => setShowNewTask(true)}
            className="text-sm font-medium px-4 py-2 rounded-lg transition-opacity hover:opacity-80"
            style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
          >
            + New Task
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 mb-8">
          {displayedTodos.map((todo) => (
            <TodoCard
              key={todo.id}
              todo={todo}
              onMarkInProgress={handleMarkInProgress}
              onMarkDone={handleMarkDone}
              onDelete={handleDelete}
              actingId={actingId}
            />
          ))}
        </div>
      )}

      {/* ── Done Section (Collapsible) ── */}
      {doneTodos.length > 0 && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          <button
            onClick={() => setShowDone((prev) => !prev)}
            className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--card-elevated)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
            aria-expanded={showDone}
            aria-controls="done-section"
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" style={{ color: "#10B981" }} />
              <span className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                Completed Tasks
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "#10B98118", color: "#10B981" }}
              >
                {doneTodos.length}
              </span>
            </div>
            {showDone ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {showDone && (
            <div
              id="done-section"
              className="px-5 pb-5 flex flex-col gap-3"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <div className="pt-4 flex flex-col gap-3">
                {doneTodos.map((todo) => (
                  <div
                    key={todo.id}
                    className="rounded-xl p-4 flex gap-3"
                    style={{
                      backgroundColor: "var(--card-elevated)",
                      border: "1px solid var(--border)",
                      opacity: 0.7,
                    }}
                  >
                    <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#10B981" }} />
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium mb-1"
                        style={{
                          color: "var(--text-secondary)",
                          textDecoration: "line-through",
                        }}
                      >
                        {todo.title}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{
                            backgroundColor: `${ASSIGNEE_COLORS[todo.assignee] ?? "#6B7280"}18`,
                            color: ASSIGNEE_COLORS[todo.assignee] ?? "#6B7280",
                          }}
                        >
                          {ASSIGNEE_LABELS[todo.assignee] ?? todo.assignee}
                        </span>
                        {todo.completed_at && (
                          <span className="text-xs" style={{ color: "#10B981" }}>
                            ✓ Completed {formatDate(todo.completed_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── New Task Modal ── */}
      {showNewTask && (
        <NewTaskModal
          onClose={() => setShowNewTask(false)}
          onCreated={(todo) => {
            setTodos((prev) =>
              [todo, ...prev].sort(
                (a, b) =>
                  (PRIORITY_SORT_ORDER[a.priority] ?? 3) -
                  (PRIORITY_SORT_ORDER[b.priority] ?? 3)
              )
            );
          }}
        />
      )}
    </div>
  );
}
