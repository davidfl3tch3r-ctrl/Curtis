import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  fetchCurrentRound,
  getFixturesByGameweek,
  getPlayerStatsForFixture,
  CLUB_ABBR,
} from "@/lib/api-football";
import { calculatePoints, DEFAULT_SCORING_RULES } from "@/lib/scoring";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const COMPLETE_STATUSES = new Set(["FT", "AET", "PEN", "AWD", "WO"]);
const LIVE_STATUSES     = new Set(["1H", "2H", "ET", "BT", "HT", "LIVE", "P"]);

function mapFixtureStatus(short: string): "scheduled" | "live" | "complete" {
  if (COMPLETE_STATUSES.has(short)) return "complete";
  if (LIVE_STATUSES.has(short))     return "live";
  return "scheduled";
}

export async function POST(request: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not set" }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const supabase = adminClient();

  // Determine round
  const round: number = body.round ?? await fetchCurrentRound();

  // ── 1. Upsert gameweek ────────────────────────────────────────────────────
  const today = new Date().toISOString().split("T")[0];
  const { data: gw, error: gwErr } = await supabase
    .from("gameweeks")
    .upsert(
      {
        season: String(CURRENT_SEASON),
        number: round,
        name: `Gameweek ${round}`,
        deadline: new Date().toISOString(),
        start_date: today,
        end_date: today,
        status: "live",
      },
      { onConflict: "season,number" }
    )
    .select("id")
    .single();

  if (gwErr || !gw) {
    return NextResponse.json({ error: "Failed to upsert gameweek", detail: gwErr?.message }, { status: 500 });
  }

  // ── 2. Fetch + upsert fixtures ────────────────────────────────────────────
  const apiFixtures = await getFixturesByGameweek(round);

  for (const f of apiFixtures) {
    const homeAbbr = CLUB_ABBR[f.teams.home.name] ?? f.teams.home.name.slice(0, 3).toUpperCase();
    const awayAbbr = CLUB_ABBR[f.teams.away.name] ?? f.teams.away.name.slice(0, 3).toUpperCase();

    await supabase.from("fixtures").upsert(
      {
        api_id:      f.fixture.id,
        gameweek_id: gw.id,
        home_club:   homeAbbr,
        away_club:   awayAbbr,
        kickoff:     f.fixture.date,
        home_score:  f.goals.home,
        away_score:  f.goals.away,
        status:      mapFixtureStatus(f.fixture.status.short),
        minute:      f.fixture.status.elapsed,
      },
      { onConflict: "api_id" }
    );
  }

  // ── 3. Score live + complete fixtures ─────────────────────────────────────
  const scoreable = apiFixtures.filter(f =>
    COMPLETE_STATUSES.has(f.fixture.status.short) ||
    LIVE_STATUSES.has(f.fixture.status.short)
  );

  let statsProcessed = 0;

  for (const f of scoreable) {
    const { data: fixture } = await supabase
      .from("fixtures")
      .select("id")
      .eq("api_id", f.fixture.id)
      .single();

    if (!fixture) continue;

    const playerStats = await getPlayerStatsForFixture(f.fixture.id);

    for (const ps of playerStats) {
      const { total } = calculatePoints(ps, ps.position, DEFAULT_SCORING_RULES);

      await supabase.from("player_stats").upsert(
        {
          player_id:           ps.player_id,
          fixture_id:          fixture.id,
          gameweek_id:         gw.id,
          goals:               ps.goals,
          assists:             ps.assists,
          key_passes:          ps.key_passes,
          shots_on_target:     ps.shots_on_target,
          big_chances_created: ps.big_chances_created,
          big_chances_missed:  ps.big_chances_missed,
          passes_total:        ps.passes_total,
          pass_accuracy:       ps.pass_accuracy,
          minutes_played:      ps.minutes_played,
          tackles_won:         ps.tackles_won,
          interceptions:       ps.interceptions,
          clearances:          ps.clearances,
          goals_conceded:      ps.goals_conceded,
          saves:               ps.saves,
          penalty_saves:       ps.penalty_saves,
          yellow_cards:        ps.yellow_cards,
          red_cards:           ps.red_cards,
          own_goals:           ps.own_goals,
          penalties_missed:    ps.penalties_missed,
          penalties_conceded:  ps.penalties_conceded,
          turnovers:           ps.turnovers,
          corners_won:         ps.corners_won,
          defensive_errors:    ps.defensive_errors,
          fantasy_points:      total,
          updated_at:          new Date().toISOString(),
        },
        { onConflict: "player_id,fixture_id" }
      );
      statsProcessed++;
    }

    // Gentle rate limiting between fixture calls
    await new Promise(r => setTimeout(r, 250));
  }

  // ── 4. Aggregate gw_points per player for this gameweek ───────────────────
  const { data: gwStats } = await supabase
    .from("player_stats")
    .select("player_id, fantasy_points")
    .eq("gameweek_id", gw.id);

  const playerGWPts: Record<string, number> = {};
  for (const row of gwStats ?? []) {
    playerGWPts[row.player_id] = (playerGWPts[row.player_id] ?? 0) + (row.fantasy_points ?? 0);
  }

  // Batch-update players.gw_points
  for (const [playerId, pts] of Object.entries(playerGWPts)) {
    await supabase.from("players").update({ gw_points: pts }).eq("id", playerId);
  }

  // ── 5. Roll up to teams ───────────────────────────────────────────────────
  const { data: squads } = await supabase
    .from("squad_players")
    .select("team_id, player_id, is_starting");

  const teamGWPts: Record<string, number> = {};
  for (const sq of squads ?? []) {
    if (!sq.is_starting) continue;
    teamGWPts[sq.team_id] = (teamGWPts[sq.team_id] ?? 0) + (playerGWPts[sq.player_id] ?? 0);
  }

  for (const [teamId, pts] of Object.entries(teamGWPts)) {
    // Also increment total_points (add the delta, not replace — use rpc for safety)
    await supabase
      .from("teams")
      .update({ gw_points: pts })
      .eq("id", teamId);
  }

  return NextResponse.json({
    ok: true,
    round,
    fixtures: apiFixtures.length,
    scored: scoreable.length,
    statsProcessed,
    teamsUpdated: Object.keys(teamGWPts).length,
  });
}

// Need this for the route to access CURRENT_SEASON
const CURRENT_SEASON = 2025;
