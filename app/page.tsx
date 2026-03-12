"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NavBar } from "@/components/NavBar";
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
};

export default function LeagueHubPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState("Gaffer");
  const [initials, setInitials] = useState("?");
  const [leagues, setLeagues] = useState<LeagueData[]>([]);
  const [activeLeague, setActiveLeague] = useState<LeagueData | null>(null);
  const [tab, setTab] = useState("overview");

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
      const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
      setGreeting(displayName);
      setInitials(rawName.slice(0, 2).toUpperCase());

      // User's teams, with league data embedded
      const { data: myTeams } = await supabase
        .from("teams")
        .select(`
          id,
          name,
          total_points,
          gw_points,
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

      // All teams in those leagues (for rank + leader calculation)
      const { data: allTeams } = await supabase
        .from("teams")
        .select("id, league_id, name, total_points")
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

        return {
          id: league.id,
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
        };
      });

      setLeagues(enriched);
      setActiveLeague(enriched[0]);
      setLoading(false);
    }

    load();
  }, []);

  const navLinks = activeLeague
    ? [
        { label: "Home", href: "/" },
        { label: "Draft", href: `/leagues/${activeLeague.id}/draft` },
        { label: "Scoring", href: `/leagues/${activeLeague.id}/scoring` },
        { label: "Live", href: `/leagues/${activeLeague.id}/live` },
        { label: "Stats", href: `/leagues/${activeLeague.id}/table` },
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
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "linear-gradient(135deg, #FF5A1F, #E8400A)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'DM Mono', monospace", fontSize: 12, color: "white",
              minWidth: 32, minHeight: 32,
            }}>{initials}</div>
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
                    onClick={() => { setActiveLeague(l); setTab("overview"); }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div>
                        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "var(--c-text)", marginBottom: 2 }}>{l.name}</p>
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
                  <div style={{ padding: "18px 20px 10px", borderBottom: "1px solid var(--c-border)", display: "flex", justifyContent: "space-between" }}>
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--c-text-muted)" }}>Your Squad</p>
                  </div>
                  <div style={{ padding: isMobile ? "28px 16px" : "48px 24px", textAlign: "center" }}>
                    <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "var(--c-text)", marginBottom: 8 }}>
                      No squad yet.
                    </p>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--c-text-muted)", lineHeight: 1.6 }}>
                      Your drafted players will appear here after the draft is complete.
                    </p>
                  </div>
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

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
