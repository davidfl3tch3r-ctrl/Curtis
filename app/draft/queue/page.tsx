"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NavBar } from "@/components/NavBar";
import { useIsMobile } from "@/lib/use-is-mobile";

type PublicDraft = {
  id: string;
  name: string;
  draft_type: string;
  squad_size: number;
  pick_time_seconds: number;
  target_teams: number;
  draft_starts_at: string | null;
  teamCount: number;
  myTeamId: string | null;
};

function Countdown({ target }: { target: string }) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    function tick() {
      const diff = new Date(target).getTime() - Date.now();
      if (diff <= 0) { setLabel("Starting now…"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLabel(h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  return <span>{label}</span>;
}

export default function DraftQueuePage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [userId, setUserId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<PublicDraft[]>([]);
  const [loading, setLoading] = useState(true);

  // Join flow state per draft
  const [joiningId, setJoiningId]   = useState<string | null>(null);
  const [teamName, setTeamName]     = useState("");
  const [joinError, setJoinError]   = useState("");
  const [joining, setJoining]       = useState(false);

  // Create flow
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating]     = useState(false);
  const [createError, setCreateError] = useState("");
  const [newName, setNewName]        = useState("");
  const [newStartsAt, setNewStartsAt] = useState("");
  const [newTarget, setNewTarget]    = useState(8);
  const [newTeamName, setNewTeamName] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setUserId(user.id);

    const { data: leagues } = await supabase
      .from("leagues")
      .select("id, name, draft_type, squad_size, pick_time_seconds, target_teams, draft_starts_at")
      .eq("is_public", true)
      .eq("draft_status", "pending")
      .order("draft_starts_at", { ascending: true, nullsFirst: false });

    if (!leagues?.length) { setDrafts([]); setLoading(false); return; }

    const ids = leagues.map(l => l.id);
    const { data: teams } = await supabase
      .from("teams")
      .select("id, league_id, user_id")
      .in("league_id", ids);

    setDrafts(leagues.map(l => {
      const lt = (teams ?? []).filter(t => t.league_id === l.id);
      const mine = lt.find(t => t.user_id === user?.id);
      return {
        ...l,
        target_teams: l.target_teams ?? 8,
        teamCount: lt.length,
        myTeamId: mine?.id ?? null,
      };
    }));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleJoin(draft: PublicDraft) {
    if (!teamName.trim()) return;
    setJoining(true);
    setJoinError("");
    const supabase = createClient();

    if (!userId) { router.push("/login"); return; }

    // Ensure profile exists
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").upsert(
        { id: user.id, email: user.email!, username: user.email!.split("@")[0] },
        { onConflict: "id", ignoreDuplicates: true }
      );
    }

    const { error } = await supabase.from("teams").insert({
      league_id:      draft.id,
      user_id:        userId,
      name:           teamName.trim(),
      draft_position: draft.teamCount + 1,
    });

    if (error) {
      setJoinError(error.code === "23505" ? "You've already joined this draft." : error.message);
      setJoining(false);
      return;
    }

    setJoiningId(null);
    setTeamName("");
    await load();
  }

  async function handleCreate() {
    if (!newName.trim() || !newTeamName.trim() || !newStartsAt) return;
    setCreating(true);
    setCreateError("");
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    // Ensure profile
    await supabase.from("profiles").upsert(
      { id: user.id, email: user.email!, username: user.email!.split("@")[0] },
      { onConflict: "id", ignoreDuplicates: true }
    );

    const { data: league, error: lErr } = await supabase
      .from("leagues")
      .insert({
        name:              newName.trim(),
        commissioner_id:   user.id,
        format:            "h2h",
        privacy:           "public",
        is_public:         true,
        target_teams:      newTarget,
        max_teams:         newTarget,
        squad_size:        15,
        bench_size:        4,
        transfer_type:     "waiver",
        draft_type:        "snake",
        pick_time_seconds: 60,
        autopick:          "best",
        draft_status:      "pending",
        season:            "2025-26",
        draft_starts_at:   new Date(newStartsAt).toISOString(),
      })
      .select("id")
      .single();

    if (lErr || !league) { setCreateError(lErr?.message ?? "Failed to create draft"); setCreating(false); return; }

    // Commissioner's team
    await supabase.from("teams").insert({
      league_id:      league.id,
      user_id:        user.id,
      name:           newTeamName.trim(),
      draft_position: 1,
    });

    setShowCreate(false);
    setNewName(""); setNewStartsAt(""); setNewTeamName(""); setNewTarget(8);
    await load();
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px",
    fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--c-text)" as string,
    background: "var(--c-input)" as string, border: "1px solid var(--c-input-border)" as string,
    borderRadius: 8, outline: "none", boxSizing: "border-box",
  };

  // Default start time: tomorrow at 8pm
  const defaultStart = (() => {
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(20, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  })();

  return (
    <div style={{ minHeight: "100vh", background: "var(--c-bg)", color: "var(--c-text)", overflowX: "hidden" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: var(--c-border); border-radius: 2px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        input::placeholder { color: var(--c-text-dim); }
        input:focus { border-color: rgba(255,90,31,0.5) !important; }
      `}</style>

      <NavBar
        links={[
          { label: "Home", href: "/" },
          { label: "Pyramid", href: "/pyramid" },
          { label: "Fan Leagues", href: "/fan-leagues" },
          { label: "Mock Draft", href: "/mock-draft" },
        ]}
        activeLabel="Mock Draft"
        right={<ThemeToggle size="sm" />}
      />

      <div style={{ maxWidth: 680, margin: "0 auto", padding: isMobile ? "24px 16px" : "32px 20px" }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: isMobile ? 26 : 32, fontWeight: 900, marginBottom: 8 }}>
            Public Draft Queue
          </h1>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: "var(--c-text-muted)", lineHeight: 1.5 }}>
            Join a draft solo. Fill up with strangers, or bots if not enough humans sign up in time.
          </p>
        </div>

        {/* Create draft toggle */}
        <button
          onClick={() => { setShowCreate(s => !s); setCreateError(""); }}
          style={{
            width: "100%", padding: "14px", borderRadius: 12, marginBottom: 16,
            border: `1px solid ${showCreate ? "rgba(255,90,31,0.4)" : "rgba(255,255,255,0.1)"}`,
            background: showCreate ? "rgba(255,90,31,0.08)" : "rgba(255,255,255,0.03)",
            color: showCreate ? "#FF5A1F" : "var(--c-text-muted)",
            fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.1em",
            textTransform: "uppercase", cursor: "pointer", transition: "all 0.15s",
            minHeight: 44,
          }}
        >
          {showCreate ? "✕ Cancel" : "+ Create New Public Draft"}
        </button>

        {/* Create form */}
        {showCreate && (
          <div style={{ background: "var(--c-bg-elevated)", borderRadius: 14, padding: "24px", border: "1.5px solid rgba(255,90,31,0.2)", marginBottom: 24 }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "#FF5A1F", marginBottom: 16 }}>
              New Public Draft
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--c-text-dim)", marginBottom: 6 }}>Draft Name</div>
                <input style={inputStyle} placeholder="e.g. Friday Night Draft" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--c-text-dim)", marginBottom: 6 }}>Your Team Name</div>
                <input style={inputStyle} placeholder="e.g. Interception FC" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--c-text-dim)", marginBottom: 6 }}>Draft Starts At</div>
                <input type="datetime-local" style={inputStyle} defaultValue={defaultStart} onChange={e => setNewStartsAt(e.target.value)} />
              </div>
              <div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--c-text-dim)", marginBottom: 6 }}>Managers (target)</div>
                <select
                  value={newTarget}
                  onChange={e => setNewTarget(Number(e.target.value))}
                  style={{ ...inputStyle, cursor: "pointer" }}
                >
                  {[4, 6, 8, 10, 12].map(n => <option key={n} value={n}>{n} managers</option>)}
                </select>
              </div>
            </div>

            {createError && (
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#DC2626", background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 6, padding: "8px 12px", marginBottom: 12 }}>
                {createError}
              </div>
            )}

            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim() || !newTeamName.trim() || !newStartsAt}
              style={{
                width: "100%", padding: "12px", borderRadius: 8, border: "none",
                background: creating ? "var(--c-skeleton)" : "linear-gradient(135deg,#FF5A1F,#E8400A)",
                color: "white", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600,
                cursor: creating ? "not-allowed" : "pointer",
                boxShadow: creating ? "none" : "0 3px 12px rgba(255,90,31,0.3)",
                minHeight: 44,
              }}
            >
              {creating ? "Creating…" : "Create Draft + Join as Manager 1"}
            </button>
          </div>
        )}

        {/* Draft list */}
        {loading ? (
          <div style={{ padding: "60px 0", textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--c-text-dim)", letterSpacing: "0.1em" }}>Loading…</div>
        ) : drafts.length === 0 ? (
          <div style={{ padding: "60px 0", textAlign: "center" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "var(--c-text-dim)", marginBottom: 10 }}>No open drafts right now</div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--c-border-strong)" }}>Be the first — create one above.</p>
          </div>
        ) : (
          drafts.map(draft => {
            const pct = (draft.teamCount / draft.target_teams) * 100;
            const isFull = draft.teamCount >= draft.target_teams;
            const isJoining = joiningId === draft.id;
            const alreadyIn = !!draft.myTeamId;
            const pastDeadline = draft.draft_starts_at ? new Date(draft.draft_starts_at) < new Date() : false;

            return (
              <div key={draft.id} style={{ background: "var(--c-bg-elevated)", borderRadius: 14, padding: "20px 24px", border: `1.5px solid ${alreadyIn ? "rgba(255,90,31,0.25)" : "var(--c-border)"}`, marginBottom: 12, transition: "border-color 0.15s" }}>

                {/* Top row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "var(--c-text)", marginBottom: 3 }}>{draft.name}</div>
                    <div style={{ display: "flex", gap: 12 }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-dim)", letterSpacing: "0.08em" }}>
                        {draft.draft_type?.toUpperCase()} · {draft.squad_size} rounds · {draft.pick_time_seconds}s clock
                      </span>
                    </div>
                  </div>
                  {alreadyIn && (
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "#FF5A1F", padding: "4px 8px", borderRadius: 6, background: "rgba(255,90,31,0.1)", border: "1px solid rgba(255,90,31,0.2)" }}>
                      Joined ✓
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: isFull ? "#16A34A" : "var(--c-text-muted)" }}>
                      {draft.teamCount} / {draft.target_teams} managers joined
                    </span>
                    {draft.draft_starts_at && (
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: pastDeadline ? "#FF5A1F" : "var(--c-text-muted)" }}>
                        {pastDeadline ? "Starting now…" : <>Starts in <Countdown target={draft.draft_starts_at} /></>}
                      </span>
                    )}
                  </div>
                  <div style={{ height: 4, background: "var(--c-border)", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 99, background: isFull ? "#16A34A" : "linear-gradient(90deg,#FF5A1F,#E8400A)", width: `${pct}%`, transition: "width 0.4s ease" }} />
                  </div>
                </div>

                {/* Actions */}
                {alreadyIn ? (
                  <Link href={`/leagues/${draft.id}/draft`} style={{
                    display: "block", textAlign: "center", padding: "10px", borderRadius: 8,
                    background: "rgba(255,90,31,0.15)", border: "1px solid rgba(255,90,31,0.3)",
                    color: "#FF5A1F", fontFamily: "'DM Mono', monospace", fontSize: 11,
                    letterSpacing: "0.08em", textDecoration: "none", textTransform: "uppercase",
                  }}>
                    Go to Draft Room →
                  </Link>
                ) : isFull ? (
                  <div style={{ textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--c-text-dim)", letterSpacing: "0.06em", padding: "10px 0" }}>
                    Draft is full
                  </div>
                ) : isJoining ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      autoFocus
                      style={{ ...inputStyle, flex: 1 }}
                      placeholder="Your team name"
                      value={teamName}
                      onChange={e => setTeamName(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleJoin(draft)}
                    />
                    <button
                      onClick={() => handleJoin(draft)}
                      disabled={joining || !teamName.trim()}
                      style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: joining ? "var(--c-skeleton)" : "#FF5A1F", color: "white", fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.06em", cursor: joining ? "not-allowed" : "pointer", flexShrink: 0 }}
                    >
                      {joining ? "…" : "Confirm"}
                    </button>
                    <button
                      onClick={() => { setJoiningId(null); setTeamName(""); setJoinError(""); }}
                      style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid var(--c-border)", background: "transparent", color: "var(--c-text-muted)", fontFamily: "'DM Mono', monospace", fontSize: 11, cursor: "pointer", flexShrink: 0 }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setJoiningId(draft.id); setJoinError(""); setTeamName(""); }}
                    style={{
                      width: "100%", padding: "10px", borderRadius: 8,
                      border: "1px solid var(--c-border)", background: "var(--c-input)",
                      color: "var(--c-text-muted)", fontFamily: "'DM Mono', monospace", fontSize: 11,
                      letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer",
                      transition: "all 0.15s", minHeight: 44,
                    }}
                    onMouseOver={e => { (e.target as HTMLButtonElement).style.background = "rgba(255,90,31,0.08)"; (e.target as HTMLButtonElement).style.color = "#FF5A1F"; }}
                    onMouseOut={e => { (e.target as HTMLButtonElement).style.background = "var(--c-input)"; (e.target as HTMLButtonElement).style.color = "var(--c-text-muted)"; }}
                  >
                    Join Draft
                  </button>
                )}

                {joinError && joiningId === draft.id && (
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#DC2626", marginTop: 8 }}>{joinError}</div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
