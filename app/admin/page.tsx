"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NavBar } from "@/components/NavBar";
import { useIsMobile } from "@/lib/use-is-mobile";

// ─── Types ───────────────────────────────────────────────────────────────────

type AdminRole = "admin" | "moderator";

type AdminLeague = {
  id: string;
  name: string;
  privacy: string;
  tier: number | null;
  draft_status: string;
  created_at: string;
  season: string;
  team_count: number;
};

type AdminUser = {
  id: string;
  email: string;
  username: string;
  role: string;
  league_count: number;
  created_at: string;
};

type DbStats = {
  leagues: number;
  teams: number;
  players: number;
  draft_picks: number;
  messages: number;
  waiver_bids: number;
  trades: number;
};

// ─── Helper Components ────────────────────────────────────────────────────────

function DraftBadge({ status }: { status: string }) {
  const styles: Record<string, React.CSSProperties> = {
    live: {
      background: "rgba(255,90,31,0.15)",
      color: "var(--c-accent)",
      border: "1px solid rgba(255,90,31,0.3)",
    },
    complete: {
      background: "rgba(22,163,74,0.12)",
      color: "var(--c-success)",
      border: "1px solid rgba(22,163,74,0.25)",
    },
    pending: {
      background: "var(--c-card)",
      color: "var(--c-text-muted)",
      border: "1px solid var(--c-border)",
    },
  };

  const s = styles[status] ?? styles.pending;

  return (
    <span
      style={{
        ...s,
        fontFamily: "'DM Mono', monospace",
        fontSize: 9,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: "2px 7px",
        borderRadius: 20,
        whiteSpace: "nowrap",
      }}
    >
      {status === "live" ? "● " : ""}
      {status}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, React.CSSProperties> = {
    admin: {
      background: "rgba(255,90,31,0.15)",
      color: "var(--c-accent)",
      border: "1px solid rgba(255,90,31,0.3)",
    },
    moderator: {
      background: "rgba(59,130,246,0.12)",
      color: "#3B82F6",
      border: "1px solid rgba(59,130,246,0.3)",
    },
    user: {
      background: "var(--c-card)",
      color: "var(--c-text-dim)",
      border: "1px solid var(--c-border)",
    },
  };

  const s = styles[role] ?? styles.user;

  return (
    <span
      style={{
        ...s,
        fontFamily: "'DM Mono', monospace",
        fontSize: 9,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: "2px 7px",
        borderRadius: 20,
        whiteSpace: "nowrap",
      }}
    >
      {role}
    </span>
  );
}

type ConfirmDialogProps = {
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  isDanger?: boolean;
};

function ConfirmDialog({
  title,
  body,
  confirmLabel = "Confirm",
  onConfirm,
  onClose,
  isDanger = false,
}: ConfirmDialogProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--c-bg-elevated)",
          border: "1px solid var(--c-border-strong)",
          borderRadius: 14,
          padding: "28px 32px",
          maxWidth: 420,
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        <div
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 20,
            fontWeight: 700,
            color: isDanger ? "#EF4444" : "var(--c-text)",
            marginBottom: 10,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 14,
            color: "var(--c-text-muted)",
            lineHeight: 1.5,
            marginBottom: 24,
          }}
        >
          {body}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "1px solid var(--c-border-strong)",
              borderRadius: 8,
              padding: "8px 18px",
              fontFamily: "'DM Mono', monospace",
              fontSize: 11,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "var(--c-text-muted)",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            style={{
              background: isDanger
                ? "linear-gradient(135deg, #EF4444, #DC2626)"
                : "linear-gradient(135deg, #FF5A1F, #E8400A)",
              border: "none",
              borderRadius: 8,
              padding: "8px 18px",
              fontFamily: "'DM Mono', monospace",
              fontSize: 11,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "white",
              cursor: "pointer",
              boxShadow: isDanger
                ? "0 3px 10px rgba(239,68,68,0.3)"
                : "0 3px 10px rgba(255,90,31,0.3)",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Toast({ msg }: { msg: string }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 2000,
        background: "var(--c-bg-elevated)",
        border: "1px solid var(--c-border-strong)",
        borderRadius: 10,
        padding: "10px 18px",
        fontFamily: "'DM Mono', monospace",
        fontSize: 11,
        letterSpacing: "0.07em",
        color: "var(--c-text)",
        boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
        maxWidth: 320,
      }}
    >
      {msg}
    </div>
  );
}

function Th({ children, w }: { children: React.ReactNode; w?: number | string }) {
  return (
    <th
      style={{
        position: "sticky",
        top: 0,
        zIndex: 2,
        background: "var(--c-bg)",
        borderBottom: "1px solid var(--c-border-strong)",
        padding: "8px 12px",
        fontFamily: "'DM Mono', monospace",
        fontSize: 9,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--c-text-dim)",
        textAlign: "left",
        whiteSpace: "nowrap",
        width: w,
        fontWeight: 600,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td
      style={{
        padding: "9px 12px",
        borderBottom: "1px solid var(--c-border)",
        fontFamily: mono ? "'DM Mono', monospace" : "'DM Sans', sans-serif",
        fontSize: mono ? 11 : 13,
        color: "var(--c-text)",
        verticalAlign: "middle",
      }}
    >
      {children}
    </td>
  );
}

function ActionBtn({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: danger ? "rgba(239,68,68,0.08)" : "var(--c-card)",
        border: `1px solid ${danger ? "rgba(239,68,68,0.25)" : "var(--c-border)"}`,
        borderRadius: 6,
        padding: "4px 9px",
        fontFamily: "'DM Mono', monospace",
        fontSize: 10,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: danger ? "#EF4444" : "var(--c-text-muted)",
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "background 0.15s",
      }}
    >
      {children}
    </button>
  );
}

// ─── Section: Leagues ─────────────────────────────────────────────────────────

function SectionLeagues({ myRole }: { myRole: AdminRole }) {
  const [leagues, setLeagues] = useState<AdminLeague[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmDialogProps | null>(null);

  useEffect(() => {
    fetch("/api/admin/leagues")
      .then((r) => r.json())
      .then((d) => setLeagues(d.leagues ?? []))
      .finally(() => setLoading(false));
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function changeTier(id: string, delta: 1 | -1) {
    const res = await fetch(`/api/admin/leagues/${id}/tier`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delta }),
    });
    const d = await res.json();
    if (d.tier != null) {
      setLeagues((prev) =>
        prev.map((l) => (l.id === id ? { ...l, tier: d.tier } : l))
      );
      showToast(`Tier updated to ${d.tier}`);
    } else {
      showToast(d.error ?? "Error updating tier");
    }
  }

  async function resetDraft(id: string) {
    const res = await fetch(`/api/admin/leagues/${id}/reset-draft`, {
      method: "POST",
    });
    const d = await res.json();
    if (res.ok) {
      setLeagues((prev) =>
        prev.map((l) => (l.id === id ? { ...l, draft_status: "pending" } : l))
      );
      showToast(d.message ?? "Draft reset");
    } else {
      showToast(d.error ?? "Error resetting draft");
    }
  }

  async function deleteLeague(id: string) {
    const res = await fetch(`/api/admin/leagues/${id}`, { method: "DELETE" });
    const d = await res.json();
    if (res.ok) {
      setLeagues((prev) => prev.filter((l) => l.id !== id));
      showToast(d.message ?? "League deleted");
    } else {
      showToast(d.error ?? "Error deleting league");
    }
  }

  if (loading) {
    return (
      <div style={{ color: "var(--c-text-muted)", fontFamily: "'DM Mono', monospace", fontSize: 12, padding: "40px 0" }}>
        Loading leagues…
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title="Leagues"
        subtitle={`${leagues.length} leagues total`}
      />
      <div className="table-scroll" style={{ borderRadius: 10, border: "1px solid var(--c-border-strong)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Type</Th>
              <Th w={60}>Tier</Th>
              <Th w={70}>Teams</Th>
              <Th>Status</Th>
              <Th>Created</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {leagues.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    padding: "24px 16px",
                    textAlign: "center",
                    color: "var(--c-text-dim)",
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 11,
                  }}
                >
                  No leagues found
                </td>
              </tr>
            )}
            {leagues.map((league) => (
              <tr
                key={league.id}
                style={{ background: "var(--c-bg-elevated)" }}
              >
                <Td>
                  <div style={{ fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
                    {league.name}
                  </div>
                  <div
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 9,
                      color: "var(--c-text-dim)",
                      marginTop: 2,
                    }}
                  >
                    {league.id.slice(0, 8)}…
                  </div>
                </Td>
                <Td mono>{league.privacy}</Td>
                <Td mono>{league.tier ?? "—"}</Td>
                <Td mono>{league.team_count}</Td>
                <Td>
                  <DraftBadge status={league.draft_status} />
                </Td>
                <Td mono>
                  {new Date(league.created_at).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "2-digit",
                  })}
                </Td>
                <Td>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    <ActionBtn onClick={() => changeTier(league.id, 1)}>▲ Tier</ActionBtn>
                    <ActionBtn onClick={() => changeTier(league.id, -1)}>▼ Tier</ActionBtn>
                    <ActionBtn
                      danger
                      onClick={() =>
                        setConfirm({
                          title: "Reset Draft",
                          body: `Reset the draft for "${league.name}"? This will delete all picks and squad players, and set the draft back to pending.`,
                          confirmLabel: "Reset Draft",
                          isDanger: true,
                          onConfirm: () => resetDraft(league.id),
                          onClose: () => setConfirm(null),
                        })
                      }
                    >
                      Reset Draft
                    </ActionBtn>
                    <ActionBtn
                      danger
                      onClick={() =>
                        setConfirm({
                          title: "Delete League",
                          body: `Permanently delete "${league.name}"? This will remove all associated teams, picks, and data.`,
                          confirmLabel: "Delete",
                          isDanger: true,
                          onConfirm: () => deleteLeague(league.id),
                          onClose: () => setConfirm(null),
                        })
                      }
                    >
                      Delete
                    </ActionBtn>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirm && <ConfirmDialog {...confirm} />}
      {toast && <Toast msg={toast} />}
    </div>
  );
}

// ─── Section: Users ───────────────────────────────────────────────────────────

function SectionUsers({ myRole }: { myRole: AdminRole }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmDialogProps | null>(null);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => setUsers(d.users ?? []))
      .finally(() => setLoading(false));
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function changeRole(id: string, role: string) {
    const res = await fetch(`/api/admin/users/${id}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const d = await res.json();
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, role: d.role } : u))
      );
      showToast(`Role updated to ${d.role}`);
    } else {
      showToast(d.error ?? "Error updating role");
    }
  }

  async function deleteUser(id: string) {
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    const d = await res.json();
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== id));
      showToast(d.message ?? "User deleted");
    } else {
      showToast(d.error ?? "Error deleting user");
    }
  }

  if (loading) {
    return (
      <div style={{ color: "var(--c-text-muted)", fontFamily: "'DM Mono', monospace", fontSize: 12, padding: "40px 0" }}>
        Loading users…
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title="Users"
        subtitle={`${users.length} registered users`}
      />
      <div className="table-scroll" style={{ borderRadius: 10, border: "1px solid var(--c-border-strong)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <Th>User</Th>
              <Th>Role</Th>
              <Th w={80}>Leagues</Th>
              <Th>Joined</Th>
              {myRole === "admin" && <Th w={160}>Actions</Th>}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td
                  colSpan={myRole === "admin" ? 5 : 4}
                  style={{
                    padding: "24px 16px",
                    textAlign: "center",
                    color: "var(--c-text-dim)",
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 11,
                  }}
                >
                  No users found
                </td>
              </tr>
            )}
            {users.map((user) => (
              <tr
                key={user.id}
                style={{ background: "var(--c-bg-elevated)" }}
              >
                <Td>
                  <div style={{ fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
                    {user.username ?? "—"}
                  </div>
                  <div
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 10,
                      color: "var(--c-text-muted)",
                      marginTop: 2,
                    }}
                  >
                    {user.email}
                  </div>
                </Td>
                <Td>
                  <RoleBadge role={user.role} />
                </Td>
                <Td mono>{user.league_count}</Td>
                <Td mono>
                  {new Date(user.created_at).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "2-digit",
                  })}
                </Td>
                {myRole === "admin" && (
                  <Td>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {user.role !== "user" && (
                        <ActionBtn
                          onClick={() =>
                            setConfirm({
                              title: "Demote to User",
                              body: `Remove admin/mod privileges from ${user.username ?? user.email}?`,
                              confirmLabel: "Demote",
                              isDanger: false,
                              onConfirm: () => changeRole(user.id, "user"),
                              onClose: () => setConfirm(null),
                            })
                          }
                        >
                          → User
                        </ActionBtn>
                      )}
                      {user.role === "user" && (
                        <ActionBtn
                          onClick={() =>
                            setConfirm({
                              title: "Promote to Moderator",
                              body: `Make ${user.username ?? user.email} a moderator?`,
                              confirmLabel: "Make Mod",
                              isDanger: false,
                              onConfirm: () => changeRole(user.id, "moderator"),
                              onClose: () => setConfirm(null),
                            })
                          }
                        >
                          → Mod
                        </ActionBtn>
                      )}
                      {user.role !== "admin" && (
                        <ActionBtn
                          onClick={() =>
                            setConfirm({
                              title: "Promote to Admin",
                              body: `Make ${user.username ?? user.email} a full admin? They will have complete access to this panel.`,
                              confirmLabel: "Make Admin",
                              isDanger: true,
                              onConfirm: () => changeRole(user.id, "admin"),
                              onClose: () => setConfirm(null),
                            })
                          }
                        >
                          → Admin
                        </ActionBtn>
                      )}
                      <ActionBtn
                        danger
                        onClick={() =>
                          setConfirm({
                            title: "Delete User",
                            body: `Permanently delete ${user.username ?? user.email}? This cannot be undone.`,
                            confirmLabel: "Delete",
                            isDanger: true,
                            onConfirm: () => deleteUser(user.id),
                            onClose: () => setConfirm(null),
                          })
                        }
                      >
                        Delete
                      </ActionBtn>
                    </div>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirm && <ConfirmDialog {...confirm} />}
      {toast && <Toast msg={toast} />}
    </div>
  );
}

// ─── Section: Players ─────────────────────────────────────────────────────────

function SectionPlayers() {
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncingPlayers, setSyncingPlayers] = useState(false);
  const [syncingScores, setSyncingScores] = useState(false);
  const [round, setRound] = useState("");
  const [playerResult, setPlayerResult] = useState<string | null>(null);
  const [scoreResult, setScoreResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((d) => {
        setPlayerCount(d.stats?.players ?? 0);
        setLastSync(d.lastSync ?? null);
      });
  }, []);

  async function syncPlayers() {
    setSyncingPlayers(true);
    setPlayerResult(null);
    try {
      const res = await fetch("/api/sync/players", { method: "POST" });
      const d = await res.json();
      setPlayerResult(d.synced != null ? `Synced ${d.synced} players` : d.error ?? "Done");
      if (d.synced != null) setPlayerCount(d.synced);
    } catch {
      setPlayerResult("Network error");
    } finally {
      setSyncingPlayers(false);
    }
  }

  async function syncScores() {
    setSyncingScores(true);
    setScoreResult(null);
    try {
      const body: Record<string, unknown> = {};
      if (round.trim()) body.round = Number(round.trim());
      const res = await fetch("/api/score/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      setScoreResult(
        d.scored != null
          ? `Scored ${d.scored} fixtures, ${d.statsProcessed ?? 0} stats, ${d.teamsUpdated ?? 0} teams updated`
          : d.error ?? "Done"
      );
    } catch {
      setScoreResult("Network error");
    } finally {
      setSyncingScores(false);
    }
  }

  return (
    <div>
      <SectionHeader title="Players" subtitle="Player data sync controls" />
      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "1fr 1fr",
        }}
      >
        {/* Player count card */}
        <div
          style={{
            background: "var(--c-bg-elevated)",
            border: "1px solid var(--c-border-strong)",
            borderRadius: 12,
            padding: "20px 24px",
          }}
        >
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 36,
              fontWeight: 900,
              color: "var(--c-text)",
              lineHeight: 1,
            }}
          >
            {playerCount ?? "—"}
          </div>
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 9,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--c-text-muted)",
              marginTop: 6,
            }}
          >
            Players in DB
          </div>
          {lastSync && (
            <div
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                color: "var(--c-text-dim)",
                marginTop: 8,
              }}
            >
              Last sync:{" "}
              {new Date(lastSync).toLocaleString("en-GB", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          )}
        </div>

        {/* Sync controls */}
        <div
          style={{
            background: "var(--c-bg-elevated)",
            border: "1px solid var(--c-border-strong)",
            borderRadius: 12,
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <button
            className="new-btn"
            onClick={syncPlayers}
            disabled={syncingPlayers}
            style={{ width: "100%" }}
          >
            {syncingPlayers ? "Syncing…" : "Sync Players"}
          </button>
          {playerResult && (
            <div
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                color: "var(--c-text-muted)",
                padding: "6px 10px",
                background: "var(--c-card)",
                borderRadius: 6,
              }}
            >
              {playerResult}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="number"
              placeholder="Round (optional)"
              value={round}
              onChange={(e) => setRound(e.target.value)}
              style={{
                flex: 1,
                background: "var(--c-input)",
                border: "1px solid var(--c-input-border)",
                borderRadius: 7,
                padding: "7px 10px",
                fontFamily: "'DM Mono', monospace",
                fontSize: 11,
                color: "var(--c-text)",
                outline: "none",
              }}
            />
            <button
              className="new-btn"
              onClick={syncScores}
              disabled={syncingScores}
              style={{ whiteSpace: "nowrap" }}
            >
              {syncingScores ? "Syncing…" : "Sync Scores"}
            </button>
          </div>
          {scoreResult && (
            <div
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                color: "var(--c-text-muted)",
                padding: "6px 10px",
                background: "var(--c-card)",
                borderRadius: 6,
              }}
            >
              {scoreResult}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Section: Database ────────────────────────────────────────────────────────

function SectionDatabase() {
  const [stats, setStats] = useState<DbStats | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function loadStats() {
    setLoading(true);
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((d) => {
        setStats(d.stats ?? null);
        setLastSync(d.lastSync ?? null);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadStats(); }, []);

  const cards: { emoji: string; label: string; key: keyof DbStats }[] = [
    { emoji: "🏆", label: "Leagues", key: "leagues" },
    { emoji: "👥", label: "Teams", key: "teams" },
    { emoji: "⚽", label: "Players", key: "players" },
    { emoji: "📋", label: "Draft Picks", key: "draft_picks" },
    { emoji: "💬", label: "Messages", key: "messages" },
    { emoji: "📝", label: "Waiver Bids", key: "waiver_bids" },
    { emoji: "🔄", label: "Trades", key: "trades" },
  ];

  return (
    <div>
      <SectionHeader
        title="Database"
        subtitle="Row counts across all tables"
        action={
          <button
            onClick={loadStats}
            disabled={loading}
            style={{
              background: "var(--c-card)",
              border: "1px solid var(--c-border-strong)",
              borderRadius: 8,
              padding: "6px 14px",
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "var(--c-text-muted)",
              cursor: "pointer",
            }}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        }
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: 12,
        }}
      >
        {cards.map((card) => (
          <div
            key={card.key}
            style={{
              background: "var(--c-bg-elevated)",
              border: "1px solid var(--c-border-strong)",
              borderRadius: 12,
              padding: "18px 16px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 6 }}>{card.emoji}</div>
            <div
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 28,
                fontWeight: 900,
                color: "var(--c-text)",
                lineHeight: 1,
              }}
            >
              {loading ? "…" : (stats?.[card.key] ?? 0)}
            </div>
            <div
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 9,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--c-text-muted)",
                marginTop: 5,
              }}
            >
              {card.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Section: API Usage ───────────────────────────────────────────────────────

function SectionApi() {
  const [result, setResult] = useState<{ used: number | null; remaining: number | null; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function checkUsage() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/api-usage");
      const d = await res.json();
      setResult(d);
    } catch {
      setResult({ used: null, remaining: null, error: "Network error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <SectionHeader title="API Usage" subtitle="API-Football (api-sports.io)" />

      {/* Warning banner */}
      <div
        style={{
          background: "rgba(255,90,31,0.08)",
          border: "1px solid rgba(255,90,31,0.25)",
          borderRadius: 10,
          padding: "12px 16px",
          marginBottom: 20,
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
        <div
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            color: "var(--c-text-muted)",
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: "var(--c-accent)" }}>100 requests/day limit</strong> on the free tier.
          Each sync operation consumes multiple requests. Monitor usage before triggering bulk syncs.
        </div>
      </div>

      <button
        className="new-btn"
        onClick={checkUsage}
        disabled={loading}
      >
        {loading ? "Checking…" : "Check API Usage"}
      </button>

      {result && (
        <div
          style={{
            marginTop: 20,
            background: "var(--c-bg-elevated)",
            border: "1px solid var(--c-border-strong)",
            borderRadius: 12,
            padding: "20px 24px",
          }}
        >
          {result.error ? (
            <div
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 12,
                color: "#EF4444",
              }}
            >
              Error: {result.error}
            </div>
          ) : (
            <div style={{ display: "flex", gap: 32 }}>
              <div>
                <div
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: 32,
                    fontWeight: 900,
                    color: "var(--c-accent)",
                    lineHeight: 1,
                  }}
                >
                  {result.used ?? "—"}
                </div>
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 9,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--c-text-muted)",
                    marginTop: 5,
                  }}
                >
                  Used today
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: 32,
                    fontWeight: 900,
                    color: "var(--c-success)",
                    lineHeight: 1,
                  }}
                >
                  {result.remaining ?? "—"}
                </div>
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 9,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--c-text-muted)",
                    marginTop: 5,
                  }}
                >
                  Remaining
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Section: Danger Zone ─────────────────────────────────────────────────────

function SectionDanger() {
  const [toast, setToast] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmDialogProps | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const isMobile = useIsMobile();

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function runAction(action: string) {
    setLoading(action);
    try {
      const res = await fetch("/api/admin/danger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const d = await res.json();
      showToast(d.message ?? d.error ?? "Done");
    } catch {
      showToast("Network error");
    } finally {
      setLoading(null);
    }
  }

  const dangerRows = [
    {
      action: "delete-test-leagues",
      label: "Delete Test Leagues",
      description: 'Removes all leagues whose name contains "test" (case-insensitive). Cascades to teams, picks, and squad players.',
      confirmLabel: "Delete Test Leagues",
      confirmBody: 'Delete all leagues with "test" in the name? This will also remove all associated teams, draft picks, and squad data.',
    },
    {
      action: "clear-messages",
      label: "Clear All Messages",
      description: "Deletes every row in the messages table. League chat history will be permanently erased.",
      confirmLabel: "Clear Messages",
      confirmBody: "Delete ALL messages from every league? This cannot be undone.",
    },
    {
      action: "reset-credits",
      label: "Reset All Credits",
      description: "Sets every team's credits back to 100. Use after a new season or testing period.",
      confirmLabel: "Reset Credits",
      confirmBody: "Reset all team credits to 100? This affects every team in every league.",
    },
  ];

  return (
    <div>
      <SectionHeader title="Danger Zone" subtitle="Irreversible bulk operations — admin only" />

      <div
        style={{
          background: "rgba(239,68,68,0.04)",
          border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {dangerRows.map((row, i) => (
          <div
            key={row.action}
            style={{
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              alignItems: isMobile ? "flex-start" : "center",
              justifyContent: "space-between",
              gap: 16,
              padding: "18px 20px",
              borderBottom: i < dangerRows.length - 1 ? "1px solid rgba(239,68,68,0.12)" : "none",
            }}
          >
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--c-text)",
                  marginBottom: 3,
                }}
              >
                {row.label}
              </div>
              <div
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 12,
                  color: "var(--c-text-muted)",
                  lineHeight: 1.4,
                }}
              >
                {row.description}
              </div>
            </div>
            <button
              onClick={() =>
                setConfirm({
                  title: row.label,
                  body: row.confirmBody,
                  confirmLabel: row.confirmLabel,
                  isDanger: true,
                  onConfirm: () => runAction(row.action),
                  onClose: () => setConfirm(null),
                })
              }
              disabled={loading === row.action}
              style={{
                background: "rgba(239,68,68,0.10)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 8,
                padding: "7px 14px",
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                color: "#EF4444",
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {loading === row.action ? "Running…" : row.label}
            </button>
          </div>
        ))}
      </div>

      {confirm && <ConfirmDialog {...confirm} />}
      {toast && <Toast msg={toast} />}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        marginBottom: 20,
        gap: 12,
      }}
    >
      <div>
        <h2
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 22,
            fontWeight: 700,
            color: "var(--c-text)",
            margin: 0,
            lineHeight: 1,
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.08em",
              color: "var(--c-text-muted)",
              marginTop: 5,
              textTransform: "uppercase",
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ─── Section: Testing ─────────────────────────────────────────────────────────

function SectionTesting() {
  const [seeding, setSeeding] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; message?: string; leagueId?: string; error?: string } | null>(null);

  async function seedTestLeague() {
    if (!confirm("Create \"The Gaffer's League\" with 8 teams?")) return;
    setSeeding(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/seed-test-league", { method: "POST" });
      const d = await res.json();
      setResult(d);
    } catch {
      setResult({ error: "Network error" });
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div>
      <SectionHeader title="Testing" subtitle="Seed data and test utilities for development" />
      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
        {/* Seed test league */}
        <div style={{ background: "var(--c-bg-elevated)", border: "1.5px solid var(--c-border-strong)", borderRadius: 12, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16 }}>
            <span style={{ fontSize: 28 }}>🌱</span>
            <div>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "var(--c-text)", marginBottom: 4 }}>Seed Test League</p>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--c-text-muted)", lineHeight: 1.5 }}>
                Creates &ldquo;The Gaffer&apos;s League&rdquo; with 8 teams: your team (Dave&apos;s Destroyers) plus 7 bot teams including Klopp&apos;s Gegenpressers, Pep&apos;s Philosophers, and more.
              </p>
            </div>
          </div>
          <button
            onClick={seedTestLeague}
            disabled={seeding}
            style={{
              padding: "10px 20px", borderRadius: 9,
              background: seeding ? "var(--c-skeleton)" : "#16A34A",
              color: "white", border: "none",
              fontFamily: "'DM Mono', monospace", fontSize: 11,
              letterSpacing: "0.08em", cursor: seeding ? "not-allowed" : "pointer",
              opacity: seeding ? 0.6 : 1,
            }}
          >
            {seeding ? "Creating…" : "🌱 Seed Test League"}
          </button>
          {result && (
            <div style={{
              marginTop: 14, padding: "10px 14px", borderRadius: 8,
              background: result.error ? "rgba(220,38,38,0.06)" : "rgba(22,163,74,0.06)",
              border: `1px solid ${result.error ? "rgba(220,38,38,0.2)" : "rgba(22,163,74,0.2)"}`,
            }}>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: result.error ? "#DC2626" : "#16A34A", letterSpacing: "0.04em", marginBottom: result.leagueId ? 4 : 0 }}>
                {result.error ?? result.message}
              </p>
              {result.leagueId && (
                <a href={`/leagues/${result.leagueId}/draft`} style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#FF5A1F", textDecoration: "none", letterSpacing: "0.04em" }}>
                  → Open Draft Room
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

type Tab = "leagues" | "users" | "players" | "database" | "api" | "danger" | "testing";

export default function AdminPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [myRole, setMyRole] = useState<AdminRole | null>(null);
  const [myName, setMyName] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("leagues");

  useEffect(() => {
    fetch("/api/admin/check")
      .then((r) => {
        if (!r.ok) throw new Error("Unauthorized");
        return r.json();
      })
      .then((d) => {
        setMyRole(d.role as AdminRole);
        setMyName(d.username ?? null);
      })
      .catch(() => {
        router.replace("/");
      })
      .finally(() => setChecking(false));
  }, [router]);

  if (checking || myRole === null) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--c-bg)",
        }}
      >
        <div
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--c-text-dim)",
          }}
        >
          Checking Access…
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "leagues", label: "Leagues" },
    { id: "users", label: "Users" },
    { id: "players", label: "Players" },
    { id: "database", label: "Database" },
    { id: "api", label: "API" },
    { id: "testing" as Tab, label: "🌱 Testing" },
    ...(myRole === "admin" ? [{ id: "danger" as Tab, label: "Danger Zone" }] : []),
  ];

  const adminRight = (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {myName && !isMobile && (
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--c-text-muted)", letterSpacing: "0.05em" }}>
          {myName}
        </span>
      )}
      <RoleBadge role={myRole} />
      <ThemeToggle size="sm" />
      <Link
        href="/"
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 10,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--c-text-muted)",
          textDecoration: "none",
          padding: "5px 10px",
          border: "1px solid var(--c-border)",
          borderRadius: 7,
          minHeight: 44,
          display: "flex",
          alignItems: "center",
        }}
      >
        ← Hub
      </Link>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--c-bg)" }}>
      <NavBar right={adminRight} showThemeToggle={false} />

      {/* Tab Bar */}
      <div
        style={{
          borderBottom: "1px solid var(--c-border-strong)",
          background: "var(--c-bg-elevated)",
          padding: isMobile ? "0 8px" : "0 40px",
          display: "flex",
          gap: 0,
          overflowX: "auto",
        }}
      >
        {tabs.map((tab) => {
          const isDanger = tab.id === "danger";
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: "none",
                border: "none",
                borderBottom: isActive
                  ? `2px solid ${isDanger ? "#EF4444" : "var(--c-accent)"}`
                  : "2px solid transparent",
                padding: "13px 18px",
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                letterSpacing: "0.09em",
                textTransform: "uppercase",
                color: isActive
                  ? isDanger
                    ? "#EF4444"
                    : "var(--c-accent)"
                  : isDanger
                  ? "rgba(239,68,68,0.6)"
                  : "var(--c-text-muted)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "color 0.15s, border-color 0.15s",
                marginBottom: -1,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <main
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          padding: isMobile ? "20px 16px" : "36px 40px",
        }}
      >
        {activeTab === "leagues" && <SectionLeagues myRole={myRole} />}
        {activeTab === "users" && <SectionUsers myRole={myRole} />}
        {activeTab === "players" && <SectionPlayers />}
        {activeTab === "database" && <SectionDatabase />}
        {activeTab === "api" && <SectionApi />}
        {activeTab === "testing" && <SectionTesting />}
        {activeTab === "danger" && myRole === "admin" && <SectionDanger />}
      </main>
    </div>
  );
}
