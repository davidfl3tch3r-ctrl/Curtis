"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NavBar } from "@/components/NavBar";
import { useIsMobile } from "@/lib/use-is-mobile";

// ─── TYPES ────────────────────────────────────────────────────────────────────

type Gameweek = { id: string; number: number; name: string; status: string };

type SquadPlayer = {
  id: string;
  player_id: string;
  is_starting: boolean;
  bench_order: number | null;
  player: {
    name: string;
    club: string;
    position: "GK" | "DEF" | "MID" | "FWD";
    gw_points: number;
  };
};

type Fixture = {
  id: string;
  home_club: string;
  away_club: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  minute: number | null;
  kickoff: string;
};

type Matchup = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_points: number;
  away_points: number;
  status: string;
  home_team: { name: string };
  away_team: { name: string };
};

const POS_ORDER = ["GK", "DEF", "MID", "FWD"] as const;
const POS_META: Record<string, { color: string; bg: string }> = {
  GK:  { color: "#92400E", bg: "#FEF9C3" },
  DEF: { color: "#1E40AF", bg: "#DBEAFE" },
  MID: { color: "#6B21A8", bg: "#F3E8FF" },
  FWD: { color: "#C2410C", bg: "#FFF1EC" },
};
const CLUB_COLORS: Record<string, string> = {
  LIV: "#C8102E", ARS: "#EF0107", MCI: "#6CABDD", CHE: "#034694",
  AVL: "#670E36", BRE: "#E30613", TOT: "#132257", EVE: "#003399",
  NEW: "#241F20", FUL: "#CC0000", MUN: "#DA291C", BOU: "#DA291C",
  WHU: "#7A263A", WOL: "#FDB913", NFO: "#E53233", IPS: "#3A64A3",
  LEI: "#003090", SOU: "#D71920", CRY: "#1B458F", BHA: "#0057B8",
};

function ClubBadge({ club, size = 26 }: { club: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28,
      background: CLUB_COLORS[club] ?? "#555",
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      <span style={{ color: "white", fontSize: size * 0.42, fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>
        {club[0]}
      </span>
    </div>
  );
}

export default function LiveScoringPage() {
  const params = useParams();
  const leagueId = params.id as string;
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(true);
  const [leagueName, setLeagueName] = useState("");
  const [gameweek, setGameweek] = useState<Gameweek | null>(null);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [myTeamName, setMyTeamName] = useState("");
  const [myGWPoints, setMyGWPoints] = useState(0);
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [matchup, setMatchup] = useState<Matchup | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [curtisMoment, setCurtisMoment] = useState<{ playerName: string; position: string; club: string; points: number } | null>(null);

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  async function load() {
    setLoading(true);
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // League name
    const { data: league } = await supabase
      .from("leagues")
      .select("name")
      .eq("id", leagueId)
      .single();
    if (league) setLeagueName(league.name);

    // Current gameweek (live first, then most recent complete)
    const { data: gws } = await supabase
      .from("gameweeks")
      .select("id, number, name, status")
      .in("status", ["live", "complete"])
      .order("number", { ascending: false })
      .limit(1);

    const gw = gws?.[0] ?? null;
    setGameweek(gw);

    // My team in this league
    const { data: team } = await supabase
      .from("teams")
      .select("id, name, gw_points")
      .eq("league_id", leagueId)
      .eq("user_id", user.id)
      .single();

    if (team) {
      setMyTeamId(team.id);
      setMyTeamName(team.name);
      setMyGWPoints(team.gw_points ?? 0);
    }

    // Squad players with current gw_points
    if (team) {
      const { data: squadData } = await supabase
        .from("squad_players")
        .select("id, player_id, is_starting, bench_order, player:players(name, club, position, gw_points)")
        .eq("team_id", team.id)
        .order("bench_order", { ascending: true, nullsFirst: false });

      setSquad((squadData ?? []) as unknown as SquadPlayer[]);
    }

    // Matchup for this gameweek
    if (team && gw) {
      const { data: matchupData } = await supabase
        .from("matchups")
        .select("id, home_team_id, away_team_id, home_points, away_points, status, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)")
        .eq("league_id", leagueId)
        .eq("gameweek_id", gw.id)
        .or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`)
        .maybeSingle();

      setMatchup(matchupData as unknown as Matchup | null);
    }

    // Fixtures for this gameweek
    if (gw) {
      const { data: fixtureData } = await supabase
        .from("fixtures")
        .select("id, home_club, away_club, home_score, away_score, status, minute, kickoff")
        .eq("gameweek_id", gw.id)
        .order("kickoff");

      setFixtures(fixtureData ?? []);
    }

    // Curtis Moment: check if a DEF or GK is the top scorer in the league this GW
    if (gw) {
      const { data: leagueTeams } = await supabase
        .from("teams")
        .select("id")
        .eq("league_id", leagueId);
      const teamIds = (leagueTeams ?? []).map(t => t.id);
      if (teamIds.length > 0) {
        const { data: allSquadPlayers } = await supabase
          .from("squad_players")
          .select("player:players(name, position, club, gw_points)")
          .in("team_id", teamIds)
          .eq("is_starting", true);
        if (allSquadPlayers && allSquadPlayers.length > 0) {
          type SP = { player: { name: string; position: string; club: string; gw_points: number } };
          const sorted = [...(allSquadPlayers as unknown as SP[])].sort(
            (a, b) => (b.player?.gw_points ?? 0) - (a.player?.gw_points ?? 0)
          );
          const top = sorted[0]?.player;
          if (top && (top.position === "DEF" || top.position === "GK") && (top.gw_points ?? 0) > 0) {
            setCurtisMoment({ playerName: top.name, position: top.position, club: top.club, points: top.gw_points });
          } else {
            setCurtisMoment(null);
          }
        }
      }
    }

    setLoading(false);
  }

  // Realtime: re-fetch team gw_points when player_stats change
  useEffect(() => {
    if (!myTeamId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`live:${leagueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "player_stats" },
        () => {
          // Refresh squad points on any stats change
          refreshPoints();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTeamId, leagueId]);

  async function refreshPoints() {
    if (!myTeamId) return;
    const supabase = createClient();

    const { data: teamData } = await supabase
      .from("teams")
      .select("gw_points")
      .eq("id", myTeamId)
      .single();

    if (teamData) setMyGWPoints(teamData.gw_points ?? 0);

    const { data: squadData } = await supabase
      .from("squad_players")
      .select("id, player_id, is_starting, bench_order, player:players(name, club, position, gw_points)")
      .eq("team_id", myTeamId)
      .order("bench_order", { ascending: true, nullsFirst: false });

    if (squadData) setSquad(squadData as unknown as SquadPlayer[]);
  }

  async function handleSyncScores() {
    setSyncing(true);
    try {
      await fetch("/api/score/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      setLastSync(new Date().toLocaleTimeString());
      await load();
    } finally {
      setSyncing(false);
    }
  }

  const navLinks = [
    { label: "Home",     href: "/" },
    { label: "My Team",  href: `/leagues/${leagueId}/team` },
    { label: "Draft",    href: `/leagues/${leagueId}/draft` },
    { label: "Scoring",  href: `/leagues/${leagueId}/scoring` },
    { label: "Live",     href: `/leagues/${leagueId}/live` },
    { label: "Stats",    href: `/leagues/${leagueId}/table` },
    { label: "Waivers",  href: `/leagues/${leagueId}/waivers` },
    { label: "Trades",   href: `/leagues/${leagueId}/trades` },
    { label: "Chat",     href: `/leagues/${leagueId}/chat` },
    { label: "Messages", href: `/leagues/${leagueId}/messages` },
  ];

  const starters = squad.filter(s => s.is_starting);
  const bench    = squad.filter(s => !s.is_starting);

  if (loading) {
    return (
      <div style={{ height: "100vh", background: "var(--c-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--c-text-dim)", letterSpacing: "0.12em" }}>Loading…</div>
      </div>
    );
  }

  // Opponent details from matchup
  const isHome       = matchup?.home_team_id === myTeamId;
  const myMatchPts   = matchup ? (isHome ? matchup.home_points : matchup.away_points) : myGWPoints;
  const oppTeamName  = matchup ? (isHome ? matchup.away_team?.name : matchup.home_team?.name) : null;
  const oppMatchPts  = matchup ? (isHome ? matchup.away_points : matchup.home_points) : null;

  const syncButton = (
    <button
      onClick={handleSyncScores}
      disabled={syncing}
      style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid rgba(255,90,31,0.3)", background: "rgba(255,90,31,0.1)", color: "#FF5A1F", fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.08em", cursor: syncing ? "not-allowed" : "pointer", opacity: syncing ? 0.6 : 1, minHeight: 44, whiteSpace: "nowrap" }}
    >
      {syncing ? "Syncing…" : "↻ Sync"}
    </button>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--c-bg)", color: "var(--c-text)", overflowX: "hidden" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: var(--c-border-strong); border-radius: 2px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>

      <NavBar links={navLinks} activeLabel="Live" right={<>{syncButton}<ThemeToggle size="sm" /></>} />

      <div style={{ maxWidth: 960, margin: "0 auto", padding: isMobile ? "20px 16px" : "24px 20px" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-text-dim)", marginBottom: 4 }}>
            {leagueName}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: isMobile ? 22 : 28, fontWeight: 900 }}>
              {gameweek ? gameweek.name : "No Gameweek Active"}
            </h1>
            {gameweek && (
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: gameweek.status === "live" ? "var(--c-success)" : "var(--c-text-muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                {gameweek.status === "live" ? "● Live" : "Complete"}
              </span>
            )}
          </div>
          {lastSync && (
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-dim)", marginTop: 4, letterSpacing: "0.06em" }}>
              Last synced {lastSync}
            </div>
          )}
        </div>

        {!gameweek ? (
          <div style={{ padding: "60px 0", textAlign: "center" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "var(--c-text-dim)", marginBottom: 12 }}>No gameweek data yet</div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--c-text-dim)", maxWidth: 360, margin: "0 auto 24px" }}>
              Use the admin sync to pull the current gameweek from API-Football.
            </p>
            <Link href="/admin/sync" style={{ padding: "10px 20px", borderRadius: 8, background: "var(--c-accent)", color: "white", fontFamily: "'DM Mono', monospace", fontSize: 11, textDecoration: "none", letterSpacing: "0.06em" }}>
              Go to Admin Sync
            </Link>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 300px", gap: 20 }}>

            {/* LEFT — Squad */}
            <div>
              {/* Curtis Moment banner */}
              {curtisMoment && (
                <div style={{
                  background: "linear-gradient(135deg, #1C1410 0%, #3D2E22 100%)",
                  border: "1.5px solid rgba(255,90,31,0.4)",
                  borderRadius: 14, padding: "16px 20px", marginBottom: 16,
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                }}>
                  <div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>
                      ⚡ Curtis Moment
                    </div>
                    <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: "white", lineHeight: 1.3 }}>
                      {curtisMoment.playerName}{" "}
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 400 }}>({curtisMoment.position})</span>{" "}
                      <span style={{ color: "#FF5A1F" }}>is leading this gameweek!</span>
                    </p>
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 4, letterSpacing: "0.04em" }}>
                      {curtisMoment.points.toFixed(1)} pts · {curtisMoment.club}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const url = window.location.href;
                      navigator.clipboard.writeText(url).then(() => alert("Link copied!"));
                    }}
                    style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,90,31,0.4)", background: "rgba(255,90,31,0.12)", color: "#FF5A1F", fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.08em", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
                  >
                    Share
                  </button>
                </div>
              )}

              {/* Matchup banner */}
              {matchup ? (
                <div style={{ background: "var(--c-bg-elevated)", borderRadius: 14, padding: "20px 24px", marginBottom: 20, border: "1.5px solid var(--c-border)" }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-text-dim)", marginBottom: 14 }}>Matchup</div>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto 1fr", alignItems: "center", gap: isMobile ? 8 : 16 }}>
                    <div>
                      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "var(--c-text)", marginBottom: 4 }}>{myTeamName}</div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 40, fontWeight: 900, color: "#FF5A1F", lineHeight: 1 }}>{myMatchPts.toFixed(1)}</div>
                    </div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "var(--c-text-dim)", letterSpacing: "0.1em" }}>VS</div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "var(--c-text-muted)", marginBottom: 4 }}>{oppTeamName}</div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 40, fontWeight: 900, color: "var(--c-text-muted)", lineHeight: 1 }}>{(oppMatchPts ?? 0).toFixed(1)}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ background: "var(--c-bg-elevated)", borderRadius: 14, padding: "16px 24px", marginBottom: 20, border: "1.5px solid var(--c-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-text-dim)", marginBottom: 4 }}>{myTeamName}</div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 900, color: "#FF5A1F", lineHeight: 1 }}>{myGWPoints.toFixed(1)}</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-dim)", marginTop: 4, letterSpacing: "0.06em" }}>Gameweek points</div>
                  </div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--c-text-dim)", letterSpacing: "0.06em" }}>No matchup scheduled</div>
                </div>
              )}

              {/* Starters */}
              {squad.length === 0 ? (
                <div style={{ padding: "40px 0", textAlign: "center" }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--c-text-dim)", marginBottom: 8 }}>No squad picked yet</div>
                  <Link href={`/leagues/${leagueId}/draft`} style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#FF5A1F", textDecoration: "none" }}>Go to Draft →</Link>
                </div>
              ) : (
                <>
                  {(["GK", "DEF", "MID", "FWD"] as const).map(pos => {
                    const posPlayers = starters.filter(s => s.player?.position === pos);
                    if (posPlayers.length === 0) return null;
                    const pm = POS_META[pos];
                    return (
                      <div key={pos} style={{ marginBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", padding: "3px 7px", borderRadius: 5, background: pm.bg, color: pm.color }}>{pos}</span>
                        </div>
                        {posPlayers.map(sp => (
                          <div key={sp.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: "var(--c-bg-elevated)", border: "1px solid var(--c-border)", marginBottom: 4 }}>
                            <ClubBadge club={sp.player?.club ?? ""} size={28} />
                            <span style={{ flex: 1, fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500, color: "var(--c-text)" }}>{sp.player?.name}</span>
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--c-text-muted)" }}>{sp.player?.club}</span>
                            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: (sp.player?.gw_points ?? 0) > 0 ? "#FF5A1F" : "var(--c-text-dim)", minWidth: 40, textAlign: "right" }}>
                              {(sp.player?.gw_points ?? 0).toFixed(1)}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })}

                  {/* Bench */}
                  {bench.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-text-dim)", marginBottom: 8 }}>Bench</div>
                      {bench.map(sp => (
                        <div key={sp.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderRadius: 8, background: "var(--c-card)", border: "1px solid var(--c-card-border)", marginBottom: 3, opacity: 0.6 }}>
                          <ClubBadge club={sp.player?.club ?? ""} size={24} />
                          <span style={{ flex: 1, fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--c-text-muted)" }}>{sp.player?.name}</span>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-dim)" }}>{sp.player?.position}</span>
                          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 600, color: "var(--c-text-dim)", minWidth: 36, textAlign: "right" }}>
                            {(sp.player?.gw_points ?? 0).toFixed(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* RIGHT — Fixtures */}
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-text-dim)", marginBottom: 12 }}>
                {gameweek.name} Fixtures
              </div>

              {fixtures.length === 0 ? (
                <div style={{ padding: "24px 0", fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--c-text-dim)", textAlign: "center" }}>
                  No fixtures — sync scores to populate
                </div>
              ) : (
                fixtures.map(f => (
                  <div key={f.id} style={{ padding: "10px 14px", borderRadius: 10, background: "var(--c-bg-elevated)", border: `1px solid ${f.status === "live" ? "rgba(255,90,31,0.2)" : "var(--c-border)"}`, marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {/* Status dot */}
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: f.status === "live" ? "#FF5A1F" : f.status === "complete" ? "var(--c-success)" : "var(--c-text-dim)", flexShrink: 0, ...(f.status === "live" ? { animation: "pulse 1.5s infinite" } : {}) }} />

                      <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                        <ClubBadge club={f.home_club} size={20} />
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--c-text-muted)" }}>{f.home_club}</span>
                        {f.status !== "scheduled" ? (
                          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 700, color: "var(--c-text)", margin: "0 4px" }}>
                            {f.home_score ?? 0} – {f.away_score ?? 0}
                          </span>
                        ) : (
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-dim)", margin: "0 4px" }}>vs</span>
                        )}
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--c-text-muted)" }}>{f.away_club}</span>
                        <ClubBadge club={f.away_club} size={20} />
                      </div>

                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: f.status === "live" ? "#FF5A1F" : "var(--c-text-dim)", letterSpacing: "0.06em", flexShrink: 0 }}>
                        {f.status === "live" ? `${f.minute}'` : f.status === "complete" ? "FT" : new Date(f.kickoff).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
