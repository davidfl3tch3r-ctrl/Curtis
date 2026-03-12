"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NavBar } from "@/components/NavBar";
import { useIsMobile } from "@/lib/use-is-mobile";

type TeamRow = {
  id: string;
  name: string;
  user_id: string;
  total_points: number;
  gw_points: number;
  draft_position: number;
  streak: number;
  username: string | null;
  won: number;
  drawn: number;
  lost: number;
  played: number;
};

export default function LeagueTablePage() {
  const params = useParams();
  const leagueId = params.id as string;
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(true);
  const [leagueName, setLeagueName] = useState("");
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [gwName, setGwName] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (user) setMyUserId(user.id);

      // League name
      const { data: league } = await supabase
        .from("leagues")
        .select("name")
        .eq("id", leagueId)
        .single();
      if (league) setLeagueName(league.name);

      // Current gameweek name (for column header)
      const { data: gws } = await supabase
        .from("gameweeks")
        .select("name")
        .in("status", ["live", "complete"])
        .order("number", { ascending: false })
        .limit(1);
      if (gws?.[0]) setGwName(gws[0].name);

      // All teams in this league
      const { data: teamsData } = await supabase
        .from("teams")
        .select("id, name, user_id, total_points, gw_points, draft_position, streak")
        .eq("league_id", leagueId)
        .order("total_points", { ascending: false });

      if (!teamsData?.length) { setLoading(false); return; }

      // Get usernames for all team owners
      const userIds = teamsData.map(t => t.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", userIds);

      const profileMap: Record<string, string> = {};
      for (const p of profiles ?? []) profileMap[p.id] = p.username;

      // Get matchup W/D/L from matchups table
      const { data: matchups } = await supabase
        .from("matchups")
        .select("home_team_id, away_team_id, home_points, away_points, status")
        .eq("league_id", leagueId)
        .eq("status", "complete");

      const wdl: Record<string, { w: number; d: number; l: number; played: number }> = {};
      for (const t of teamsData) wdl[t.id] = { w: 0, d: 0, l: 0, played: 0 };

      for (const m of matchups ?? []) {
        const hId = m.home_team_id;
        const aId = m.away_team_id;
        if (!wdl[hId] || !wdl[aId]) continue;
        wdl[hId].played++;
        wdl[aId].played++;
        if (m.home_points > m.away_points) {
          wdl[hId].w++; wdl[aId].l++;
        } else if (m.home_points < m.away_points) {
          wdl[hId].l++; wdl[aId].w++;
        } else {
          wdl[hId].d++; wdl[aId].d++;
        }
      }

      setTeams(teamsData.map(t => ({
        ...t,
        streak: (t as unknown as { streak?: number }).streak ?? 0,
        username: profileMap[t.user_id] ?? null,
        won:    wdl[t.id]?.w ?? 0,
        drawn:  wdl[t.id]?.d ?? 0,
        lost:   wdl[t.id]?.l ?? 0,
        played: wdl[t.id]?.played ?? 0,
      })));

      setLoading(false);
    }
    load();
  }, [leagueId]);

  const navLinks = [
    { label: "Home",     href: "/" },
    { label: "Draft",    href: `/leagues/${leagueId}/draft` },
    { label: "Scoring",  href: `/leagues/${leagueId}/scoring` },
    { label: "Live",     href: `/leagues/${leagueId}/live` },
    { label: "Stats",    href: `/leagues/${leagueId}/table` },
    { label: "Waivers",  href: `/leagues/${leagueId}/waivers` },
    { label: "Trades",   href: `/leagues/${leagueId}/trades` },
    { label: "Chat",     href: `/leagues/${leagueId}/chat` },
    { label: "Messages", href: `/leagues/${leagueId}/messages` },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--c-bg)", color: "var(--c-text)", overflowX: "hidden" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: var(--c-border-strong); border-radius: 2px; }
      `}</style>

      <NavBar links={navLinks} activeLabel="Stats" right={<ThemeToggle size="sm" />} />

      <div style={{ maxWidth: 860, margin: "0 auto", padding: isMobile ? "20px 16px" : "28px 20px" }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-text-dim)", marginBottom: 4 }}>{leagueName}</div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: isMobile ? 22 : 28, fontWeight: 900 }}>League Table</h1>
        </div>

        {loading ? (
          <div style={{ padding: "60px 0", textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--c-text-dim)", letterSpacing: "0.1em" }}>Loading…</div>
        ) : teams.length === 0 ? (
          <div style={{ padding: "60px 0", textAlign: "center" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "var(--c-text-dim)", marginBottom: 12 }}>No teams in this league yet</div>
            <Link href={`/leagues/${leagueId}/draft`} style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#FF5A1F", textDecoration: "none" }}>Go to Draft →</Link>
          </div>
        ) : (
          <div className="table-scroll" style={{ background: "var(--c-bg)", borderRadius: 14, border: "1px solid var(--c-border)", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 60px 60px 60px 60px 72px 72px", gap: 0, padding: "10px 20px", borderBottom: "1px solid var(--c-border)", background: "var(--c-bg-elevated)" }}>
              {["#", "Team", "P", "W", "D", "L", gwName ?? "GW Pts", "Total"].map((h, i) => (
                <div key={i} style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--c-text-dim)", textAlign: i > 1 ? "center" : "left" }}>{h}</div>
              ))}
            </div>

            {teams.map((team, idx) => {
              const isMe = team.user_id === myUserId;
              return (
                <div key={team.id} style={{
                  display: "grid", gridTemplateColumns: "36px 1fr 60px 60px 60px 60px 72px 72px",
                  gap: 0, padding: "13px 20px",
                  borderBottom: "1px solid var(--c-border)",
                  background: isMe ? "rgba(255,90,31,0.05)" : "transparent",
                  transition: "background 0.15s",
                }}>
                  {/* Rank */}
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: idx === 0 ? "#FF5A1F" : "#4A3E34", fontWeight: idx === 0 ? 700 : 400 }}>
                      {idx + 1}
                    </span>
                  </div>

                  {/* Team + manager */}
                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {isMe && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#FF5A1F", flexShrink: 0 }} />}
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: isMe ? 600 : 400, color: isMe ? "var(--c-text)" : "var(--c-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {team.name}
                      </span>
                      {team.streak >= 2 && (
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, background: "rgba(255,90,31,0.1)", color: "#FF5A1F", border: "1px solid rgba(255,90,31,0.2)", borderRadius: 4, padding: "1px 5px", flexShrink: 0 }}>
                          🔥{team.streak}
                        </span>
                      )}
                    </div>
                    {team.username && (
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-dim)", letterSpacing: "0.06em", marginTop: 1 }}>
                        {team.username}
                      </span>
                    )}
                  </div>

                  {/* P W D L */}
                  {[team.played, team.won, team.drawn, team.lost].map((v, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: i === 1 ? "var(--c-success)" : i === 3 ? "#DC2626" : "var(--c-text-muted)" }}>{v}</span>
                    </div>
                  ))}

                  {/* GW Points */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 600, color: (team.gw_points ?? 0) > 0 ? "#FF5A1F" : "var(--c-text-dim)" }}>
                      {(team.gw_points ?? 0).toFixed(1)}
                    </span>
                  </div>

                  {/* Total Points */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: "var(--c-text)" }}>
                      {(team.total_points ?? 0).toFixed(1)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {teams.length > 0 && (
          <div style={{ marginTop: 16, display: "flex", gap: 20 }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-dim)", letterSpacing: "0.06em" }}>
              P = Played · W = Won · D = Drawn · L = Lost
            </div>
            {!gwName && (
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-dim)", letterSpacing: "0.06em" }}>
                GW points appear after first score sync
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
