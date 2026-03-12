"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

// ─── TIER CONFIG ──────────────────────────────────────────────────────────────

const TIERS = [
  { level: 6, name: "Curtis Elite",    short: "ELITE",  accent: "#FF5A1F", bg: "#FFF5F0", border: "#FF5A1F" },
  { level: 5, name: "Championship",    short: "CHAMP",  accent: "#DC2626", bg: "#FEF2F2", border: "#FCA5A5" },
  { level: 4, name: "League One",      short: "L1",     accent: "#D97706", bg: "#FFFBEB", border: "#FCD34D" },
  { level: 3, name: "League Two",      short: "L2",     accent: "#CA8A04", bg: "#FEFCE8", border: "#FDE68A" },
  { level: 2, name: "National League", short: "NAT",    accent: "#16A34A", bg: "#F0FDF4", border: "#86EFAC" },
  { level: 1, name: "Regional League", short: "REG",    accent: "#2563EB", bg: "#EFF6FF", border: "#93C5FD" },
];

// ─── ZONE LOGIC ───────────────────────────────────────────────────────────────

function getZone(pos: number, tier: number, total: number) {
  if (total < 4) return { label: "", color: "transparent", icon: "" };
  if (tier === 6) {
    // Curtis Elite: no promotion; bottom 2 relegated
    if (pos >= total - 1) return { label: "Relegated",          color: "#EF4444", icon: "⬇" };
    if (pos >= total - 3) return { label: "Relegation Playoff", color: "#F97316", icon: "↕" };
    return { label: "", color: "transparent", icon: "" };
  }
  if (tier === 1) {
    // Regional: no relegation; top 2 promoted
    if (pos <= 2) return { label: "Promoted",         color: "#22C55E", icon: "⬆" };
    if (pos <= 4) return { label: "Promotion Playoff", color: "#84CC16", icon: "↕" };
    return { label: "", color: "transparent", icon: "" };
  }
  // Mid tiers
  if (pos <= 2) return { label: "Promoted",          color: "#22C55E", icon: "⬆" };
  if (pos <= 4) return { label: "Promotion Playoff",  color: "#84CC16", icon: "↕" };
  if (pos <= 6) return { label: "Relegation Playoff", color: "#F97316", icon: "↕" };
  return       { label: "Relegated",                  color: "#EF4444", icon: "⬇" };
}

// ─── TYPES ────────────────────────────────────────────────────────────────────

type TeamRow = {
  id: string;
  name: string;
  user_id: string;
  total_points: number;
  gw_points: number;
  username: string;
  won: number;
  drawn: number;
  lost: number;
  played: number;
  form: ("W" | "D" | "L")[];
};

type TierSummary = {
  level: number;
  groupCount: number;
  managerCount: number;
};

// ─── FORM BADGE ───────────────────────────────────────────────────────────────

function FormBadge({ result }: { result: "W" | "D" | "L" }) {
  const colors = { W: "#22C55E", D: "#F59E0B", L: "#EF4444" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 22, height: 22, borderRadius: 5,
      background: colors[result], color: "white",
      fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 700,
    }}>
      {result}
    </span>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function PyramidPage() {
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [myLeagueId, setMyLeagueId] = useState<string | null>(null);
  const [myTier, setMyTier] = useState<number>(1);
  const [myLeagueName, setMyLeagueName] = useState<string>("");
  const [myGroupLabel, setMyGroupLabel] = useState<string>("");
  const [standings, setStandings] = useState<TeamRow[]>([]);
  const [tierSummaries, setTierSummaries] = useState<TierSummary[]>([]);
  const [currentGW, setCurrentGW] = useState<number>(0);
  const [totalGW] = useState<number>(38);
  const [loading, setLoading] = useState(true);
  const [noLeague, setNoLeague] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); setNoLeague(true); return; }
    setMyUserId(user.id);

    // Find user's public pyramid league (is_public = true, has tier)
    const { data: myTeamRow } = await supabase
      .from("teams")
      .select("id, league_id, league:leagues!league_id(id, name, tier, pyramid_group, is_public, draft_status)")
      .eq("user_id", user.id)
      .filter("league.is_public", "eq", true)
      .maybeSingle();

    const leagueRaw = myTeamRow?.league;
    const league = (Array.isArray(leagueRaw) ? leagueRaw[0] : leagueRaw) as {
      id: string; name: string; tier: number; pyramid_group: string | null; is_public: boolean; draft_status: string;
    } | null;

    if (!league) {
      // Still show pyramid structure even if user isn't in a public league
      await loadTierSummaries(supabase);
      setLoading(false);
      setNoLeague(true);
      return;
    }

    setMyLeagueId(league.id);
    setMyTier(league.tier ?? 1);
    setMyLeagueName(league.name);
    setMyGroupLabel(league.pyramid_group ? `Group ${league.pyramid_group}` : "");

    // Current gameweek
    const { data: gw } = await supabase
      .from("gameweeks")
      .select("number")
      .in("status", ["live", "complete"])
      .order("number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (gw) setCurrentGW(gw.number);

    // All teams in the league
    const { data: leagueTeams } = await supabase
      .from("teams")
      .select("id, name, user_id, total_points, gw_points")
      .eq("league_id", league.id)
      .eq("is_bot", false)
      .order("total_points", { ascending: false });

    if (!leagueTeams?.length) {
      await loadTierSummaries(supabase);
      setLoading(false);
      return;
    }

    const teamIds = leagueTeams.map((t) => t.id);
    const userIds = leagueTeams.map((t) => t.user_id).filter(Boolean);

    // Usernames
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", userIds);
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.username]));

    // Matchup results for W/D/L
    const { data: matchups } = await supabase
      .from("matchups")
      .select("home_team_id, away_team_id, home_points, away_points, winner_team_id, status, gameweek_id")
      .eq("league_id", league.id)
      .eq("status", "complete")
      .order("gameweek_id", { ascending: true });

    // Build W/D/L records and form (last 5) per team
    const record: Record<string, { won: number; drawn: number; lost: number; results: ("W" | "D" | "L")[] }> =
      Object.fromEntries(teamIds.map((id) => [id, { won: 0, drawn: 0, lost: 0, results: [] }]));

    for (const m of matchups ?? []) {
      const isDraw = m.home_points === m.away_points;
      for (const [teamId, side] of [[m.home_team_id, "home"], [m.away_team_id, "away"]] as const) {
        if (!record[teamId]) continue;
        if (isDraw) {
          record[teamId].drawn++;
          record[teamId].results.push("D");
        } else if (m.winner_team_id === teamId) {
          record[teamId].won++;
          record[teamId].results.push("W");
        } else {
          record[teamId].lost++;
          record[teamId].results.push("L");
        }
      }
    }

    const rows: TeamRow[] = leagueTeams.map((t) => {
      const r = record[t.id] ?? { won: 0, drawn: 0, lost: 0, results: [] };
      return {
        id: t.id,
        name: t.name,
        user_id: t.user_id,
        total_points: t.total_points,
        gw_points: t.gw_points,
        username: profileMap.get(t.user_id) ?? t.name,
        won:    r.won,
        drawn:  r.drawn,
        lost:   r.lost,
        played: r.won + r.drawn + r.lost,
        form:   r.results.slice(-5) as ("W" | "D" | "L")[],
      };
    });

    setStandings(rows);
    await loadTierSummaries(supabase);
    setLoading(false);
  }

  async function loadTierSummaries(supabase: ReturnType<typeof createClient>) {
    const { data: leagues } = await supabase
      .from("leagues")
      .select("tier")
      .eq("is_public", true)
      .eq("draft_status", "complete");

    const counts: Record<number, number> = {};
    for (const l of leagues ?? []) {
      const t = l.tier ?? 1;
      counts[t] = (counts[t] ?? 0) + 1;
    }

    const summaries = TIERS.map((t) => ({
      level:        t.level,
      groupCount:   counts[t.level] ?? 0,
      managerCount: (counts[t.level] ?? 0) * 8,
    }));
    setTierSummaries(summaries);
  }

  const tierConfig = TIERS.find((t) => t.level === myTier) ?? TIERS[5];

  return (
    <div style={{ minHeight: "100vh", background: "#FAF7F2", color: "#1C1410" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .nav-link { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.09em; text-transform: uppercase; color: #A89880; text-decoration: none; transition: color 0.15s; }
        .nav-link:hover, .nav-link.active { color: #FF5A1F; }
        .standings-row {
          display: grid;
          grid-template-columns: 36px 1fr 40px 40px 40px 40px 64px 100px 120px;
          align-items: center;
          gap: 4px;
          padding: 11px 16px;
          border-radius: 10px;
          transition: background 0.12s;
        }
        .standings-row:hover { background: #F0EAE0; }
        .standings-row.me { background: #FFF5F0; border: 1.5px solid #FDBA8C; }
        .col-label {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #A89880;
          padding: 0 16px 8px;
          display: grid;
          grid-template-columns: 36px 1fr 40px 40px 40px 40px 64px 100px 120px;
          gap: 4px;
        }
        .zone-bar {
          width: 4px;
          height: 32px;
          border-radius: 2px;
          flex-shrink: 0;
        }
        .pyramid-tier {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 24px;
          border-radius: 12px;
          cursor: default;
          transition: transform 0.1s;
          border: 1.5px solid transparent;
        }
        .pyramid-tier:hover { transform: scale(1.01); }
        .pyramid-tier.current { border-width: 2px; }
      `}</style>

      {/* Nav */}
      <nav style={{ borderBottom: "1px solid #EDE5D8", padding: "0 24px", height: 56, display: "flex", alignItems: "center", gap: 28, background: "white" }}>
        <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#FF5A1F" }}>CURTIS</span>
        <Link href="/" className="nav-link">Home</Link>
        <Link href="/pyramid" className="nav-link active">Pyramid</Link>
        <Link href="/draft/queue" className="nav-link">Public Drafts</Link>
      </nav>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 24px 60px" }}>

        {/* Page header */}
        <div style={{ marginBottom: 40 }}>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#A89880", marginBottom: 6 }}>
            Season 2025–26 · Gameweek {currentGW || "—"} of {totalGW}
          </p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 38, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 10 }}>
            The Curtis<br />
            <span style={{ color: "#FF5A1F", fontStyle: "italic" }}>Pyramid</span>
          </h1>
          <p style={{ color: "#6B5E52", fontSize: 14, maxWidth: 480, lineHeight: 1.6 }}>
            Six tiers. One goal. Every manager fights for promotion — or survival.
            Top 2 go up automatically. 3rd/4th and 5th/6th meet in the playoffs.
          </p>
        </div>

        {/* Pyramid visualisation */}
        <div style={{ marginBottom: 48 }}>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#A89880", marginBottom: 16 }}>
            Division Structure
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {TIERS.map((tier, idx) => {
              const summary   = tierSummaries.find((s) => s.level === tier.level);
              const isCurrent = tier.level === myTier && !noLeague;
              // Pyramid width: Elite = 35%, Regional = 100%
              const widthPct  = 35 + ((6 - tier.level) / 5) * 65;

              return (
                <div key={tier.level} style={{ display: "flex", justifyContent: "center" }}>
                  <div
                    className={`pyramid-tier${isCurrent ? " current" : ""}`}
                    style={{
                      width: `${widthPct}%`,
                      background: isCurrent ? tier.bg : "#F7F3EE",
                      borderColor: isCurrent ? tier.accent : "#EDE5D8",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {isCurrent && (
                        <span style={{
                          fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.08em",
                          padding: "2px 7px", borderRadius: 4, background: tier.accent, color: "white",
                        }}>YOU</span>
                      )}
                      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 800, color: isCurrent ? tier.accent : "#1C1410" }}>
                        {tier.name}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                      {summary && summary.groupCount > 0 && (
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#A89880" }}>
                          {summary.groupCount} {summary.groupCount === 1 ? "group" : "groups"} · {summary.managerCount} managers
                        </span>
                      )}
                      {(!summary || summary.groupCount === 0) && (
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#C4B8AA" }}>No active leagues</span>
                      )}
                      <span style={{
                        fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.08em",
                        padding: "3px 9px", borderRadius: 5,
                        background: tier.bg, color: tier.accent,
                        border: `1px solid ${tier.border}`,
                      }}>
                        {tier.short}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Promotion/relegation key */}
        <div style={{ display: "flex", gap: 20, marginBottom: 36, flexWrap: "wrap" }}>
          {[
            { color: "#22C55E", label: "Automatic promotion" },
            { color: "#84CC16", label: "Promotion playoff" },
            { color: "#F97316", label: "Relegation playoff" },
            { color: "#EF4444", label: "Automatic relegation" },
          ].map((z) => (
            <div key={z.label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: z.color }} />
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#6B5E52" }}>{z.label}</span>
            </div>
          ))}
        </div>

        {/* User's group standings */}
        {noLeague && (
          <div style={{ background: "white", border: "1.5px solid #EDE5D8", borderRadius: 14, padding: "40px 32px", textAlign: "center" }}>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, marginBottom: 10 }}>You&apos;re not in a pyramid league yet</p>
            <p style={{ color: "#6B5E52", fontSize: 14, marginBottom: 24 }}>
              Join a public draft to enter the pyramid and start your climb.
            </p>
            <Link href="/draft/queue" style={{
              display: "inline-block", padding: "12px 28px", borderRadius: 10,
              background: "#FF5A1F", color: "white",
              fontFamily: "'DM Mono', monospace", fontSize: 12, letterSpacing: "0.08em",
              textDecoration: "none",
            }}>
              Browse Public Drafts →
            </Link>
          </div>
        )}

        {!noLeague && (
          <div>
            {/* Division header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
              <div>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#A89880", marginBottom: 4 }}>
                  Your Division
                </p>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 900 }}>
                  {tierConfig.name}
                  {myGroupLabel && (
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 400, color: "#A89880", marginLeft: 10 }}>
                      {myGroupLabel}
                    </span>
                  )}
                </h2>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{
                  fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.07em",
                  padding: "5px 12px", borderRadius: 7,
                  background: tierConfig.bg, color: tierConfig.accent,
                  border: `1.5px solid ${tierConfig.border}`,
                }}>
                  Tier {myTier} of 6
                </span>
                {myLeagueId && (
                  <Link href={`/leagues/${myLeagueId}/table`} style={{
                    fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.07em",
                    padding: "5px 12px", borderRadius: 7,
                    background: "white", color: "#1C1410",
                    border: "1.5px solid #EDE5D8", textDecoration: "none",
                  }}>
                    Full Table →
                  </Link>
                )}
              </div>
            </div>

            {/* Standings table */}
            <div style={{ background: "white", border: "1.5px solid #EDE5D8", borderRadius: 14, overflow: "hidden" }}>
              {/* Column headers */}
              <div style={{ padding: "10px 16px 2px", borderBottom: "1px solid #F0EAE0" }}>
                <div className="col-label">
                  <span>#</span>
                  <span>Manager</span>
                  <span style={{ textAlign: "center" }}>P</span>
                  <span style={{ textAlign: "center" }}>W</span>
                  <span style={{ textAlign: "center" }}>D</span>
                  <span style={{ textAlign: "center" }}>L</span>
                  <span style={{ textAlign: "right" }}>Pts</span>
                  <span>Form</span>
                  <span>Status</span>
                </div>
              </div>

              {loading && (
                <div style={{ padding: "32px 16px", textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#A89880" }}>
                  Loading standings…
                </div>
              )}

              {!loading && standings.map((team, idx) => {
                const pos   = idx + 1;
                const isMe  = team.user_id === myUserId;
                const zone  = getZone(pos, myTier, standings.length);

                return (
                  <div key={team.id} style={{ borderBottom: idx < standings.length - 1 ? "1px solid #F7F3EE" : "none" }}>
                    <div className={`standings-row${isMe ? " me" : ""}`}>
                      {/* Zone bar + position */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div className="zone-bar" style={{ background: zone.color !== "transparent" ? zone.color : "#EDE5D8" }} />
                        <span style={{
                          fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700,
                          color: zone.color !== "transparent" ? zone.color : "#A89880",
                        }}>
                          {pos}
                        </span>
                      </div>

                      {/* Manager name */}
                      <div>
                        <div style={{ fontWeight: isMe ? 700 : 500, fontSize: 14 }}>
                          {team.name}
                          {isMe && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#FF5A1F", marginLeft: 7, letterSpacing: "0.06em" }}>YOU</span>}
                        </div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#A89880", letterSpacing: "0.04em" }}>
                          {team.username}
                        </div>
                      </div>

                      {/* Played */}
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "#6B5E52", textAlign: "center" }}>{team.played}</span>

                      {/* Won */}
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "#22C55E", textAlign: "center" }}>{team.won}</span>

                      {/* Drawn */}
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "#F59E0B", textAlign: "center" }}>{team.drawn}</span>

                      {/* Lost */}
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "#EF4444", textAlign: "center" }}>{team.lost}</span>

                      {/* Points */}
                      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 800, color: "#1C1410", textAlign: "right" }}>
                        {Math.round(team.total_points)}
                      </span>

                      {/* Form */}
                      <div style={{ display: "flex", gap: 3 }}>
                        {team.form.length === 0 && (
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#C4B8AA" }}>—</span>
                        )}
                        {team.form.map((r, i) => <FormBadge key={i} result={r} />)}
                      </div>

                      {/* Status */}
                      <div>
                        {zone.label ? (
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.06em",
                            padding: "3px 8px", borderRadius: 5,
                            background: `${zone.color}18`, color: zone.color,
                          }}>
                            {zone.icon} {zone.label}
                          </span>
                        ) : (
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#C4B8AA" }}>Mid-table</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Season progress bar */}
            <div style={{ marginTop: 20, padding: "16px 20px", background: "white", borderRadius: 12, border: "1.5px solid #EDE5D8" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#6B5E52", letterSpacing: "0.06em" }}>
                  Season progress
                </span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#1C1410", fontWeight: 600 }}>
                  GW {currentGW || "—"} / {totalGW}
                </span>
              </div>
              <div style={{ height: 8, background: "#F0EAE0", borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${Math.min(100, (currentGW / totalGW) * 100)}%`,
                  background: "linear-gradient(90deg, #FF5A1F, #E8400A)",
                  borderRadius: 4,
                  transition: "width 0.6s ease",
                }} />
              </div>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#A89880", marginTop: 8, letterSpacing: "0.05em" }}>
                {totalGW - currentGW} gameweeks remaining · Promotion/relegation decided at GW {totalGW}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
