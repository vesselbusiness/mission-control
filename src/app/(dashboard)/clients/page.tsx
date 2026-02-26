"use client";

/**
 * Clients — /clients
 * Card grid of all 1:1 coaching clients.
 * Sarah & Bobby's client roster at a glance.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Users, Plus, X, Loader2, MapPin, Calendar, ChevronRight } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Client {
  slug: string;
  name: string;
  stage: string;
  location: string;
  lastUpdated: string;
  hasAvatar: boolean;
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

function getStageColor(stage: string): { bg: string; text: string; border: string } {
  const lower = stage.toLowerCase();
  if (lower.includes("pre-launch") || lower.includes("pre launch")) {
    return { bg: "rgba(217, 119, 6, 0.1)", text: "#D97706", border: "rgba(217, 119, 6, 0.25)" };
  }
  if (lower.includes("scaling")) {
    return { bg: "rgba(11, 127, 190, 0.1)", text: "#0B7FBE", border: "rgba(11, 127, 190, 0.25)" };
  }
  if (lower.includes("launched") || lower.includes("launch")) {
    return { bg: "rgba(45, 134, 89, 0.1)", text: "#2D8659", border: "rgba(45, 134, 89, 0.25)" };
  }
  if (lower.includes("active")) {
    return { bg: "rgba(107, 91, 149, 0.1)", text: "#6B5B95", border: "rgba(107, 91, 149, 0.25)" };
  }
  return { bg: "rgba(138, 150, 168, 0.1)", text: "#5A6B7F", border: "rgba(138, 150, 168, 0.25)" };
}

function getStageBadgeLabel(stage: string): string {
  if (!stage) return "No stage";
  // Truncate long stage strings (e.g. "Pre-launch — ready to go live" → "Pre-launch")
  const dashIdx = stage.indexOf(" —");
  return dashIdx > 0 ? stage.slice(0, dashIdx) : stage;
}

function formatLastUpdated(date: string): string {
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

// ─── Add Client Modal ──────────────────────────────────────────────────────────

interface AddClientModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function AddClientModal({ onClose, onSuccess }: AddClientModalProps) {
  const [name, setName] = useState("");
  const [stage, setStage] = useState("Pre-launch");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), stage, location: location.trim() }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Failed to create client");
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          padding: "32px",
          width: "100%",
          maxWidth: "480px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.15)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>
            Add New Client
          </h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px" }}
          >
            <X style={{ width: "20px", height: "20px" }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Name */}
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
              Full Name <span style={{ color: "var(--negative)" }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jane Smith"
              required
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid var(--border-strong)",
                backgroundColor: "var(--bg)",
                color: "var(--text-primary)",
                fontSize: "15px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Stage */}
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
              Stage
            </label>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid var(--border-strong)",
                backgroundColor: "var(--bg)",
                color: "var(--text-primary)",
                fontSize: "15px",
                outline: "none",
                boxSizing: "border-box",
              }}
            >
              <option value="Pre-launch">Pre-launch</option>
              <option value="Active">Active</option>
              <option value="Launched">Launched</option>
              <option value="Scaling">Scaling</option>
            </select>
          </div>

          {/* Location */}
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Minnesota"
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid var(--border-strong)",
                backgroundColor: "var(--bg)",
                color: "var(--text-primary)",
                fontSize: "15px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <div style={{ color: "var(--negative)", fontSize: "13px", padding: "10px 14px", borderRadius: "8px", backgroundColor: "var(--negative-soft)" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid var(--border-strong)",
                backgroundColor: "transparent",
                color: "var(--text-secondary)",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              style={{
                flex: 2,
                padding: "10px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "var(--accent)",
                color: "#fff",
                fontSize: "14px",
                fontWeight: 700,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving || !name.trim() ? 0.6 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              {saving && <Loader2 style={{ width: "14px", height: "14px", animation: "spin 1s linear infinite" }} />}
              Create Client
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Client Card ──────────────────────────────────────────────────────────────

interface ClientCardProps {
  client: Client;
}

function ClientCard({ client }: ClientCardProps) {
  const stageBg = getStageColor(client.stage);
  const initials = getInitials(client.name);
  const stageLabel = getStageBadgeLabel(client.stage);
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={`/clients/${client.slug}`}
      style={{ textDecoration: "none" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          backgroundColor: "var(--surface)",
          border: `1px solid ${hovered ? "var(--accent)" : "var(--border)"}`,
          borderRadius: "16px",
          padding: "24px",
          cursor: "pointer",
          transition: "all 200ms ease",
          boxShadow: hovered ? "0 8px 24px rgba(0,0,0,0.08)" : "0 1px 4px rgba(0,0,0,0.04)",
          transform: hovered ? "translateY(-2px)" : "none",
        }}
      >
        {/* Avatar + Name Row */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              backgroundColor: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              fontWeight: 700,
              color: "#fff",
              flexShrink: 0,
              fontFamily: "var(--font-heading)",
              overflow: "hidden",
            }}
          >
            {client.hasAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/clients/${client.slug}/avatar`}
                alt={client.name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "var(--text-primary)",
                fontFamily: "var(--font-heading)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {client.name}
            </div>
            {client.stage && (
              <span
                style={{
                  display: "inline-block",
                  marginTop: "4px",
                  padding: "2px 10px",
                  borderRadius: "20px",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.03em",
                  backgroundColor: stageBg.bg,
                  color: stageBg.text,
                  border: `1px solid ${stageBg.border}`,
                }}
              >
                {stageLabel}
              </span>
            )}
          </div>
          <ChevronRight style={{ width: "16px", height: "16px", color: "var(--text-muted)", flexShrink: 0 }} />
        </div>

        {/* Details */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {client.location && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--text-secondary)" }}>
              <MapPin style={{ width: "13px", height: "13px", color: "var(--text-muted)", flexShrink: 0 }} />
              <span>{client.location}</span>
            </div>
          )}
          {client.lastUpdated && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--text-muted)" }}>
              <Calendar style={{ width: "13px", height: "13px", flexShrink: 0 }} />
              <span>Updated {formatLastUpdated(client.lastUpdated)}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Failed to load clients");
      const data = await res.json() as { clients: Client[] };
      setClients(data.clients);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchClients();
  }, [fetchClients]);

  return (
    <div style={{ maxWidth: "1200px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "32px",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "28px",
              fontWeight: 700,
              color: "var(--text-primary)",
              fontFamily: "var(--font-heading)",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "6px",
            }}
          >
            <Users style={{ width: "28px", height: "28px", color: "var(--accent)" }} />
            Clients
          </h1>
          <p style={{ fontSize: "15px", color: "var(--text-secondary)" }}>
            Manage your 1:1 coaching clients
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            borderRadius: "10px",
            border: "none",
            backgroundColor: "var(--accent)",
            color: "#fff",
            fontSize: "14px",
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 150ms ease",
            fontFamily: "var(--font-heading)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--accent-hover)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--accent)"; }}
        >
          <Plus style={{ width: "16px", height: "16px" }} />
          Add Client
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
          <Loader2
            style={{
              width: "32px",
              height: "32px",
              color: "var(--accent)",
              animation: "spin 1s linear infinite",
            }}
          />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div
          style={{
            padding: "16px 20px",
            borderRadius: "12px",
            backgroundColor: "var(--negative-soft)",
            border: "1px solid rgba(193, 72, 61, 0.2)",
            color: "var(--negative)",
            fontSize: "14px",
          }}
        >
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && clients.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "80px 32px",
            backgroundColor: "var(--surface)",
            border: "2px dashed var(--border)",
            borderRadius: "16px",
          }}
        >
          <Users style={{ width: "48px", height: "48px", color: "var(--text-muted)", margin: "0 auto 16px" }} />
          <h3 style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>
            No clients yet
          </h3>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "24px" }}>
            Add your first coaching client to get started.
          </p>
          <button
            onClick={() => setShowModal(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 20px",
              borderRadius: "10px",
              border: "none",
              backgroundColor: "var(--accent)",
              color: "#fff",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <Plus style={{ width: "16px", height: "16px" }} />
            Add First Client
          </button>
        </div>
      )}

      {/* Client Grid */}
      {!loading && !error && clients.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "20px",
          }}
        >
          {clients.map((client) => (
            <ClientCard key={client.slug} client={client} />
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <AddClientModal
          onClose={() => setShowModal(false)}
          onSuccess={() => { void fetchClients(); }}
        />
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
