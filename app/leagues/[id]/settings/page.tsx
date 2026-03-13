"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { NavBar } from "@/components/NavBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useLeagueNavLinks } from "@/lib/use-league-nav-links";

// ─── Types ────────────────────────────────────────────────────────────────────

type Member = { userId: string; username: string; teamName: string };
type Commissioner = { id: string; userId: string; username: string; addedAt: string };

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LeagueSettingsPage() {
  const params = useParams();
  const leagueId = params.id as string;
  const router = useRouter();

  const navLinks = useLeagueNavLinks(leagueId);

  // Auth & league meta
  const [loading, setLoading] = useState(true);
  const [leagueName, setLeagueName] = useState("");
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [isCreator, setIsCreator] = useState(false);

  // Commissioners
  const [members, setMembers] = useState<Member[]>([]);
  const [commissioners, setCommissioners] = useState<Commissioner[]>([]);
  const [addingUserId, setAddingUserId] = useState("");
  const [addingStatus, setAddingStatus] = useState<string | null>(null);

  // Delete league
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setMyUserId(user.id);

      // League meta
      const { data: league } = await supabase
        .from("leagues")
        .select("name, created_by, commissioner_id")
        .eq("id", leagueId)
        .single();

      if (!league) { setLoading(false); return; }
      setLeagueName(league.name);
      setIsCreator(user.id === (league.created_by ?? league.commissioner_id));

      // All members (teams with real users)
      const { data: teams } = await supabase
        .from("teams")
        .select("user_id, name")
        .eq("league_id", leagueId)
        .not("user_id", "is", null);

      const userIds = (teams ?? []).map(t => t.user_id as string);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", userIds);

      const profileMap: Record<string, string> = {};
      for (const p of profiles ?? []) profileMap[p.id] = p.username ?? p.id.slice(0, 8);

      setMembers(
        (teams ?? []).map(t => ({
          userId: t.user_id as string,
          username: profileMap[t.user_id as string] ?? "unknown",
          teamName: t.name,
        }))
      );

      // Current commissioners (if table exists — graceful fallback)
      const { data: comms } = await supabase
        .from("league_commissioners")
        .select("id, user_id, added_at")
        .eq("league_id", leagueId);

      if (comms?.length) {
        const commUserIds = comms.map(c => c.user_id);
        const { data: commProfiles } = await supabase
          .from("profiles")
          .select("id, username")
          .in("id", commUserIds);
        const cp: Record<string, string> = {};
        for (const p of commProfiles ?? []) cp[p.id] = p.username ?? p.id.slice(0, 8);
        setCommissioners(comms.map(c => ({
          id: c.id,
          userId: c.user_id,
          username: cp[c.user_id] ?? "unknown",
          addedAt: c.added_at,
        })));
      }

      setLoading(false);
    }
    load();
  }, [leagueId]);

  // ── Add commissioner ────────────────────────────────────────────────────────
  async function addCommissioner() {
    if (!addingUserId || !myUserId) return;
    setAddingStatus("saving");
    const supabase = createClient();
    const { error } = await supabase.from("league_commissioners").insert({
      league_id: leagueId,
      user_id: addingUserId,
      added_by: myUserId,
    });
    if (error) {
      setAddingStatus(`Error: ${error.message}`);
    } else {
      const added = members.find(m => m.userId === addingUserId);
      if (added) {
        setCommissioners(prev => [...prev, {
          id: crypto.randomUUID(),
          userId: added.userId,
          username: added.username,
          addedAt: new Date().toISOString(),
        }]);
      }
      setAddingUserId("");
      setAddingStatus("Added!");
      setTimeout(() => setAddingStatus(null), 2000);
    }
  }

  // ── Remove commissioner ─────────────────────────────────────────────────────
  async function removeCommissioner(commId: string, userId: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("league_commissioners")
      .delete()
      .eq("id", commId);
    if (!error) {
      setCommissioners(prev => prev.filter(c => c.id !== commId));
    }
  }

  // ── Delete league ───────────────────────────────────────────────────────────
  async function deleteLeague() {
    if (deleteInput !== leagueName || !myUserId) return;
    setDeleting(true);
    setDeleteError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("leagues")
      .delete()
      .eq("id", leagueId);
    if (error) {
      setDeleteError(error.message);
      setDeleting(false);
    } else {
      router.push("/");
    }
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const commissionerUserIds = new Set(commissioners.map(c => c.userId));
  const eligibleToAdd = members.filter(
    m => m.userId !== myUserId && !commissionerUserIds.has(m.userId)
  );

  if (loading) {
    return (
      <div style={{ height: "100vh", background: "var(--c-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--c-text-dim)", letterSpacing: "0.12em" }}>Loading…</div>
      </div>
    );
  }

  const sectionStyle: React.CSSProperties = {
    background: "var(--c-bg-elevated)",
    borderRadius: 14,
    border: "1.5px solid var(--c-border-strong)",
    overflow: "hidden",
    marginBottom: 20,
  };

  const sectionHeaderStyle: React.CSSProperties = {
    padding: "14px 20px",
    borderBottom: "1px solid var(--c-border)",
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--c-bg)", color: "var(--c-text)", overflowX: "hidden" }}>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      <NavBar links={navLinks} activeLabel="Settings" right={<ThemeToggle size="sm" />} />

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "32px 20px" }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#FF5A1F", marginBottom: 4 }}>
            {leagueName}
          </p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em" }}>
            League Settings
          </h1>
        </div>

        {/* ── Commissioners section ── */}
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-text-dim)" }}>
              League Commissioners
            </p>
          </div>

          <div style={{ padding: "16px 20px" }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--c-text-muted)", lineHeight: 1.6, marginBottom: 16 }}>
              Commissioners can edit scoring rules (before draft), manage waivers, and send announcements.
              Only the league creator can add or remove commissioners, or delete the league.
            </p>

            {/* Creator row */}
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 14px", background: "var(--c-bg)", borderRadius: 10,
              border: "1px solid var(--c-border)", marginBottom: 8,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "#FF5A1F", display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'DM Mono', monospace", fontSize: 12, color: "white", fontWeight: 700, flexShrink: 0,
              }}>
                {members.find(m => m.userId === myUserId)?.username?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "var(--c-text)" }}>
                  {members.find(m => m.userId === myUserId)?.username ?? "You"}
                </p>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-dim)", letterSpacing: "0.06em" }}>
                  {members.find(m => m.userId === myUserId)?.teamName}
                </p>
              </div>
              <span style={{
                fontFamily: "'DM Mono', monospace", fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase",
                background: "rgba(255,90,31,0.12)", color: "#FF5A1F",
                border: "1px solid rgba(255,90,31,0.25)", borderRadius: 5, padding: "2px 8px",
              }}>
                Creator
              </span>
            </div>

            {/* Co-commissioner rows */}
            {commissioners.map(c => (
              <div key={c.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 14px", background: "var(--c-bg)", borderRadius: 10,
                border: "1px solid var(--c-border)", marginBottom: 8,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: "#4c1d95", display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'DM Mono', monospace", fontSize: 12, color: "white", fontWeight: 700, flexShrink: 0,
                }}>
                  {c.username[0]?.toUpperCase() ?? "?"}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, color: "var(--c-text)" }}>
                    {c.username}
                  </p>
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-dim)", letterSpacing: "0.06em" }}>
                    Added {new Date(c.addedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
                  </p>
                </div>
                <span style={{
                  fontFamily: "'DM Mono', monospace", fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase",
                  background: "rgba(76,29,149,0.1)", color: "#7c3aed",
                  border: "1px solid rgba(76,29,149,0.2)", borderRadius: 5, padding: "2px 8px",
                }}>
                  Co-Commissioner
                </span>
                {isCreator && (
                  <button
                    onClick={() => removeCommissioner(c.id, c.userId)}
                    style={{
                      background: "none", border: "1px solid var(--c-border-strong)",
                      borderRadius: 6, cursor: "pointer", color: "var(--c-text-muted)",
                      fontFamily: "'DM Mono', monospace", fontSize: 10, padding: "4px 10px",
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}

            {commissioners.length === 0 && (
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--c-text-dim)", letterSpacing: "0.06em", marginBottom: 12 }}>
                No co-commissioners yet.
              </p>
            )}

            {/* Add commissioner */}
            {isCreator && eligibleToAdd.length > 0 && (
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <select
                  value={addingUserId}
                  onChange={e => setAddingUserId(e.target.value)}
                  style={{
                    flex: 1, minWidth: 180, padding: "9px 12px",
                    background: "var(--c-bg)", border: "1.5px solid var(--c-border-strong)",
                    borderRadius: 8, color: "var(--c-text)",
                    fontFamily: "'DM Sans', sans-serif", fontSize: 13, cursor: "pointer",
                  }}
                >
                  <option value="">Select a manager…</option>
                  {eligibleToAdd.map(m => (
                    <option key={m.userId} value={m.userId}>
                      {m.username} ({m.teamName})
                    </option>
                  ))}
                </select>
                <button
                  onClick={addCommissioner}
                  disabled={!addingUserId || addingStatus === "saving"}
                  style={{
                    padding: "9px 20px", borderRadius: 8, border: "none",
                    background: addingUserId ? "#FF5A1F" : "var(--c-skeleton)",
                    color: "white", fontFamily: "'DM Mono', monospace", fontSize: 11,
                    letterSpacing: "0.06em", cursor: addingUserId ? "pointer" : "not-allowed",
                    minHeight: 40,
                  }}
                >
                  {addingStatus === "saving" ? "Adding…" : "Add Commissioner"}
                </button>
                {addingStatus && addingStatus !== "saving" && (
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: addingStatus.startsWith("Error") ? "#DC2626" : "#16A34A", alignSelf: "center" }}>
                    {addingStatus}
                  </p>
                )}
              </div>
            )}

            {isCreator && eligibleToAdd.length === 0 && commissioners.length === 0 && (
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--c-text-dim)", letterSpacing: "0.06em", marginTop: 8 }}>
                No other managers in this league yet.
              </p>
            )}
          </div>
        </div>

        {/* ── Danger Zone (creator only) ── */}
        {isCreator && (
          <div style={{ ...sectionStyle, border: "1.5px solid rgba(220,38,38,0.4)" }}>
            <div style={{ ...sectionHeaderStyle, background: "rgba(220,38,38,0.06)" }}>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#DC2626" }}>
                ⚠ Danger Zone
              </p>
            </div>

            <div style={{ padding: "20px 20px" }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 700, color: "#DC2626", marginBottom: 8 }}>
                Delete this league
              </h3>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--c-text-muted)", lineHeight: 1.7, marginBottom: 20 }}>
                This will permanently delete <strong>{leagueName}</strong>, all teams, all draft picks, all scores, and all chat history.
                <br />
                <strong style={{ color: "#DC2626" }}>This cannot be undone.</strong>
              </p>

              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--c-text-dim)", letterSpacing: "0.06em", marginBottom: 8 }}>
                Type <strong style={{ color: "var(--c-text)" }}>{leagueName}</strong> to confirm
              </p>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  type="text"
                  value={deleteInput}
                  onChange={e => { setDeleteInput(e.target.value); setDeleteError(null); }}
                  placeholder={leagueName}
                  style={{
                    flex: 1, minWidth: 200, padding: "10px 14px",
                    background: "var(--c-bg)", border: "1.5px solid rgba(220,38,38,0.35)",
                    borderRadius: 8, color: "var(--c-text)",
                    fontFamily: "'DM Mono', monospace", fontSize: 12, outline: "none",
                  }}
                />
                <button
                  onClick={deleteLeague}
                  disabled={deleteInput !== leagueName || deleting}
                  style={{
                    padding: "10px 20px", borderRadius: 8, border: "none",
                    background: deleteInput === leagueName ? "#DC2626" : "var(--c-skeleton)",
                    color: "white", fontFamily: "'DM Mono', monospace", fontSize: 11,
                    letterSpacing: "0.06em",
                    cursor: deleteInput === leagueName ? "pointer" : "not-allowed",
                    opacity: deleting ? 0.6 : 1, minHeight: 44,
                  }}
                >
                  {deleting ? "Deleting…" : "Delete League"}
                </button>
              </div>

              {deleteError && (
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#DC2626", marginTop: 8, letterSpacing: "0.04em" }}>
                  {deleteError}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Non-creator view */}
        {!isCreator && (
          <div style={{ padding: "40px 0", textAlign: "center" }}>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: "var(--c-text-dim)", marginBottom: 8 }}>
              Commissioner settings
            </p>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--c-text-dim)" }}>
              Only the league creator can manage these settings.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
