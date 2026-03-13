"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NavBar } from "@/components/NavBar";
import { useIsMobile } from "@/lib/use-is-mobile";
import { useLeagueNavLinks } from "@/lib/use-league-nav-links";

// ─── Types ────────────────────────────────────────────────────────────────────

type AggStats = {
  goals: number;
  assists: number;
  cleanSheets: number;
  saves: number;
  tackles: number;
  interceptions: number;
  minutes: number;
};

const ZERO_STATS: AggStats = { goals: 0, assists: 0, cleanSheets: 0, saves: 0, tackles: 0, interceptions: 0, minutes: 0 };

type Player = {
  id: string;
  name: string;
  club: string;
  position: "GK" | "DEF" | "MID" | "FWD";
  season_points: number;
  gw_points: number;
  stats: AggStats;
};

type SquadPlayer = { id: string; player_id: string; player: Omit<Player, "stats"> };

type WaiverBid = {
  id: string;
  player_id: string;
  drop_player_id: string | null;
  bid_amount: number;
  status: "pending" | "won" | "lost" | "cancelled";
  created_at: string;
  player: { name: string; club: string; position: string };
  drop_player: { name: string } | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalisePos(raw: string): "GK" | "DEF" | "MID" | "FWD" {
  const p = (raw ?? "").toUpperCase();
  if (p === "GK" || p.startsWith("G")) return "GK";
  if (p === "DEF" || p.startsWith("D")) return "DEF";
  if (p === "MID" || p.startsWith("M")) return "MID";
  return "FWD";
}

const POS_COLOR: Record<string, string> = {
  GK: "#F59E0B", DEF: "#3B82F6", MID: "#10B981", FWD: "#EF4444",
};

const POS_BG: Record<string, string> = {
  GK: "rgba(245,158,11,0.12)", DEF: "rgba(59,130,246,0.12)",
  MID: "rgba(16,185,129,0.12)", FWD: "rgba(239,68,68,0.12)",
};

function topStats(p: Player): Array<{ label: string; value: number }> {
  const s = p.stats;
  switch (p.position) {
    case "GK":  return [{ label: "CS", value: s.cleanSheets }, { label: "Sv", value: s.saves }];
    case "DEF": return [{ label: "CS", value: s.cleanSheets }, { label: "Int", value: s.interceptions }];
    case "MID": return [{ label: "G",  value: s.goals },       { label: "A",  value: s.assists }];
    case "FWD": return [{ label: "G",  value: s.goals },       { label: "A",  value: s.assists }];
  }
}

type SortKey = "season_points" | "goals" | "assists" | "clean_sheets" | "interceptions" | "minutes";

const SORT_OPTIONS: { value: SortKey; label: string; short: string }[] = [
  { value: "season_points",  label: "Season Pts",    short: "Pts" },
  { value: "goals",          label: "Goals",         short: "Goals" },
  { value: "assists",        label: "Assists",       short: "Assists" },
  { value: "clean_sheets",   label: "Clean Sheets",  short: "CS" },
  { value: "interceptions",  label: "Interceptions", short: "Int" },
  { value: "minutes",        label: "Minutes",       short: "Mins" },
];

// ─── Feature 1: Form thresholds ───────────────────────────────────────────────

const FORM_THRESHOLD: Record<string, number> = { GK: 5, DEF: 4, MID: 5, FWD: 5 };

function formDotColor(pts: number | undefined, position: string): string {
  if (pts === undefined || pts === null) return "var(--c-border-strong)";
  if (pts > FORM_THRESHOLD[position]) return "#16A34A";
  return "#F59E0B";
}

// ─── Feature 2: Fixture difficulty tiers ─────────────────────────────────────

const HARD_CLUBS  = new Set(["MCI", "LIV", "ARS", "CHE", "AVL", "TOT"]);
const MEDIUM_CLUBS = new Set(["NEW", "MUN", "WHU", "BRI", "BHA", "FUL", "BOU", "NFO"]);

function fixtureDifficulty(opp: string): "hard" | "medium" | "easy" {
  if (HARD_CLUBS.has(opp))   return "hard";
  if (MEDIUM_CLUBS.has(opp)) return "medium";
  return "easy";
}

const DIFF_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  hard:   { bg: "rgba(239,68,68,0.15)",  color: "#EF4444", border: "1px solid rgba(239,68,68,0.3)" },
  medium: { bg: "rgba(245,158,11,0.15)", color: "#D97706", border: "1px solid rgba(245,158,11,0.3)" },
  easy:   { bg: "rgba(22,163,74,0.15)",  color: "#16A34A", border: "1px solid rgba(22,163,74,0.3)" },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WaiversPage() {
  const params = useParams();
  const leagueId = params.id as string;
  const isMobile = useIsMobile();

  const [tab, setTab] = useState<"available" | "mybids">("available");
  const [loading, setLoading] = useState(true);
  const [leagueName, setLeagueName] = useState("");
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [myCredits, setMyCredits] = useState(0);
  const [gameweekId, setGameweekId] = useState<string | null>(null);
  const [gameweekName, setGameweekName] = useState("");
  const [available, setAvailable] = useState<Player[]>([]);
  const [mySquad, setMySquad] = useState<SquadPlayer[]>([]);
  const [myBids, setMyBids] = useState<WaiverBid[]>([]);

  // Filter / sort / search
  const [posFilter, setPosFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<SortKey>("season_points");
  const [search, setSearch] = useState("");

  // Bid modal
  const [bidTarget, setBidTarget] = useState<Player | null>(null);
  const [bidAmount, setBidAmount] = useState(0);
  const [dropPlayerId, setDropPlayerId] = useState("");
  const [bidError, setBidError] = useState("");
  const [bidLoading, setBidLoading] = useState(false);

  // Feature 1: Form map (player_id → last 3 GW points, most recent first)
  const [formMap, setFormMap] = useState<Record<string, number[]>>({});

  // Feature 2: Fixture map (club abbreviation → next fixture)
  const [fixtureMap, setFixtureMap] = useState<Record<string, { opp: string; home: boolean }>>({});

  // Feature 3: Compare modal
  const [compareTarget, setCompareTarget] = useState<Player | null>(null);
  const [compareOpp, setCompareOpp] = useState<SquadPlayer | null>(null);
  const [squadStatMap, setSquadStatMap] = useState<Record<string, AggStats>>({});

  // Feature 4: Bid count map (player_id → pending bid count)
  const [bidCountMap, setBidCountMap] = useState<Record<string, number>>({});

  useEffect(() => { load(); }, [leagueId]);

  async function load() {
    setLoading(true);
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: league }, { data: gw }] = await Promise.all([
      supabase.from("leagues").select("name").eq("id", leagueId).single(),
      supabase.from("gameweeks").select("id, name").in("status", ["live", "upcoming"]).order("number", { ascending: false }).limit(1).maybeSingle(),
    ]);

    if (league) setLeagueName(league.name);
    if (gw) { setGameweekId(gw.id); setGameweekName(gw.name); }
    const gwId = gw?.id ?? null;

    const { data: myTeamRow, error: teamErr } = await supabase
      .from("teams").select("*").eq("league_id", leagueId).eq("user_id", user.id).maybeSingle();

    if (teamErr) console.error("team fetch error:", teamErr?.message);
    if (myTeamRow) { setMyTeamId(myTeamRow.id); setMyCredits(myTeamRow.credits ?? 0); }

    // Players already owned in this league
    const { data: leagueTeams } = await supabase.from("teams").select("id").eq("league_id", leagueId);
    const leagueTeamIds = (leagueTeams ?? []).map(t => t.id);
    const { data: owned } = leagueTeamIds.length
      ? await supabase.from("squad_players").select("player_id").in("team_id", leagueTeamIds)
      : { data: [] };
    const ownedIds = new Set((owned ?? []).map(r => r.player_id));

    // Available players
    const { data: players } = await supabase
      .from("players")
      .select("id, name, club, position, season_points, gw_points")
      .eq("is_available", true)
      .order("season_points", { ascending: false })
      .limit(1000);

    const availablePlayers = (players ?? []).filter(p => !ownedIds.has(p.id));

    // Season stats aggregated from player_stats
    let builtAvailable: Player[] = [];
    if (availablePlayers.length) {
      const playerIds = availablePlayers.map(p => p.id);
      const { data: statsRows } = await supabase
        .from("player_stats")
        .select("player_id, goals, assists, goals_conceded, saves, tackles_won, interceptions, minutes_played")
        .in("player_id", playerIds);

      const statMap: Record<string, AggStats> = {};
      for (const row of statsRows ?? []) {
        const s = statMap[row.player_id] ?? { ...ZERO_STATS };
        statMap[row.player_id] = {
          goals:         s.goals         + (row.goals ?? 0),
          assists:       s.assists       + (row.assists ?? 0),
          cleanSheets:   s.cleanSheets   + (row.goals_conceded === 0 ? 1 : 0),
          saves:         s.saves         + (row.saves ?? 0),
          tackles:       s.tackles       + (row.tackles_won ?? 0),
          interceptions: s.interceptions + (row.interceptions ?? 0),
          minutes:       s.minutes       + (row.minutes_played ?? 0),
        };
      }

      builtAvailable = availablePlayers.map(p => ({
        ...p,
        position: normalisePos(p.position),
        stats: statMap[p.id] ?? { ...ZERO_STATS },
      }));

      // ── Feature 1: Form map ────────────────────────────────────────────────
      const { data: formRows } = await supabase
        .from("player_stats")
        .select("player_id, gw_points, gameweek_id, gameweek:gameweeks(number)")
        .in("player_id", playerIds)
        .order("gameweek_id", { ascending: false });

      const newFormMap: Record<string, number[]> = {};
      for (const row of formRows ?? []) {
        const existing = newFormMap[row.player_id] ?? [];
        if (existing.length < 3) {
          newFormMap[row.player_id] = [...existing, row.gw_points ?? 0];
        }
      }
      setFormMap(newFormMap);

      // ── Feature 4: Bid count map ───────────────────────────────────────────
      if (gwId) {
        const { data: bidRows } = await supabase
          .from("waiver_bids")
          .select("player_id")
          .eq("status", "pending")
          .eq("gameweek_id", gwId);

        const newBidCountMap: Record<string, number> = {};
        for (const row of bidRows ?? []) {
          newBidCountMap[row.player_id] = (newBidCountMap[row.player_id] ?? 0) + 1;
        }
        setBidCountMap(newBidCountMap);
      }
    }

    setAvailable(builtAvailable);

    // ── Feature 2: Fixture map ─────────────────────────────────────────────
    const { data: fixtureRows } = await supabase
      .from("fixtures")
      .select("id, home_club, away_club, gameweek_id, gameweek:gameweeks(number, status)")
      .in("status", ["scheduled", "upcoming"])
      .order("gameweek_id", { ascending: true })
      .limit(200);

    const newFixtureMap: Record<string, { opp: string; home: boolean }> = {};
    for (const fx of fixtureRows ?? []) {
      if (!newFixtureMap[fx.home_club]) {
        newFixtureMap[fx.home_club] = { opp: fx.away_club, home: true };
      }
      if (!newFixtureMap[fx.away_club]) {
        newFixtureMap[fx.away_club] = { opp: fx.home_club, home: false };
      }
    }
    setFixtureMap(newFixtureMap);

    // My squad
    let squadRows: SquadPlayer[] = [];
    if (myTeamRow) {
      const { data: squad } = await supabase
        .from("squad_players")
        .select("id, player_id, player:players(id, name, club, position, season_points, gw_points)")
        .eq("team_id", myTeamRow.id);
      squadRows = (squad ?? []) as unknown as SquadPlayer[];
      setMySquad(squadRows);

      // ── Feature 3: Squad stat map ──────────────────────────────────────────
      const mySquadPlayerIds = squadRows.map(sp => sp.player_id);
      if (mySquadPlayerIds.length) {
        const { data: squadStatsRows } = await supabase
          .from("player_stats")
          .select("player_id, goals, assists, goals_conceded, minutes_played")
          .in("player_id", mySquadPlayerIds);

        const newSquadStatMap: Record<string, AggStats> = {};
        for (const row of squadStatsRows ?? []) {
          const s = newSquadStatMap[row.player_id] ?? { ...ZERO_STATS };
          newSquadStatMap[row.player_id] = {
            goals:         s.goals       + (row.goals ?? 0),
            assists:       s.assists     + (row.assists ?? 0),
            cleanSheets:   s.cleanSheets + (row.goals_conceded === 0 ? 1 : 0),
            saves:         s.saves,
            tackles:       s.tackles,
            interceptions: s.interceptions,
            minutes:       s.minutes     + (row.minutes_played ?? 0),
          };
        }
        setSquadStatMap(newSquadStatMap);
      }
    }

    // My bids
    if (myTeamRow && gw) {
      const { data: bids } = await supabase
        .from("waiver_bids")
        .select("id, player_id, drop_player_id, bid_amount, status, created_at, player:players!player_id(name, club, position), drop_player:players!drop_player_id(name)")
        .eq("team_id", myTeamRow.id)
        .eq("gameweek_id", gw.id)
        .order("created_at", { ascending: false });
      setMyBids((bids ?? []) as unknown as WaiverBid[]);
    }

    setLoading(false);
  }

  async function placeBid() {
    if (!bidTarget || !myTeamId || !gameweekId) return;
    setBidError(""); setBidLoading(true);
    const res = await fetch("/api/waivers/bid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leagueId, teamId: myTeamId, playerId: bidTarget.id, dropPlayerId: dropPlayerId || undefined, bidAmount, gameweekId }),
    });
    const data = await res.json();
    setBidLoading(false);
    if (!res.ok) { setBidError(data.error ?? "Failed to place bid"); return; }
    setBidTarget(null); setBidAmount(0); setDropPlayerId(""); load();
  }

  async function cancelBid(bidId: string) {
    if (!myTeamId) return;
    await fetch("/api/waivers/bid", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bidId, teamId: myTeamId }) });
    load();
  }

  // ── Feature 3: Open compare modal ─────────────────────────────────────────
  function openCompare(p: Player) {
    // Find weakest squad player at same position, else overall weakest
    const samePos = mySquad.filter(sp => normalisePos(sp.player?.position ?? "") === p.position);
    const pool = samePos.length ? samePos : mySquad;
    const weakest = pool.reduce<SquadPlayer | null>((min, sp) => {
      if (!min) return sp;
      return (sp.player?.season_points ?? 0) < (min.player?.season_points ?? 0) ? sp : min;
    }, null);
    setCompareTarget(p);
    setCompareOpp(weakest);
  }

  // ── Filtered + sorted list ─────────────────────────────────────────────────
  const filtered = available
    .filter(p => posFilter === "ALL" || p.position === posFilter)
    .filter(p => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => {
      switch (sortBy) {
        case "goals":          return b.stats.goals         - a.stats.goals;
        case "assists":        return b.stats.assists       - a.stats.assists;
        case "clean_sheets":   return b.stats.cleanSheets   - a.stats.cleanSheets;
        case "interceptions":  return b.stats.interceptions - a.stats.interceptions;
        case "minutes":        return b.stats.minutes       - a.stats.minutes;
        default:               return b.season_points       - a.season_points;
      }
    });

  const navLinks = useLeagueNavLinks(leagueId);

  const creditsDisplay = (
    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--c-text-muted)", whiteSpace: "nowrap" }}>
      <span style={{ color: "#FF5A1F", fontWeight: 700 }}>{myCredits}</span> credits
    </span>
  );

  // ── Compare modal squad stat helper ───────────────────────────────────────
  function squadPlayerStats(sp: SquadPlayer): AggStats {
    return squadStatMap[sp.player_id] ?? { ...ZERO_STATS };
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--c-bg)", color: "var(--c-text)", overflowX: "hidden" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .tab-btn { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.09em; text-transform: uppercase; padding: 8px 18px; border-radius: 8px; border: none; cursor: pointer; transition: all 0.15s; background: transparent; color: var(--c-text-muted); }
        .tab-btn.active { background: #FF5A1F; color: white; }
        .player-row { display: flex; align-items: center; gap: 12px; padding: 13px 16px; background: var(--c-bg-elevated); border-radius: 12px; border: 1.5px solid var(--c-border-strong); transition: border-color 0.15s, box-shadow 0.15s; }
        .player-row:hover { border-color: #FF5A1F; box-shadow: 0 2px 12px rgba(255,90,31,0.08); }
        .bid-btn { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.06em; padding: 6px 14px; border-radius: 7px; border: 1.5px solid #FF5A1F; background: var(--c-bg-elevated); color: #FF5A1F; cursor: pointer; white-space: nowrap; transition: all 0.15s; min-height: 44px; }
        .bid-btn:hover { background: #FF5A1F; color: white; }
        .compare-btn { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.06em; padding: 6px 10px; border-radius: 7px; border: 1.5px solid var(--c-border-strong); background: var(--c-bg-elevated); color: var(--c-text-muted); cursor: pointer; white-space: nowrap; transition: all 0.15s; min-height: 44px; }
        .compare-btn:hover { border-color: #FF5A1F; color: #FF5A1F; }
        .pos-badge { font-family: 'DM Mono', monospace; font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 4px; color: white; flex-shrink: 0; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: var(--c-bg-elevated); border-radius: 16px; padding: 28px; width: 100%; max-width: 440px; max-height: 90vh; overflow-y: auto; }
        .compare-modal { background: var(--c-bg-elevated); border-radius: 16px; padding: 28px; width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto; }
        .input { width: 100%; padding: 10px 14px; border: 1.5px solid var(--c-input-border); border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; transition: border-color 0.15s; background: var(--c-input); color: var(--c-text); }
        .input:focus { border-color: #FF5A1F; }
        .primary-btn { width: 100%; padding: 12px; border-radius: 10px; border: none; background: #FF5A1F; color: white; font-family: 'DM Mono', monospace; font-size: 12px; letter-spacing: 0.08em; cursor: pointer; transition: opacity 0.15s; min-height: 44px; }
        .primary-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .status-badge { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 5px; text-transform: uppercase; }
        .filter-btn { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.07em; padding: 5px 12px; border-radius: 6px; border: 1.5px solid var(--c-border-strong); background: var(--c-bg-elevated); cursor: pointer; transition: all 0.15s; color: var(--c-text-muted); min-height: 44px; }
        .filter-btn.active { border-color: #FF5A1F; color: #FF5A1F; background: var(--c-accent-dim); }
        .search-input { width: 100%; padding: 10px 14px 10px 36px; border: 1.5px solid rgba(168,152,128,0.4); border-radius: 9px; font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; transition: border-color 0.15s; background: var(--c-bg-elevated, #1a1714); color: var(--c-text, #f0ece6); }
        .search-input::placeholder { color: var(--c-text-muted, #8a7a6a); }
        .search-input:focus { border-color: #FF5A1F; }
        .sort-select { padding: 9px 12px; border: 1.5px solid rgba(168,152,128,0.4); border-radius: 8px; font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.05em; background: var(--c-bg-elevated, #1a1714); color: var(--c-text, #f0ece6); cursor: pointer; outline: none; min-height: 44px; }
        .sort-select:focus { border-color: #FF5A1F; }
        .stat-chip { display: inline-flex; align-items: center; gap: 3px; font-family: 'DM Mono', monospace; font-size: 10px; background: var(--c-bg); border: 1px solid var(--c-border-strong); border-radius: 5px; padding: 2px 7px; color: var(--c-text-muted); white-space: nowrap; }
        .stat-chip b { color: var(--c-text); font-weight: 700; }
      `}</style>

      <NavBar links={navLinks} activeLabel="Waivers" right={<>{creditsDisplay}<ThemeToggle size="sm" /></>} />

      <div style={{ maxWidth: 800, margin: "0 auto", padding: isMobile ? "20px 16px" : "32px 24px" }}>
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--c-text-muted)", marginBottom: 4 }}>{leagueName} · {gameweekName}</p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: isMobile ? 22 : 28, fontWeight: 900 }}>Waiver Wire</h1>
          <p style={{ color: "var(--c-text-muted)", fontSize: 13, marginTop: 4 }}>Bid credits to claim free agents. Highest bid wins — ties go to better waiver priority.</p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, background: "var(--c-row)", borderRadius: 10, padding: 4, marginBottom: 24, width: "fit-content" }}>
          {(["available", "mybids"] as const).map(t => (
            <button key={t} className={`tab-btn${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
              {t === "available" ? "Available Players" : `My Bids${myBids.filter(b => b.status === "pending").length ? ` (${myBids.filter(b => b.status === "pending").length})` : ""}`}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ color: "var(--c-text-muted)", fontFamily: "'DM Mono', monospace", fontSize: 13 }}>Loading…</div>
        ) : tab === "available" ? (
          <>
            {/* ── Search ── */}
            <div style={{ position: "relative", marginBottom: 12 }}>
              <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#FF5A1F", fontSize: 14, pointerEvents: "none", lineHeight: 1, fontWeight: 600 }}>
                ⌕
              </span>
              <input
                type="text"
                placeholder="Search players by name…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: "100%", padding: "11px 14px 11px 38px",
                  border: "2px solid #FF5A1F", borderRadius: 10,
                  fontFamily: "'DM Sans', sans-serif", fontSize: 14,
                  outline: "none", background: "var(--c-bg-elevated, #1a1714)",
                  color: "var(--c-text, #f0ece6)",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* ── Sort pills ── */}
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {SORT_OPTIONS.map(o => (
                <button
                  key={o.value}
                  onClick={() => setSortBy(o.value)}
                  style={{
                    fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.06em",
                    padding: "5px 12px", borderRadius: 7, cursor: "pointer",
                    border: sortBy === o.value ? "1.5px solid #FF5A1F" : "1.5px solid rgba(168,152,128,0.35)",
                    background: sortBy === o.value ? "#FF5A1F" : "var(--c-bg-elevated, #1a1714)",
                    color: sortBy === o.value ? "white" : "var(--c-text-muted, #8a7a6a)",
                    transition: "all 0.12s", minHeight: 32,
                  }}
                >
                  {o.short}
                </button>
              ))}
            </div>

            {/* ── Position filters ── */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {["ALL", "GK", "DEF", "MID", "FWD"].map(pos => {
                const count = pos === "ALL"
                  ? available.filter(p => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase())).length
                  : available.filter(p => p.position === pos && (!search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()))).length;
                return (
                  <button key={pos} className={`filter-btn${posFilter === pos ? " active" : ""}`} onClick={() => setPosFilter(pos)}>
                    {pos} <span style={{ opacity: 0.7, fontSize: 9 }}>{count}</span>
                  </button>
                );
              })}
            </div>

            {/* ── Player list ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.length === 0 && (
                <p style={{ color: "var(--c-text-muted)", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>
                  {search ? `No players matching "${search}"` : "No available players."}
                </p>
              )}
              {filtered.map(p => {
                const stats = topStats(p);
                const formPts = formMap[p.id] ?? [];
                const fixture = fixtureMap[p.club];
                const bidCount = bidCountMap[p.id] ?? 0;

                return (
                  <div key={p.id} className="player-row">
                    {/* Position badge */}
                    <div style={{
                      width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                      background: POS_BG[p.position],
                      display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center", gap: 1,
                    }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 700, color: POS_COLOR[p.position] }}>
                        {p.position}
                      </span>
                    </div>

                    {/* Name + club + stats */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Name row with form dots */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14, color: "var(--c-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.name}
                        </span>
                        {/* Feature 1: Last 3 GW form dots */}
                        <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                          {[0, 1, 2].map(i => (
                            <div
                              key={i}
                              title={formPts[i] !== undefined ? `GW-${i + 1}: ${formPts[i]} pts` : "No data"}
                              style={{
                                width: 8, height: 8, borderRadius: 2,
                                background: formDotColor(formPts[i], p.position),
                                flexShrink: 0,
                              }}
                            />
                          ))}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--c-text-dim)", letterSpacing: "0.04em" }}>
                          {p.club}
                        </span>
                        {/* Feature 2: Fixture difficulty pill */}
                        {fixture && (() => {
                          const diff = fixtureDifficulty(fixture.opp);
                          const ds = DIFF_STYLE[diff];
                          return (
                            <span style={{
                              fontSize: 9, padding: "2px 6px", borderRadius: 4,
                              fontFamily: "'DM Mono', monospace",
                              background: ds.bg, color: ds.color, border: ds.border,
                              whiteSpace: "nowrap",
                            }}>
                              {fixture.home ? "h" : "a"} {fixture.opp}
                            </span>
                          );
                        })()}
                        {stats.map(s => (
                          <span key={s.label} className="stat-chip">
                            <b>{s.value}</b> {s.label}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Season points */}
                    <div style={{ textAlign: "right", marginRight: 10, flexShrink: 0 }}>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "var(--c-text)", lineHeight: 1 }}>
                        {p.season_points}
                      </div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-dim)", letterSpacing: "0.06em", marginTop: 2 }}>
                        pts
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", flexShrink: 0 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {/* Feature 3: Compare button */}
                        <button className="compare-btn" onClick={() => openCompare(p)}>
                          Compare
                        </button>
                        <button className="bid-btn" onClick={() => { setBidTarget(p); setBidAmount(0); setDropPlayerId(""); setBidError(""); }}>
                          Bid
                        </button>
                      </div>
                      {/* Feature 4: Bid count badge */}
                      {bidCount > 0 && (
                        <span style={{
                          fontFamily: "'DM Mono', monospace", fontSize: 9,
                          color: "#D97706", letterSpacing: "0.04em",
                        }}>
                          {bidCount} bid{bidCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          /* My Bids tab — unchanged */
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {myBids.length === 0 && (
              <p style={{ color: "var(--c-text-muted)", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>No bids placed this gameweek.</p>
            )}
            {myBids.map(bid => {
              const statusColors: Record<string, string> = { pending: "#F59E0B", won: "#10B981", lost: "#EF4444", cancelled: "#A89880" };
              return (
                <div key={bid.id} className="player-row" style={{ justifyContent: "space-between" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{bid.player?.name ?? bid.player_id}</div>
                    <div style={{ fontSize: 12, color: "var(--c-text-muted)", fontFamily: "'DM Mono', monospace" }}>
                      {bid.player?.club} · {bid.player?.position}
                      {bid.drop_player && <> · Drop: {bid.drop_player.name}</>}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700 }}>{bid.bid_amount} cr</span>
                    <span className="status-badge" style={{ background: `${statusColors[bid.status]}20`, color: statusColors[bid.status] }}>{bid.status}</span>
                    {bid.status === "pending" && (
                      <button onClick={() => cancelBid(bid.id)} style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#EF4444", background: "none", border: "none", cursor: "pointer" }}>
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bid Modal — unchanged */}
      {bidTarget && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setBidTarget(null); }}>
          <div className="modal">
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Place Bid</h2>
            <p style={{ color: "var(--c-text-muted)", fontSize: 13, marginBottom: 20 }}>
              <strong>{bidTarget.name}</strong> · {bidTarget.club} · {bidTarget.position}
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-text-muted)", display: "block", marginBottom: 6 }}>
                Bid Amount <span style={{ color: "#FF5A1F" }}>({myCredits} available)</span>
              </label>
              <input type="number" min={0} max={myCredits} value={bidAmount} onChange={e => setBidAmount(Number(e.target.value))} className="input" placeholder="0" />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-text-muted)", display: "block", marginBottom: 6 }}>
                Drop Player (optional)
              </label>
              <select value={dropPlayerId} onChange={e => setDropPlayerId(e.target.value)} className="input">
                <option value="">— Keep squad as-is —</option>
                {mySquad.map(sp => (
                  <option key={sp.player_id} value={sp.player_id}>
                    {sp.player?.name} ({sp.player?.position} · {sp.player?.club})
                  </option>
                ))}
              </select>
            </div>
            {bidError && <p style={{ color: "#EF4444", fontSize: 13, marginBottom: 12, fontFamily: "'DM Mono', monospace" }}>{bidError}</p>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setBidTarget(null)} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1.5px solid var(--c-border-strong)", background: "var(--c-bg-elevated)", cursor: "pointer", fontFamily: "'DM Mono', monospace", fontSize: 12, letterSpacing: "0.08em" }}>
                Cancel
              </button>
              <button onClick={placeBid} disabled={bidLoading || bidAmount > myCredits} className="primary-btn" style={{ flex: 2 }}>
                {bidLoading ? "Placing…" : `Bid ${bidAmount} Credit${bidAmount !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature 3: Compare Modal */}
      {compareTarget && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setCompareTarget(null); setCompareOpp(null); } }}>
          <div className="compare-modal">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 800 }}>Compare</h2>
              <button
                onClick={() => { setCompareTarget(null); setCompareOpp(null); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-muted)", fontSize: 20, lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              {/* Left: Waiver player */}
              {(() => {
                const formPts = formMap[compareTarget.id] ?? [];
                return (
                  <div style={{ background: "var(--c-bg)", borderRadius: 12, padding: 16, border: "1.5px solid #FF5A1F" }}>
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "#FF5A1F" }}>Waiver</span>
                    </div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15, color: "var(--c-text)", marginBottom: 4 }}>
                      {compareTarget.name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--c-text-muted)" }}>{compareTarget.club}</span>
                      <span style={{
                        fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 700,
                        padding: "2px 6px", borderRadius: 4,
                        background: POS_BG[compareTarget.position], color: POS_COLOR[compareTarget.position],
                      }}>
                        {compareTarget.position}
                      </span>
                    </div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 900, color: "var(--c-text)", lineHeight: 1, marginBottom: 2 }}>
                      {compareTarget.season_points}
                    </div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-muted)", letterSpacing: "0.06em", marginBottom: 14 }}>
                      SEASON PTS
                    </div>
                    {/* Last 3 GW */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-muted)", letterSpacing: "0.06em", marginBottom: 6 }}>LAST 3 GW</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {[0, 1, 2].map(i => (
                          <div key={i} style={{ textAlign: "center" }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: 6,
                              background: formDotColor(formPts[i], compareTarget.position) + "22",
                              border: `1.5px solid ${formDotColor(formPts[i], compareTarget.position)}`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 700,
                              color: formDotColor(formPts[i], compareTarget.position),
                            }}>
                              {formPts[i] !== undefined ? formPts[i] : "–"}
                            </div>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "var(--c-text-muted)", marginTop: 2 }}>
                              GW-{i + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Stats */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
                        <span style={{ color: "var(--c-text-muted)" }}>Goals</span>
                        <span style={{ fontWeight: 700, color: "var(--c-text)" }}>{compareTarget.stats.goals}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
                        <span style={{ color: "var(--c-text-muted)" }}>Assists</span>
                        <span style={{ fontWeight: 700, color: "var(--c-text)" }}>{compareTarget.stats.assists}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
                        <span style={{ color: "var(--c-text-muted)" }}>Clean Sheets</span>
                        <span style={{ fontWeight: 700, color: "var(--c-text)" }}>{compareTarget.stats.cleanSheets}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Right: Squad player */}
              {compareOpp ? (() => {
                const pos = normalisePos(compareOpp.player?.position ?? "");
                const spStats = squadPlayerStats(compareOpp);
                const spFormPts = formMap[compareOpp.player_id] ?? [];
                return (
                  <div style={{ background: "var(--c-bg)", borderRadius: 12, padding: 16, border: "1.5px solid var(--c-border-strong)" }}>
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-text-muted)" }}>Your Squad</span>
                    </div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15, color: "var(--c-text)", marginBottom: 4 }}>
                      {compareOpp.player?.name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--c-text-muted)" }}>{compareOpp.player?.club}</span>
                      <span style={{
                        fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 700,
                        padding: "2px 6px", borderRadius: 4,
                        background: POS_BG[pos], color: POS_COLOR[pos],
                      }}>
                        {pos}
                      </span>
                    </div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 900, color: "var(--c-text)", lineHeight: 1, marginBottom: 2 }}>
                      {compareOpp.player?.season_points ?? 0}
                    </div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-muted)", letterSpacing: "0.06em", marginBottom: 14 }}>
                      SEASON PTS
                    </div>
                    {/* Last 3 GW */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-muted)", letterSpacing: "0.06em", marginBottom: 6 }}>LAST 3 GW</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {[0, 1, 2].map(i => (
                          <div key={i} style={{ textAlign: "center" }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: 6,
                              background: formDotColor(spFormPts[i], pos) + "22",
                              border: `1.5px solid ${formDotColor(spFormPts[i], pos)}`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 700,
                              color: formDotColor(spFormPts[i], pos),
                            }}>
                              {spFormPts[i] !== undefined ? spFormPts[i] : "–"}
                            </div>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "var(--c-text-muted)", marginTop: 2 }}>
                              GW-{i + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Stats */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
                        <span style={{ color: "var(--c-text-muted)" }}>Goals</span>
                        <span style={{ fontWeight: 700, color: "var(--c-text)" }}>{spStats.goals}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
                        <span style={{ color: "var(--c-text-muted)" }}>Assists</span>
                        <span style={{ fontWeight: 700, color: "var(--c-text)" }}>{spStats.assists}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
                        <span style={{ color: "var(--c-text-muted)" }}>Clean Sheets</span>
                        <span style={{ fontWeight: 700, color: "var(--c-text)" }}>{spStats.cleanSheets}</span>
                      </div>
                    </div>
                  </div>
                );
              })() : (
                <div style={{ background: "var(--c-bg)", borderRadius: 12, padding: 16, border: "1.5px solid var(--c-border-strong)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: "var(--c-text-muted)", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>No squad player to compare</span>
                </div>
              )}
            </div>

            <div style={{ marginTop: 20 }}>
              <button
                onClick={() => { setCompareTarget(null); setCompareOpp(null); setBidTarget(compareTarget); setBidAmount(0); setDropPlayerId(""); setBidError(""); }}
                className="primary-btn"
              >
                Bid on {compareTarget.name}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
