"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NavBar } from "@/components/NavBar";
import { AvatarMenu } from "@/components/AvatarMenu";
import { useIsMobile } from "@/lib/use-is-mobile";

const DRAFT_STATUS_LABEL: Record<string, string> = {
  pending: "Draft Pending",
  live: "Drafting",
  complete: "Season Active",
};

const DRAFT_STATUS_COLOR: Record<string, string> = {
  pending: "#A89880",
  live: "#FF5A1F",
  complete: "#16A34A",
};

type LeagueData = {
  id: string;
  teamId: string;
  name: string;
  season: string;
  draftStatus: "pending" | "live" | "complete";
  myTeamName: string;
  myPoints: number;
  gwPoints: number;
  rank: number;
  teamCount: number;
  leaderName: string;
  leaderPoints: number;
  streak: number;
  gwTopScorerName: string;
  gwTopScorerPts: number;
  gwLeagueAvg: number;
};

type SquadRow = {
  playerId: string;
  name: string;
  club: string;
  position: string;
  gwPoints: number;
  isStarting: boolean;
};

function generateHeadline(l: LeagueData): string {
  if (l.gwPoints === 0 && l.gwTopScorerPts === 0) return "Waiting for the gameweek to kick off.";
  const isTop = l.gwTopScorerName === l.myTeamName;
  if (isTop && l.gwPoints > l.gwLeagueAvg * 1.3) return `${l.myTeamName} flying this week with ${l.gwPoints} pts — everyone else is watching.`;
  if (isTop) return `${l.myTeamName} lead the way with ${l.gwPoints} pts this gameweek.`;
  if (l.gwTopScorerPts > l.gwLeagueAvg * 1.5) return `${l.gwTopScorerName} on fire with ${l.gwTopScorerPts} pts. The rest of the league scrambles.`;
  return `${l.gwTopScorerName} top this week with ${l.gwTopScorerPts} pts. League avg: ${l.gwLeagueAvg} pts.`;
}

export default function LeagueHubPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState("Gaffer");
  const [leagues, setLeagues] = useState<LeagueData[]>([]);
  const [activeLeague, setActiveLeague] = useState<LeagueData | null>(null);
  const [tab, setTab] = useState("overview");
  const [squadPlayers, setSquadPlayers] = useState<SquadRow[]>([]);
  const [squadLoading, setSquadLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Display name: username from profile, else derive from email
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();

      const rawName = profile?.username
        ? profile.username
        : user.email!.split("@")[0].replace(/[._-]/g, " ");
      const capitalized = rawName.charAt(0).toUpperCase() + rawName.slice(1);
      const displayName = capitalized.length > 16 && !capitalized.includes(" ")
        ? capitalized.slice(0, 15) + "…"
        : capitalized;
      setGreeting(displayName);

      // User's teams, with league data embedded
      const { data: myTeams } = await supabase
        .from("teams")
        .select(`
          id,
          name,
          total_points,
          gw_points,
          streak,
          league_id,
          league:leagues (
            id,
            name,
            season,
            draft_status
          )
        `)
        .eq("user_id", user.id);

      if (!myTeams || myTeams.length === 0) {
        setLoading(false);
        return;
      }

      const leagueIds = myTeams.map((t) => t.league_id as string);

      // All teams in those leagues (for rank + leader + digest calculation)
      const { data: allTeams } = await supabase
        .from("teams")
        .select("id, league_id, name, total_points, gw_points")
        .in("league_id", leagueIds)
        .order("total_points", { ascending: false });

      const enriched: LeagueData[] = myTeams.map((myTeam) => {
        const league = myTeam.league as unknown as {
          id: string;
          name: string;
          season: string;
          draft_status: "pending" | "live" | "complete";
        };

        const leagueTeams = (allTeams ?? []).filter(
          (t) => t.league_id === myTeam.league_id
        );
        const sorted = [...leagueTeams].sort(
          (a, b) => b.total_points - a.total_points
        );
        const rank = sorted.findIndex((t) => t.id === myTeam.id) + 1;
        const leader = sorted[0];
        const isLeader = leader?.id === myTeam.id;

        const gwSorted = [...leagueTeams].sort((a, b) => (b.gw_points ?? 0) - (a.gw_points ?? 0));
        const gwTop = gwSorted[0];
        const gwLeagueAvg = leagueTeams.length > 0
          ? Math.round(leagueTeams.reduce((s, t) => s + (t.gw_points ?? 0), 0) / leagueTeams.length)
          : 0;

        return {
          id: league.id,
          teamId: myTeam.id,
          name: league.name,
          season: league.season,
          draftStatus: league.draft_status,
          myTeamName: myTeam.name,
          myPoints: myTeam.total_points,
          gwPoints: myTeam.gw_points,
          rank: rank || 1,
          teamCount: leagueTeams.length,
          leaderName: isLeader ? myTeam.name : (leader?.name ?? "—"),
          leaderPoints: leader?.total_points ?? 0,
          streak: (myTeam as unknown as { streak?: number }).streak ?? 0,
          gwTopScorerName: gwTop?.name ?? "—",
          gwTopScorerPts: gwTop?.gw_points ?? 0,
          gwLeagueAvg,
        };
      });

      setLeagues(enriched);
      setActiveLeague(enriched[0]);
      setLoading(false);
    }

    load();
  }, []);

  // Fetch squad players when the squad tab is active for the selected league
  useEffect(() => {
    if (tab !== "squad" || !activeLeague?.teamId) return;
    setSquadPlayers([]);
    setSquadLoading(true);
    const supabase = createClient();
    supabase
      .from("squad_players")
      .select("player_id, is_starting, player:players(name, club, position, gw_points)")
      .eq("team_id", activeLeague.teamId)
      .then(({ data }) => {
        type Raw = { player_id: string; is_starting: boolean; player: { name: string; club: string; position: string; gw_points: number } };
        setSquadPlayers(
          (data as unknown as Raw[] ?? []).map(r => ({
            playerId: r.player_id,
            name: r.player?.name ?? "",
            club: r.player?.club ?? "",
            position: r.player?.position ?? "",
            gwPoints: r.player?.gw_points ?? 0,
            isStarting: r.is_starting,
          }))
        );
        setSquadLoading(false);
      });
  }, [tab, activeLeague?.teamId]);

  const navLinks = activeLeague
    ? [
        { label: "Home", href: "/" },
        { label: "My Team", href: `/leagues/${activeLeague.id}/team` },
        { label: "Draft", href: `/leagues/${activeLeague.id}/draft` },
        { label: "Match Day", href: `/leagues/${activeLeague.id}/live` },
        { label: "League Table", href: `/leagues/${activeLeague.id}/table` },
        { label: "Waivers",  href: `/leagues/${activeLeague.id}/waivers` },
        { label: "Trades",   href: `/leagues/${activeLeague.id}/trades` },
        { label: "Chat",     href: `/leagues/${activeLeague.id}/chat` },
        { label: "Messages", href: `/leagues/${activeLeague.id}/messages` },
        { label: "Pyramid",     href: "/pyramid" },
        { label: "Fan Leagues", href: "/fan-leagues" },
        { label: "Mock Draft",  href: "/mock-draft" },
      ]
    : [{ label: "Home", href: "/" }, { label: "Pyramid", href: "/pyramid" }, { label: "Fan Leagues", href: "/fan-leagues" }, { label: "Mock Draft", href: "/mock-draft" }];

  const gap =
    activeLeague && activeLeague.leaderPoints > activeLeague.myPoints
      ? activeLeague.leaderPoints - activeLeague.myPoints
      : 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--c-bg)", color: "var(--c-text)", overflowX: "hidden" }}>

      <NavBar
        links={navLinks}
        activeLabel="Home"
        right={
          <>
            <ThemeToggle />
            <AvatarMenu />
          </>
        }
      />

      <div style={{ maxWidth: 1060, margin: "0 auto", padding: isMobile ? "24px 16px" : "40px 40px" }}>

        {/* Welcome */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
          <div>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#FF5A1F", marginBottom: 6 }}>
              Your Hub
            </p>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: isMobile ? 24 : 36, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              Welcome back,<br />
              <span style={{ fontStyle: "italic", color: "#FF5A1F" }}>{greeting}.</span>
            </h1>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="new-btn" style={{ background: "transparent", border: "1.5px solid var(--c-border-strong)", color: "var(--c-text)", minHeight: 44, minWidth: 44 }} onClick={() => router.push("/draft/queue")}>Join Public Draft</button>
            <button className="new-btn" style={{ minHeight: 44, minWidth: 44 }} onClick={() => router.push("/leagues/new")}>+ New League</button>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="grid-sidebar">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[1, 2].map(i => (
                <div key={i} style={{
                  height: 110, borderRadius: 14, background: "var(--c-skeleton)",
                  animation: "pulse 1.5s ease-in-out infinite",
                  opacity: 1 - i * 0.2,
                }} />
              ))}
            </div>
            <div style={{ height: 300, borderRadius: 14, background: "var(--c-skeleton)" }} />
          </div>
        )}

        {/* Empty state */}
        {!loading && leagues.length === 0 && (
          <div style={{
            textAlign: "center",
            padding: "80px 40px",
            background: "var(--c-bg-elevated)",
            borderRadius: 20,
            border: "1.5px solid var(--c-border-strong)",
          }}>
            <div style={{ fontSize: 48, marginBottom: 20 }}>🏆</div>
            <h2 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 28, fontWeight: 900,
              color: "var(--c-text)", marginBottom: 12,
            }}>
              Your pitch awaits.
            </h2>
            <p style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 15, color: "var(--c-text-muted)",
              lineHeight: 1.6, maxWidth: 380, margin: "0 auto 28px",
            }}>
              Create your first league and invite your friends to draft. Your CB&apos;s 8 interceptions are waiting to beat their Salah.
            </p>
            <button
              className="new-btn"
              style={{ fontSize: 13, padding: "13px 28px" }}
              onClick={() => router.push("/leagues/new")}
            >
              Create your first league
            </button>
          </div>
        )}

        {/* Main content */}
        {!loading && leagues.length > 0 && activeLeague && (
          <div className="grid-sidebar">

            {/* LEFT — league list */}
            <div>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-text-muted)", marginBottom: 12 }}>
                Your Leagues ({leagues.length})
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {leagues.map(l => (
                  <div
                    key={l.id}
                    className={`league-card${activeLeague.id === l.id ? " active" : ""}`}
                    onClick={() => isMobile ? router.push(`/leagues/${l.id}/live`) : setActiveLeague(l)}
                    style={{ cursor: "pointer" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "var(--c-text)" }}>{l.name}</p>
                          {l.streak >= 2 && (
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, background: "rgba(255,90,31,0.12)", color: "#FF5A1F", border: "1px solid rgba(255,90,31,0.25)", borderRadius: 5, padding: "1px 6px", letterSpacing: "0.04em" }}>
                              🔥{l.streak}
                            </span>
                          )}
                        </div>
                        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--c-text-muted)", letterSpacing: "0.06em" }}>{l.myTeamName}</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{
                          fontFamily: "'Playfair Display', serif",
                          fontSize: 22, fontWeight: 900,
                          color: l.rank === 1 ? "#FF5A1F" : "var(--c-text)",
                        }}>
                          {l.rank === 1 ? "🥇" : `#${l.rank}`}
                        </div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-muted)", letterSpacing: "0.06em" }}>of {l.teamCount}</div>
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-dim)", letterSpacing: "0.06em" }}>{l.season}</span>
                      <span style={{
                        fontFamily: "'DM Mono', monospace", fontSize: 9,
                        color: DRAFT_STATUS_COLOR[l.draftStatus],
                        letterSpacing: "0.06em", textTransform: "uppercase",
                      }}>
                        {l.draftStatus === "live" ? "● " : ""}{DRAFT_STATUS_LABEL[l.draftStatus]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT — league detail */}
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

              {/* League name + tabs */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 900, letterSpacing: "-0.01em" }}>{activeLeague.name}</h2>
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--c-text-muted)", letterSpacing: "0.08em", marginTop: 2 }}>
                    {activeLeague.myTeamName} · Season {activeLeague.season}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 4, background: "var(--c-row)", padding: 4, borderRadius: 10, flexWrap: "wrap" }}>
                  {["overview", "squad", "activity"].map(t => (
                    <button key={t} className={`tab-btn${tab === t ? " active" : ""}`} style={{ minHeight: 44, minWidth: 44 }} onClick={() => setTab(t)}>{t}</button>
                  ))}
                </div>
              </div>

              {/* Stat boxes */}
              <div className="stat-boxes-row" style={{ display: "flex", gap: 12 }}>
                {[
                  {
                    label: "Season Pts",
                    value: activeLeague.myPoints.toLocaleString(),
                    sub: gap > 0 ? `-${gap} pts to top` : "Leading the league",
                  },
                  {
                    label: "GW Pts",
                    value: activeLeague.gwPoints.toLocaleString(),
                    sub: "This gameweek",
                  },
                  {
                    label: "Position",
                    value: `#${activeLeague.rank}`,
                    sub: `of ${activeLeague.teamCount} teams`,
                  },
                  {
                    label: "Draft Status",
                    value: DRAFT_STATUS_LABEL[activeLeague.draftStatus],
                    sub: activeLeague.draftStatus === "pending" ? "Waiting to start" : activeLeague.draftStatus === "live" ? "In progress" : "Season underway",
                  },
                ].map(s => (
                  <div key={s.label} className="stat-box">
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-text-dim)", marginBottom: 6 }}>{s.label}</p>
                    <p style={{ fontFamily: "'Playfair Display', serif", fontSize: s.label === "Draft Status" ? 15 : 22, fontWeight: 900, color: "var(--c-text)", lineHeight: 1 }}>{s.value}</p>
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-muted)", marginTop: 4, letterSpacing: "0.04em" }}>{s.sub}</p>
                  </div>
                ))}
              </div>

              {/* Leader banner */}
              <div style={{
                background: "linear-gradient(135deg, #1C1410 0%, #3D2E22 100%)",
                borderRadius: 14, padding: "16px 22px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>League Leader</p>
                  <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "white", fontStyle: "italic" }}>
                    {activeLeague.leaderName}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Points</p>
                  <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: "#FF5A1F" }}>
                    {activeLeague.leaderPoints.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Tab content */}
              {tab === "overview" && (
                <div style={{ background: "var(--c-bg-elevated)", borderRadius: 16, border: "1.5px solid var(--c-border-strong)", overflow: "hidden" }}>
                  <div style={{ padding: "18px 20px 10px", borderBottom: "1px solid var(--c-border)" }}>
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--c-text-muted)" }}>Top Performers</p>
                  </div>
                  <div style={{ padding: isMobile ? "28px 16px" : "48px 24px", textAlign: "center" }}>
                    <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "var(--c-text)", marginBottom: 8 }}>
                      {activeLeague.draftStatus === "pending" ? "Draft hasn't started yet." : "No stats yet."}
                    </p>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--c-text-muted)", lineHeight: 1.6 }}>
                      {activeLeague.draftStatus === "pending"
                        ? "Complete the draft to start tracking player points."
                        : "Player stats will appear here once the gameweek begins."}
                    </p>
                    {activeLeague.draftStatus === "pending" && (
                      <button
                        className="new-btn"
                        style={{ marginTop: 18, fontSize: 11, minHeight: 44 }}
                        onClick={() => router.push(`/leagues/${activeLeague.id}/draft`)}
                      >
                        Go to Draft Room
                      </button>
                    )}
                  </div>
                </div>
              )}

              {tab === "squad" && (
                <div style={{ background: "var(--c-bg-elevated)", borderRadius: 16, border: "1.5px solid var(--c-border-strong)", overflow: "hidden" }}>
                  <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--c-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--c-text-muted)" }}>
                      Your Squad · {squadPlayers.filter(p => p.isStarting).length} starters
                    </p>
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-dim)", letterSpacing: "0.06em" }}>
                      {squadPlayers.length} players
                    </p>
                  </div>
                  {squadLoading ? (
                    <div style={{ padding: "32px 20px", textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--c-text-dim)", letterSpacing: "0.08em" }}>Loading…</div>
                  ) : squadPlayers.length === 0 ? (
                    <div style={{ padding: isMobile ? "28px 16px" : "40px 24px", textAlign: "center" }}>
                      <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "var(--c-text)", marginBottom: 8 }}>No squad yet.</p>
                      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--c-text-muted)", lineHeight: 1.6 }}>
                        {activeLeague.draftStatus === "pending" ? "Complete the draft to build your squad." : "Squad data will appear here once players are assigned."}
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Starters */}
                      {(["GK","DEF","MID","FWD"] as const).map(pos => {
                        const group = squadPlayers.filter(p => p.isStarting && p.position === pos);
                        if (!group.length) return null;
                        const posColors: Record<string, { bg: string; text: string }> = {
                          GK: { bg: "#78350f", text: "#FEF9C3" }, DEF: { bg: "#1e3a8a", text: "#DBEAFE" },
                          MID: { bg: "#4c1d95", text: "#EDE9FE" }, FWD: { bg: "#7c2d12", text: "#FFF1EC" },
                        };
                        return (
                          <div key={pos}>
                            <div style={{ padding: "6px 20px", background: "var(--c-bg)", borderBottom: "1px solid var(--c-border)" }}>
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-text-dim)" }}>{pos}</span>
                            </div>
                            {group.map((p, i) => (
                              <div key={p.playerId} style={{
                                display: "flex", alignItems: "center", gap: 10, padding: "9px 20px",
                                borderBottom: i < group.length - 1 ? "1px solid var(--c-border)" : "none",
                              }}>
                                <div style={{ width: 5, height: 5, borderRadius: "50%", background: posColors[pos].bg, flexShrink: 0 }} />
                                <span style={{ flex: 1, fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--c-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-dim)", letterSpacing: "0.04em" }}>{p.club}</span>
                                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 700, color: p.gwPoints > 0 ? "#FF5A1F" : "var(--c-text-dim)", minWidth: 28, textAlign: "right" }}>{p.gwPoints.toFixed(0)}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                      {/* Bench */}
                      {squadPlayers.some(p => !p.isStarting) && (
                        <div>
                          <div style={{ padding: "6px 20px", background: "var(--c-bg)", borderBottom: "1px solid var(--c-border)", borderTop: "1px solid var(--c-border-strong)" }}>
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-text-dim)" }}>Bench</span>
                          </div>
                          {squadPlayers.filter(p => !p.isStarting).map((p, i, arr) => (
                            <div key={p.playerId} style={{
                              display: "flex", alignItems: "center", gap: 10, padding: "9px 20px",
                              borderBottom: i < arr.length - 1 ? "1px solid var(--c-border)" : "none",
                              opacity: 0.65,
                            }}>
                              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--c-border-strong)", flexShrink: 0 }} />
                              <span style={{ flex: 1, fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--c-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-dim)", letterSpacing: "0.04em" }}>{p.club}</span>
                              <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 700, color: "var(--c-text-dim)", minWidth: 28, textAlign: "right" }}>{p.gwPoints.toFixed(0)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {tab === "activity" && (
                <div style={{ background: "var(--c-bg-elevated)", borderRadius: 16, border: "1.5px solid var(--c-border-strong)", overflow: "hidden" }}>
                  <div style={{ padding: "18px 20px 10px", borderBottom: "1px solid var(--c-border)" }}>
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--c-text-muted)" }}>Activity Feed</p>
                  </div>
                  <div style={{ padding: isMobile ? "28px 16px" : "48px 24px", textAlign: "center" }}>
                    <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "var(--c-text)", marginBottom: 8 }}>
                      Nothing yet.
                    </p>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--c-text-muted)", lineHeight: 1.6 }}>
                      Live scoring events, draft picks, and transfers will show up here.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Weekly Digest ── */}
              <div style={{ background: "var(--c-bg-elevated)", borderRadius: 16, border: "1.5px solid var(--c-border-strong)", overflow: "hidden" }}>
                <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--c-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--c-text-muted)" }}>This Gameweek</p>
                  {activeLeague.streak >= 1 && (
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#FF5A1F", letterSpacing: "0.04em" }}>
                      🔥 {activeLeague.streak}-week streak
                    </span>
                  )}
                </div>
                <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                  {/* Headline */}
                  <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: "var(--c-text)", lineHeight: 1.4, fontStyle: "italic" }}>
                    &ldquo;{generateHeadline(activeLeague)}&rdquo;
                  </p>
                  {/* Stats row */}
                  <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ flex: 1, background: "var(--c-bg)", borderRadius: 10, border: "1px solid var(--c-border-strong)", padding: "10px 14px" }}>
                      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-text-dim)", marginBottom: 4 }}>Top This GW</p>
                      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "var(--c-text)", marginBottom: 2 }}>{activeLeague.gwTopScorerName}</p>
                      <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#FF5A1F", lineHeight: 1 }}>{activeLeague.gwTopScorerPts}</p>
                    </div>
                    <div style={{ flex: 1, background: "var(--c-bg)", borderRadius: 10, border: "1px solid var(--c-border-strong)", padding: "10px 14px" }}>
                      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-text-dim)", marginBottom: 4 }}>Your Score</p>
                      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "var(--c-text)", marginBottom: 2 }}>{activeLeague.myTeamName}</p>
                      <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: activeLeague.gwPoints >= activeLeague.gwLeagueAvg ? "#16A34A" : "var(--c-text)", lineHeight: 1 }}>{activeLeague.gwPoints}</p>
                    </div>
                    <div style={{ flex: 1, background: "var(--c-bg)", borderRadius: 10, border: "1px solid var(--c-border-strong)", padding: "10px 14px" }}>
                      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-text-dim)", marginBottom: 4 }}>League Avg</p>
                      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "var(--c-text)", marginBottom: 2 }}>All teams</p>
                      <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "var(--c-text-muted)", lineHeight: 1 }}>{activeLeague.gwLeagueAvg}</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
