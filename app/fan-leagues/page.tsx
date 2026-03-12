"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

// ─── CLUB DATA ────────────────────────────────────────────────────────────────

const PL_CLUBS = [
  { name: "Arsenal",              abbr: "ARS", primary: "#EF0107", secondary: "#FFFFFF", text: "white" },
  { name: "Aston Villa",          abbr: "AVL", primary: "#670E36", secondary: "#95BFE5", text: "white" },
  { name: "Bournemouth",          abbr: "BOU", primary: "#B50E12", secondary: "#000000", text: "white" },
  { name: "Brentford",            abbr: "BRE", primary: "#E30613", secondary: "#FFE500", text: "white" },
  { name: "Brighton",             abbr: "BHA", primary: "#0057B8", secondary: "#FFFFFF", text: "white" },
  { name: "Chelsea",              abbr: "CHE", primary: "#034694", secondary: "#D1D1D1", text: "white" },
  { name: "Crystal Palace",       abbr: "CRY", primary: "#1B458F", secondary: "#C4122E", text: "white" },
  { name: "Everton",              abbr: "EVE", primary: "#003399", secondary: "#FFFFFF", text: "white" },
  { name: "Fulham",               abbr: "FUL", primary: "#CC0000", secondary: "#000000", text: "white" },
  { name: "Ipswich",              abbr: "IPS", primary: "#3A64A3", secondary: "#FFFFFF", text: "white" },
  { name: "Leicester",            abbr: "LEI", primary: "#003090", secondary: "#FDBE11", text: "white" },
  { name: "Liverpool",            abbr: "LIV", primary: "#C8102E", secondary: "#F6EB61", text: "white" },
  { name: "Manchester City",      abbr: "MCI", primary: "#6CABDD", secondary: "#FFFFFF", text: "#1C1410" },
  { name: "Manchester United",    abbr: "MUN", primary: "#DA291C", secondary: "#FFE500", text: "white" },
  { name: "Newcastle United",     abbr: "NEW", primary: "#241F20", secondary: "#FFFFFF", text: "white" },
  { name: "Nottingham Forest",    abbr: "NFO", primary: "#E53233", secondary: "#000000", text: "white" },
  { name: "Southampton",          abbr: "SOU", primary: "#D71920", secondary: "#FFFFFF", text: "white" },
  { name: "Tottenham Hotspur",    abbr: "TOT", primary: "#132257", secondary: "#FFFFFF", text: "white" },
  { name: "West Ham United",      abbr: "WHU", primary: "#7A263A", secondary: "#1BB1E7", text: "white" },
  { name: "Wolverhampton",        abbr: "WOL", primary: "#FDB913", secondary: "#231F20", text: "#1C1410" },
] as const;

type ClubName = typeof PL_CLUBS[number]["name"];

type ClubStats = {
  groupCount: number;
  memberCount: number;
  myLeagueId: string | null;
  myTeamId:   string | null;
  myPosition: number | null;
  myPoints:   number | null;
};

// ─── BADGE ────────────────────────────────────────────────────────────────────

function ClubBadge({ club, size = 64 }: { club: typeof PL_CLUBS[number]; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `radial-gradient(circle at 35% 35%, ${club.secondary}22, ${club.primary})`,
      border: `3px solid ${club.secondary}44`,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
      boxShadow: `0 4px 16px ${club.primary}40`,
    }}>
      <span style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: size * 0.28,
        fontWeight: 800,
        color: club.text,
        letterSpacing: "-0.02em",
      }}>
        {club.abbr}
      </span>
    </div>
  );
}

// ─── JOIN MODAL ───────────────────────────────────────────────────────────────

function JoinModal({
  club,
  onClose,
  onJoined,
}: {
  club: typeof PL_CLUBS[number];
  onClose: () => void;
  onJoined: (leagueId: string) => void;
}) {
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!teamName.trim()) { setError("Enter a team name"); return; }
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError("You must be logged in"); setLoading(false); return; }

    const res = await fetch("/api/fan-leagues/join", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ clubName: club.name, teamName }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) { setError(data.error ?? "Failed to join"); return; }
    onJoined(data.leagueId);
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "white", borderRadius: 20, padding: 32, width: "100%", maxWidth: 420 }}>
        {/* Club header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 16, marginBottom: 24,
          padding: "16px 20px", borderRadius: 14,
          background: `linear-gradient(135deg, ${club.primary}15, ${club.primary}05)`,
          border: `1.5px solid ${club.primary}25`,
        }}>
          <ClubBadge club={club} size={52} />
          <div>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A89880", marginBottom: 3 }}>
              Joining
            </p>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 800 }}>
              {club.name} Fan League
            </p>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#A89880", display: "block", marginBottom: 8 }}>
            Your Team Name
          </label>
          <input
            autoFocus
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={`e.g. ${club.abbr} Ultras FC`}
            style={{
              width: "100%", padding: "13px 16px",
              border: "2px solid #EDE5D8", borderRadius: 10,
              fontFamily: "'DM Sans', sans-serif", fontSize: 15,
              outline: "none", transition: "border-color 0.15s", color: "#1C1410",
            }}
            onFocus={(e) => (e.target.style.borderColor = club.primary)}
            onBlur={(e) => (e.target.style.borderColor = "#EDE5D8")}
          />
        </div>

        {error && (
          <p style={{ color: "#EF4444", fontFamily: "'DM Mono', monospace", fontSize: 12, marginBottom: 14 }}>{error}</p>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: "13px", borderRadius: 10, border: "1.5px solid #EDE5D8", background: "white", cursor: "pointer", fontFamily: "'DM Mono', monospace", fontSize: 12, letterSpacing: "0.07em" }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading}
            style={{
              flex: 2, padding: "13px", borderRadius: 10, border: "none",
              background: loading ? "#EDE5D8" : club.primary,
              color: loading ? "#A89880" : club.text,
              fontFamily: "'DM Mono', monospace", fontSize: 12, letterSpacing: "0.07em",
              cursor: loading ? "not-allowed" : "pointer", transition: "all 0.15s",
            }}
          >
            {loading ? "Joining…" : "Join Fan League"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function FanLeaguesPage() {
  const router = useRouter();
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [clubStats, setClubStats] = useState<Partial<Record<ClubName, ClubStats>>>({});
  const [loading, setLoading] = useState(true);
  const [joiningClub, setJoiningClub] = useState<typeof PL_CLUBS[number] | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (user) setMyUserId(user.id);

    // All fan leagues: id, fan_club, tier
    const { data: fanLeagues } = await supabase
      .from("leagues")
      .select("id, fan_club, tier")
      .not("fan_club", "is", null)
      .eq("draft_status", "complete");

    if (!fanLeagues?.length) { setLoading(false); return; }

    const leagueIds = fanLeagues.map((l) => l.id);

    // Team counts per league
    const { data: allTeams } = await supabase
      .from("teams")
      .select("id, league_id, user_id, total_points")
      .in("league_id", leagueIds)
      .eq("is_bot", false);

    // Build stats per club
    const stats: Partial<Record<ClubName, ClubStats>> = {};

    for (const club of PL_CLUBS) {
      const clubLeagues = fanLeagues.filter((l) => l.fan_club === club.name);
      const clubTeams   = (allTeams ?? []).filter((t) => clubLeagues.some((l) => l.id === t.league_id));

      // Find user's team in this club's leagues
      const myTeam = user ? clubTeams.find((t) => t.user_id === user.id) : null;
      let myPosition: number | null = null;

      if (myTeam) {
        const myLeagueTeams = clubTeams
          .filter((t) => t.league_id === myTeam.league_id)
          .sort((a, b) => b.total_points - a.total_points);
        myPosition = myLeagueTeams.findIndex((t) => t.id === myTeam.id) + 1;
      }

      stats[club.name] = {
        groupCount:  clubLeagues.length,
        memberCount: clubTeams.length,
        myLeagueId:  myTeam?.league_id ?? null,
        myTeamId:    myTeam?.id ?? null,
        myPosition:  myPosition,
        myPoints:    myTeam?.total_points ?? null,
      };
    }

    setClubStats(stats);
    setLoading(false);
  }

  function handleJoined(leagueId: string) {
    setJoiningClub(null);
    router.push(`/leagues/${leagueId}/table`);
  }

  const filtered = PL_CLUBS.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.abbr.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ minHeight: "100vh", background: "#FAF7F2", color: "#1C1410" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .nav-link { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.09em; text-transform: uppercase; color: #A89880; text-decoration: none; transition: color 0.15s; }
        .nav-link:hover, .nav-link.active { color: #FF5A1F; }
        .club-card {
          background: white;
          border: 1.5px solid #EDE5D8;
          border-radius: 16px;
          overflow: hidden;
          transition: all 0.18s;
          cursor: default;
        }
        .club-card:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,0.08); border-color: #D4C9BC; }
        .join-btn {
          width: 100%;
          padding: 11px;
          border-radius: 9px;
          border: none;
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.07em;
          cursor: pointer;
          transition: all 0.15s;
        }
        .search-input {
          padding: 11px 16px;
          border: 1.5px solid #EDE5D8;
          border-radius: 10px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          outline: none;
          background: white;
          color: #1C1410;
          width: 240px;
          transition: border-color 0.15s;
        }
        .search-input:focus { border-color: #FF5A1F; }
        .zone-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.06em;
          padding: 3px 8px;
          border-radius: 5px;
        }
      `}</style>

      {/* Nav */}
      <nav style={{ borderBottom: "1px solid #EDE5D8", padding: "0 24px", height: 56, display: "flex", alignItems: "center", gap: 28, background: "white" }}>
        <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#FF5A1F" }}>CURTIS</span>
        <Link href="/"            className="nav-link">Home</Link>
        <Link href="/pyramid"     className="nav-link">Pyramid</Link>
        <Link href="/fan-leagues" className="nav-link active">Fan Leagues</Link>
        <Link href="/draft/queue" className="nav-link">Public Drafts</Link>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 60px" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40, flexWrap: "wrap", gap: 20 }}>
          <div>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#A89880", marginBottom: 6 }}>
              2025–26 Season
            </p>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 38, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 10 }}>
              Fan Leagues
            </h1>
            <p style={{ color: "#6B5E52", fontSize: 14, maxWidth: 500, lineHeight: 1.6 }}>
              Join your club&apos;s global fan league. Compete against supporters worldwide in a
              promotion &amp; relegation pyramid. 8 managers per group. Top 2 go up.
            </p>
          </div>
          <input
            className="search-input"
            placeholder="Search clubs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Club grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 16 }}>
          {filtered.map((club) => {
            const stats    = clubStats[club.name];
            const isJoined = !!stats?.myLeagueId;
            const pos      = stats?.myPosition;
            const posColor = pos != null
              ? pos <= 2 ? "#22C55E"
              : pos <= 4 ? "#84CC16"
              : pos <= 6 ? "#F97316"
              : "#EF4444"
              : null;

            return (
              <div key={club.name} className="club-card">
                {/* Coloured header */}
                <div style={{
                  background: `linear-gradient(145deg, ${club.primary}, ${club.primary}CC)`,
                  padding: "20px 20px 16px",
                  position: "relative",
                  overflow: "hidden",
                }}>
                  {/* Subtle second colour accent */}
                  <div style={{
                    position: "absolute", top: -20, right: -20,
                    width: 90, height: 90, borderRadius: "50%",
                    background: club.secondary, opacity: 0.12,
                  }} />

                  <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
                    <ClubBadge club={club} size={52} />
                    <div>
                      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: `${club.text}99`, marginBottom: 2 }}>
                        Fan League
                      </p>
                      <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 800, color: club.text, lineHeight: 1.2 }}>
                        {club.name}
                      </p>
                    </div>
                  </div>

                  {/* Joined badge */}
                  {isJoined && (
                    <div style={{
                      marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6,
                      background: "rgba(255,255,255,0.18)", borderRadius: 7, padding: "4px 10px",
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E" }} />
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: club.text, letterSpacing: "0.05em" }}>
                        You&apos;re in this league
                      </span>
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div style={{ padding: "16px 18px" }}>
                  {/* Stats row */}
                  <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
                    <div>
                      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#A89880", letterSpacing: "0.06em", marginBottom: 2 }}>MEMBERS</p>
                      <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 800 }}>
                        {loading ? "—" : (stats?.memberCount ?? 0)}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#A89880", letterSpacing: "0.06em", marginBottom: 2 }}>GROUPS</p>
                      <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 800 }}>
                        {loading ? "—" : (stats?.groupCount ?? 0)}
                      </p>
                    </div>
                    {isJoined && pos != null && (
                      <div style={{ marginLeft: "auto" }}>
                        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#A89880", letterSpacing: "0.06em", marginBottom: 2 }}>POSITION</p>
                        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 800, color: posColor ?? undefined }}>
                          {pos}<span style={{ fontSize: 13, color: "#A89880" }}>/8</span>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Position zone pill */}
                  {isJoined && pos != null && posColor && (
                    <div style={{ marginBottom: 12 }}>
                      <span className="zone-pill" style={{ background: `${posColor}15`, color: posColor }}>
                        {pos <= 2 ? "⬆ Promotion zone" :
                         pos <= 4 ? "↕ Promotion playoff" :
                         pos <= 6 ? "↕ Relegation playoff" :
                                    "⬇ Relegation zone"}
                      </span>
                    </div>
                  )}

                  {/* Action button */}
                  {isJoined ? (
                    <Link
                      href={`/leagues/${stats!.myLeagueId}/table`}
                      style={{
                        display: "block", width: "100%", padding: "11px",
                        borderRadius: 9, textAlign: "center", textDecoration: "none",
                        background: `${club.primary}12`,
                        color: club.primary,
                        fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.07em",
                        border: `1.5px solid ${club.primary}30`,
                        transition: "all 0.15s",
                      }}
                    >
                      View My Standings →
                    </Link>
                  ) : (
                    <button
                      className="join-btn"
                      onClick={() => setJoiningClub(club)}
                      style={{
                        background: club.primary,
                        color: club.text,
                      }}
                    >
                      Join Fan League
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* How it works */}
        <div style={{ marginTop: 56, padding: "28px 32px", background: "white", borderRadius: 16, border: "1.5px solid #EDE5D8" }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 800, marginBottom: 16 }}>How Fan Leagues Work</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
            {[
              { icon: "⚽", title: "Join your club", body: "Pick any PL club and enter their global fan league. You're placed in a group of 8 managers." },
              { icon: "📈", title: "Earn points", body: "Fantasy points from your drafted squad count towards your fan league standing." },
              { icon: "🏆", title: "Promotion & relegation", body: "Top 2 go up automatically. 3rd/4th in promotion playoff. 7th/8th relegated." },
              { icon: "🌍", title: "6-tier pyramid", body: "Fight your way from Regional League to Curtis Elite against supporters worldwide." },
            ].map((item) => (
              <div key={item.title}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{item.icon}</div>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.07em", textTransform: "uppercase", color: "#1C1410", fontWeight: 600, marginBottom: 5 }}>{item.title}</p>
                <p style={{ fontSize: 13, color: "#6B5E52", lineHeight: 1.6 }}>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Join modal */}
      {joiningClub && (
        <JoinModal
          club={joiningClub}
          onClose={() => setJoiningClub(null)}
          onJoined={handleJoined}
        />
      )}
    </div>
  );
}
