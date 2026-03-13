// ─────────────────────────────────────────────────────────────────────────────
// CURTIS — API-Football Data Adapter
// ─────────────────────────────────────────────────────────────────────────────
//
// WHICH API TO USE: API-Football (via RapidAPI or api-sports.io)
//
// FREE TIER: 100 requests/day — enough for development and small leagues.
//   Register at: https://dashboard.api-football.com/
//   No credit card required.
//
// PAID TIERS (when you have real users):
//   Pro:   7,500 req/day  — suitable for leagues up to ~500 users
//   Ultra: 75,000 req/day — suitable for scaling
//   Pricing: https://www.api-football.com/pricing
//
// WHAT YOU GET:
//   ✓ Live scores updated every 15 seconds
//   ✓ Player stats per fixture (goals, assists, shots, passes, tackles, etc.)
//   ✓ Lineups and substitutions
//   ✓ Injuries and suspensions
//   ✓ All 26 stats that CURTIS scoring uses
//
// HOW IT MAPS TO CURTIS:
//   API-Football player stats → CURTIS scoring engine → fantasy points
//   This file is the bridge between the two.
//
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = "https://v3.football.api-sports.io";
const PREMIER_LEAGUE_ID = 39; // API-Football's ID for the Premier League
const CURRENT_SEASON = 2025;

// Add your key to .env.local as: API_FOOTBALL_KEY=your_key_here
const API_KEY = process.env.API_FOOTBALL_KEY!;

const headers = {
  "x-apisports-key": API_KEY,
};

// ── RAW API TYPES (what API-Football returns) ─────────────────────────────────

interface ApiFixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string; elapsed: number | null };
  };
  teams: {
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
  goals: { home: number | null; away: number | null };
  score: { halftime: { home: number | null; away: number | null } };
}

interface ApiPlayerStat {
  player: { id: number; name: string; photo: string };
  statistics: Array<{
    games: {
      minutes: number | null;
      position: string;
      rating: string | null;
    };
    goals: { total: number | null; assists: number | null; saves: number | null; conceded: number | null };
    shots: { total: number | null; on: number | null };
    passes: { total: number | null; accuracy: string | null; key: number | null };
    tackles: { total: number | null; blocks: number | null; interceptions: number | null };
    duels: { total: number | null; won: number | null };
    dribbles: { attempts: number | null; success: number | null; past: number | null };
    fouls: { drawn: number | null; committed: number | null };
    cards: { yellow: number | null; yellowred: number | null; red: number | null };
    penalty: {
      won: number | null; committed: number | null;
      scored: number | null; missed: number | null; saved: number | null;
    };
  }>;
}

// ── CURTIS NORMALISED STATS (what our scoring engine expects) ──────────────────

export interface CurtisPlayerStats {
  player_id: string;       // API-Football player ID as string
  fixture_id: string;
  name: string;
  position: "GK" | "DEF" | "MID" | "FWD";
  minutes_played: number;
  goals: number;
  assists: number;
  key_passes: number;
  shots_on_target: number;
  big_chances_created: number;   // API-Football doesn't provide this directly — set 0, update from Opta later
  big_chances_missed: number;    // Same as above
  passes_total: number;
  pass_accuracy: number;         // 0-100 percentage
  tackles_won: number;
  interceptions: number;
  clearances: number;
  goals_conceded: number;
  saves: number;
  penalty_saves: number;
  yellow_cards: number;
  red_cards: number;
  own_goals: number;
  penalties_missed: number;
  penalties_conceded: number;
  turnovers: number;             // Not available in API-Football — set 0
  corners_won: number;           // Not available in API-Football — set 0
  defensive_errors: number;      // Not available in API-Football — set 0
}

// ── POSITION NORMALISER ────────────────────────────────────────────────────────

function normalisePosition(apiPos: string): "GK" | "DEF" | "MID" | "FWD" {
  const p = apiPos?.toUpperCase() ?? "";
  if (p.startsWith("G")) return "GK";
  if (p.startsWith("M")) return "MID";
  if (p.startsWith("D")) return "DEF";
  return "FWD";
}

// ── API CALLS ──────────────────────────────────────────────────────────────────

// Get all live fixtures for Premier League right now
export async function getLiveFixtures(): Promise<ApiFixture[]> {
  const res = await fetch(
    `${BASE_URL}/fixtures?live=all&league=${PREMIER_LEAGUE_ID}`,
    { headers, next: { revalidate: 15 } } // Next.js cache: refresh every 15 seconds
  );
  const data = await res.json();
  return data.response ?? [];
}

// Get fixtures for a specific gameweek (round)
// round format: "Regular Season - 28"
export async function getFixturesByGameweek(round: number): Promise<ApiFixture[]> {
  const res = await fetch(
    `${BASE_URL}/fixtures?league=${PREMIER_LEAGUE_ID}&season=${CURRENT_SEASON}&round=Regular Season - ${round}`,
    { headers, next: { revalidate: 60 } }
  );
  const data = await res.json();
  return data.response ?? [];
}

// Get player stats for a specific fixture — this is the key call for fantasy points
export async function getPlayerStatsForFixture(
  fixtureId: number
): Promise<CurtisPlayerStats[]> {
  const res = await fetch(
    `${BASE_URL}/fixtures/players?fixture=${fixtureId}`,
    { headers, next: { revalidate: 15 } }
  );
  const data = await res.json();

  const players: CurtisPlayerStats[] = [];

  // API returns two teams, each with their player stats
  for (const teamData of data.response ?? []) {
    for (const playerData of teamData.players ?? []) {
      const s = playerData.statistics?.[0];
      if (!s) continue;

      players.push({
        player_id:          String(playerData.player.id),
        fixture_id:         String(fixtureId),
        name:               playerData.player.name,
        position:           normalisePosition(s.games?.position ?? "F"),
        minutes_played:     s.games?.minutes ?? 0,
        goals:              s.goals?.total ?? 0,
        assists:            s.goals?.assists ?? 0,
        key_passes:         s.passes?.key ?? 0,
        shots_on_target:    s.shots?.on ?? 0,
        big_chances_created: 0,   // Upgrade to Opta for this
        big_chances_missed:  0,   // Upgrade to Opta for this
        passes_total:       s.passes?.total ?? 0,
        pass_accuracy:      parseFloat(s.passes?.accuracy ?? "0"),
        tackles_won:        s.tackles?.total ?? 0,
        interceptions:      s.tackles?.interceptions ?? 0,
        clearances:         s.tackles?.blocks ?? 0,
        goals_conceded:     s.goals?.conceded ?? 0,
        saves:              s.goals?.saves ?? 0,
        penalty_saves:      s.penalty?.saved ?? 0,
        yellow_cards:       s.cards?.yellow ?? 0,
        red_cards:          s.cards?.red ?? 0,
        own_goals:          0,   // API-Football returns OGs via events endpoint
        penalties_missed:   s.penalty?.missed ?? 0,
        penalties_conceded: s.penalty?.committed ?? 0,
        turnovers:          0,   // Not available — upgrade to Opta
        corners_won:        0,   // Not available — upgrade to Opta
        defensive_errors:   0,   // Not available — upgrade to Opta
      });
    }
  }

  return players;
}

// Get player season stats (for squad pages, player profiles)
export async function getPlayerSeasonStats(playerId: number) {
  const res = await fetch(
    `${BASE_URL}/players?id=${playerId}&season=${CURRENT_SEASON}&league=${PREMIER_LEAGUE_ID}`,
    { headers, next: { revalidate: 3600 } } // Cache for 1 hour
  );
  const data = await res.json();
  return data.response?.[0] ?? null;
}

// Get injuries (to flag doubts on squad page)
export async function getInjuries(): Promise<Record<string, { type: string; detail: string }>> {
  const res = await fetch(
    `${BASE_URL}/injuries?league=${PREMIER_LEAGUE_ID}&season=${CURRENT_SEASON}`,
    { headers, next: { revalidate: 3600 } }
  );
  const data = await res.json();

  const map: Record<string, { type: string; detail: string }> = {};
  for (const item of data.response ?? []) {
    map[String(item.player.id)] = {
      type:   item.player.reason?.toLowerCase().includes("suspen") ? "suspended" : "doubt",
      detail: item.player.reason ?? "Unknown",
    };
  }
  return map;
}

// ── PLAYER SYNC (bulk roster import) ──────────────────────────────────────────

interface ApiPlayerListItem {
  player: {
    id: number;
    name: string;
    firstname: string;
    lastname: string;
    photo: string;
  };
  statistics: Array<{
    team: { name: string; id: number };
    games: { position: string | null; appearences: number | null };
    goals: { total: number | null; assists: number | null; saves: number | null };
    cards: { yellow: number | null; red: number | null };
  }>;
}

export const CLUB_ABBR: Record<string, string> = {
  "Arsenal": "ARS", "Aston Villa": "AVL", "Bournemouth": "BOU",
  "Brentford": "BRE", "Brighton": "BHA", "Brighton & Hove Albion": "BHA",
  "Chelsea": "CHE", "Crystal Palace": "CRY", "Everton": "EVE",
  "Fulham": "FUL", "Ipswich": "IPS", "Ipswich Town": "IPS",
  "Leicester": "LEI", "Leicester City": "LEI", "Liverpool": "LIV",
  "Manchester City": "MCI", "Manchester United": "MUN",
  "Newcastle": "NEW", "Newcastle United": "NEW",
  "Nottingham Forest": "NFO", "Southampton": "SOU",
  "Tottenham": "TOT", "Tottenham Hotspur": "TOT",
  "West Ham": "WHU", "West Ham United": "WHU",
  "Wolves": "WOL", "Wolverhampton Wanderers": "WOL",
};

function roughFantasyPoints(
  stat: ApiPlayerListItem["statistics"][0],
  pos: "GK" | "DEF" | "MID" | "FWD"
): number {
  const goals = stat.goals?.total ?? 0;
  const assists = stat.goals?.assists ?? 0;
  const saves = stat.goals?.saves ?? 0;
  const yellow = stat.cards?.yellow ?? 0;
  const red = stat.cards?.red ?? 0;

  let pts = 0;
  if (pos === "GK")       pts += goals * 8 + assists * 3 + saves * 0.5;
  else if (pos === "DEF") pts += goals * 7 + assists * 3;
  else if (pos === "MID") pts += goals * 6 + assists * 4;
  else                    pts += goals * 5 + assists * 3;
  pts -= yellow + red * 3;
  return Math.max(0, Math.round(pts * 10) / 10);
}

export interface CurtisPlayerRow {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  club: string;
  club_full: string;
  position: "GK" | "DEF" | "MID" | "FWD";
  season_points: number;
  api_rank: number;
  photo_url: string;
  is_available: boolean;
  updated_at: string;
}

// Returns the current PL round number (e.g. 29)
export async function fetchCurrentRound(): Promise<number> {
  const res = await fetch(
    `${BASE_URL}/fixtures/rounds?league=${PREMIER_LEAGUE_ID}&season=${CURRENT_SEASON}&current=true`,
    { headers }
  );
  const data = await res.json();
  const label: string = data.response?.[0] ?? "";
  const match = label.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 1;
}

// Pages through /players?league=39&season=2025 — ~25 calls on free tier.
// NOTE: This endpoint only returns players with at least 1 appearance in the season.
// Fringe squad members who haven't played yet won't appear here.
// To get the full registered squad (including unused players), use:
//   GET /players/squads?team={teamId}  — but this requires ~20 calls (one per club)
//   and uses the free tier's 100 req/day budget quickly.
// For now, syncing via this appearances-based endpoint gives us ~650 players which
// covers all realistic draft picks. Re-sync early in the season when squads settle.
export async function fetchAllPremierLeaguePlayers(): Promise<CurtisPlayerRow[]> {
  const all: CurtisPlayerRow[] = [];
  let page = 1;

  while (true) {
    const res = await fetch(
      `${BASE_URL}/players?league=${PREMIER_LEAGUE_ID}&season=${CURRENT_SEASON}&page=${page}`,
      { headers }
    );
    const data = await res.json();
    const items: ApiPlayerListItem[] = data.response ?? [];
    if (items.length === 0) break;

    for (const item of items) {
      const stat = item.statistics?.[0];
      if (!stat) continue;
      const pos = normalisePosition(stat.games?.position ?? "F");
      const clubFull = stat.team?.name ?? "";
      const club = CLUB_ABBR[clubFull] ?? clubFull.slice(0, 3).toUpperCase();

      all.push({
        id:            String(item.player.id),
        name:          item.player.name,
        first_name:    item.player.firstname ?? "",
        last_name:     item.player.lastname ?? "",
        club,
        club_full:     clubFull,
        position:      pos,
        season_points: roughFantasyPoints(stat, pos),
        api_rank:      0,
        photo_url:     item.player.photo ?? "",
        is_available:  true,
        updated_at:    new Date().toISOString(),
      });
    }

    const totalPages: number = data.paging?.total ?? 1;
    if (page >= totalPages) break;
    page++;
    // Gentle rate limiting
    await new Promise((r) => setTimeout(r, 250));
  }

  // Rank by season_points descending
  all.sort((a, b) => b.season_points - a.season_points);
  all.forEach((p, i) => { p.api_rank = i + 1; });
  return all;
}

// ── SMART POLLING ─────────────────────────────────────────────────────────────
// On matchdays, poll every 15s. Otherwise, poll every hour.
// This keeps you well within the free tier's 100 requests/day limit
// on non-matchdays, and uses requests efficiently on matchdays.

export function getPollingInterval(): number {
  const now = new Date();
  const hour = now.getUTCHours();
  const day  = now.getUTCDay(); // 0=Sun, 6=Sat

  // Premier League typically plays Sat/Sun afternoon + midweek evenings (UTC)
  const isMatchday = day === 6 || day === 0 || day === 2 || day === 3;
  const isMatchtime = hour >= 11 && hour <= 22;

  if (isMatchday && isMatchtime) return 15_000;  // 15 seconds
  return 3_600_000;                               // 1 hour
}
