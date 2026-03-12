"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

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
        { label: "Pyramid",  href: "/pyramid" },
      ]
    : [{ label: "Home", href: "/" }, { label: "Pyramid", href: "/pyramid" }];

  const gap =
    activeLeague && activeLeague.leaderPoints > activeLeague.myPoints
      ? activeLeague.leaderPoints - activeLeague.myPoints
      : 0;

  return (
    <div style={{ minHeight: "100vh", background: "#FAF7F2", color: "#1C1410" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .league-card {
          border-radius: 14px;
          border: 1.5px solid #EDE5D8;
          padding: 18px 20px;
          cursor: pointer;
          transition: all 0.18s;
          background: white;
        }
        .league-card:hover { border-color: #FF5A1F; box-shadow: 0 4px 20px rgba(255,90,31,0.1); transform: translateY(-1px); }
        .league-card.active { border-color: #FF5A1F; box-shadow: 0 4px 24px rgba(255,90,31,0.15); }

        .tab-btn {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          padding: 8px 18px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          transition: all 0.15s;
          background: transparent;
          color: #A89880;
        }
        .tab-btn:hover { color: #1C1410; background: #F0E8DC; }
        .tab-btn.active { background: #FF5A1F; color: white; }

        .stat-box {
          background: white;
          border-radius: 14px;
          border: 1.5px solid #EDE5D8;
          padding: 20px 22px;
          flex: 1;
        }

        .new-btn {
          background: linear-gradient(135deg, #FF5A1F, #E8400A);
          color: white;
          border: none;
          border-radius: 10px;
          padding: 11px 22px;
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          box-shadow: 0 3px 12px rgba(255,90,31,0.3);
          transition: all 0.18s;
        }
        .new-btn:hover { transform: translateY(-1px); box-shadow: 0 5px 18px rgba(255,90,31,0.4); }

        .nav-link {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: #A89880;
          cursor: pointer;
          padding: 6px 0;
          border-bottom: 2px solid transparent;
          transition: all 0.15s;
          text-decoration: none;
          display: inline-block;
        }
        .nav-link:hover { color: #FF5A1F; }
        .nav-link.active { color: #FF5A1F; border-bottom-color: #FF5A1F; }

        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #E8D5C0; border-radius: 2px; }
      `}</style>

      {/* NAV */}
      <nav style={{
        height: 58, background: "#FAF7F2", borderBottom: "1px solid #EDE5D8",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 44px", position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{
            width: 34, height: 34,
            background: "linear-gradient(135deg, #FF5A1F 0%, #E8400A 100%)",
            borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 3px 10px rgba(255,90,31,0.35)",
          }}>
            <span style={{ color: "white", fontSize: 16 }}>◆</span>
          </div>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1 }}>CURTIS</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, letterSpacing: "0.14em", color: "#FF5A1F", textTransform: "uppercase" }}>Draft Football</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 32 }}>
          {navLinks.map(item => (
            <Link key={item.label} href={item.href} className={`nav-link${item.label === "Home" ? " active" : ""}`}>
              {item.label}
            </Link>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "linear-gradient(135deg, #FF5A1F, #E8400A)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'DM Mono', monospace", fontSize: 12, color: "white",
          }}>{initials}</div>
        </div>
      </nav>

      <div style={{ maxWidth: 1060, margin: "0 auto", padding: "40px 40px" }}>

        {/* Welcome */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
          <div>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#FF5A1F", marginBottom: 6 }}>
              Your Hub
            </p>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              Welcome back,<br />
              <span style={{ fontStyle: "italic", color: "#FF5A1F" }}>{greeting}.</span>
            </h1>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="new-btn" style={{ background: "transparent", border: "1.5px solid #EDE5D8", color: "#1C1410" }} onClick={() => router.push("/draft/queue")}>Join Public Draft</button>
            <button className="new-btn" onClick={() => router.push("/leagues/new")}>+ New League</button>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[1, 2].map(i => (
                <div key={i} style={{
                  height: 110, borderRadius: 14, background: "#F0E8DC",
                  animation: "pulse 1.5s ease-in-out infinite",
                  opacity: 1 - i * 0.2,
                }} />
              ))}
            </div>
            <div style={{ height: 300, borderRadius: 14, background: "#F0E8DC" }} />
          </div>
        )}

        {/* Empty state */}
        {!loading && leagues.length === 0 && (
          <div style={{
            textAlign: "center",
            padding: "80px 40px",
            background: "white",
            borderRadius: 20,
            border: "1.5px solid #EDE5D8",
          }}>
            <div style={{ fontSize: 48, marginBottom: 20 }}>🏆</div>
            <h2 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 28, fontWeight: 900,
              color: "#1C1410", marginBottom: 12,
            }}>
              Your pitch awaits.
            </h2>
            <p style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 15, color: "#9C8A7A",
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
          <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 24 }}>

            {/* LEFT — league list */}
            <div>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#A89880", marginBottom: 12 }}>
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
                        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "#1C1410", marginBottom: 2 }}>{l.name}</p>
                        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#A89880", letterSpacing: "0.06em" }}>{l.myTeamName}</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{
                          fontFamily: "'Playfair Display', serif",
                          fontSize: 22, fontWeight: 900,
                          color: l.rank === 1 ? "#FF5A1F" : "#1C1410",
                        }}>
                          {l.rank === 1 ? "🥇" : `#${l.rank}`}
                        </div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#A89880", letterSpacing: "0.06em" }}>of {l.teamCount}</div>
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#C0B09A", letterSpacing: "0.06em" }}>{l.season}</span>
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
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#A89880", letterSpacing: "0.08em", marginTop: 2 }}>
                    {activeLeague.myTeamName} · Season {activeLeague.season}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 4, background: "#F5EFE8", padding: 4, borderRadius: 10 }}>
                  {["overview", "squad", "activity"].map(t => (
                    <button key={t} className={`tab-btn${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>{t}</button>
                  ))}
                </div>
              </div>

              {/* Stat boxes */}
              <div style={{ display: "flex", gap: 12 }}>
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
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "#C0B09A", marginBottom: 6 }}>{s.label}</p>
                    <p style={{ fontFamily: "'Playfair Display', serif", fontSize: s.label === "Draft Status" ? 15 : 22, fontWeight: 900, color: "#1C1410", lineHeight: 1 }}>{s.value}</p>
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#A89880", marginTop: 4, letterSpacing: "0.04em" }}>{s.sub}</p>
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
                <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #EDE5D8", overflow: "hidden" }}>
                  <div style={{ padding: "18px 20px 10px", borderBottom: "1px solid #F5EFE8" }}>
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A89880" }}>Top Performers</p>
                  </div>
                  <div style={{ padding: "48px 24px", textAlign: "center" }}>
                    <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "#1C1410", marginBottom: 8 }}>
                      {activeLeague.draftStatus === "pending" ? "Draft hasn't started yet." : "No stats yet."}
                    </p>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#9C8A7A", lineHeight: 1.6 }}>
                      {activeLeague.draftStatus === "pending"
                        ? "Complete the draft to start tracking player points."
                        : "Player stats will appear here once the gameweek begins."}
                    </p>
                    {activeLeague.draftStatus === "pending" && (
                      <button
                        className="new-btn"
                        style={{ marginTop: 18, fontSize: 11 }}
                        onClick={() => router.push(`/leagues/${activeLeague.id}/draft`)}
                      >
                        Go to Draft Room
                      </button>
                    )}
                  </div>
                </div>
              )}

              {tab === "squad" && (
                <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #EDE5D8", overflow: "hidden" }}>
                  <div style={{ padding: "18px 20px 10px", borderBottom: "1px solid #F5EFE8", display: "flex", justifyContent: "space-between" }}>
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A89880" }}>Your Squad</p>
                  </div>
                  <div style={{ padding: "48px 24px", textAlign: "center" }}>
                    <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "#1C1410", marginBottom: 8 }}>
                      No squad yet.
                    </p>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#9C8A7A", lineHeight: 1.6 }}>
                      Your drafted players will appear here after the draft is complete.
                    </p>
                  </div>
                </div>
              )}

              {tab === "activity" && (
                <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #EDE5D8", overflow: "hidden" }}>
                  <div style={{ padding: "18px 20px 10px", borderBottom: "1px solid #F5EFE8" }}>
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A89880" }}>Activity Feed</p>
                  </div>
                  <div style={{ padding: "48px 24px", textAlign: "center" }}>
                    <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "#1C1410", marginBottom: 8 }}>
                      Nothing yet.
                    </p>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#9C8A7A", lineHeight: 1.6 }}>
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
