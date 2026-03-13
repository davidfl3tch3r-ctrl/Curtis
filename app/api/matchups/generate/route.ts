import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, serviceClient, forbidden } from "@/lib/admin-auth";

// ─── Round-robin schedule generator ──────────────────────────────────────────
// Standard circle/polygon method: fix teams[0], rotate the rest clockwise.
// Returns (numTeams - 1) rounds, each with (numTeams / 2) home/away pairs.
// For odd N, a "__BYE__" placeholder is added so every real team plays each round.

export function roundRobinSchedule(teamIds: string[]): Array<Array<[string, string]>> {
  if (teamIds.length < 2) return [];

  const teams = teamIds.length % 2 === 1 ? [...teamIds, "__BYE__"] : [...teamIds];
  const m = teams.length; // always even
  const rotate = teams.slice(1);
  const rounds: Array<Array<[string, string]>> = [];

  for (let r = 0; r < m - 1; r++) {
    const current = [teams[0], ...rotate];
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < m / 2; i++) {
      const home = current[i];
      const away = current[m - 1 - i];
      if (home !== "__BYE__" && away !== "__BYE__") {
        pairs.push([home, away]);
      }
    }
    rounds.push(pairs);
    // Rotate: pop last element of `rotate` to the front
    rotate.unshift(rotate.pop()!);
  }

  return rounds;
}

// ─── POST /api/matchups/generate ─────────────────────────────────────────────
// Body (all optional):
//   leagueId:       string   — if omitted, generates for ALL leagues
//   gameweekNumber: number   — if omitted, uses the next upcoming/live GW
//   gameweekNumbers: number[] — generate for multiple specific GWs at once

export async function POST(req: NextRequest) {
  const auth = await requireAdmin({ adminOnly: true });
  if (!auth) return forbidden();

  const sc = serviceClient();
  const body = await req.json().catch(() => ({})) as {
    leagueId?: string;
    gameweekNumber?: number;
    gameweekNumbers?: number[];
  };

  // ── 1. Resolve target leagues ─────────────────────────────────────────────
  let leaguesQuery = sc.from("leagues").select("id, name");
  if (body.leagueId) {
    leaguesQuery = leaguesQuery.eq("id", body.leagueId);
  }
  const { data: leagues, error: leagueErr } = await leaguesQuery;
  if (leagueErr || !leagues?.length) {
    return NextResponse.json({ error: leagueErr?.message ?? "No leagues found" }, { status: 404 });
  }

  // ── 2. Resolve target gameweeks ───────────────────────────────────────────
  type GW = { id: string; number: number; name: string; status: string };
  let gws: GW[] = [];

  if (body.gameweekNumbers?.length) {
    // Explicit list of GW numbers
    const { data, error } = await sc
      .from("gameweeks")
      .select("id, number, name, status")
      .in("number", body.gameweekNumbers)
      .order("number", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    gws = (data ?? []) as GW[];
  } else if (body.gameweekNumber != null) {
    const { data, error } = await sc
      .from("gameweeks")
      .select("id, number, name, status")
      .eq("number", body.gameweekNumber);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    gws = (data ?? []) as GW[];
  } else {
    // Default: next upcoming or current live GW
    const { data, error } = await sc
      .from("gameweeks")
      .select("id, number, name, status")
      .in("status", ["upcoming", "live"])
      .order("number", { ascending: true })
      .limit(1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    gws = (data ?? []) as GW[];
  }

  if (!gws.length) {
    return NextResponse.json({ error: "No matching gameweeks found" }, { status: 404 });
  }

  // ── 3. Generate matchups for each league × gameweek ───────────────────────
  const results: { league: string; gameweek: string; created: number; note: string }[] = [];
  let totalCreated = 0;

  for (const league of leagues) {
    // Fetch teams ordered by draft_position for consistent scheduling
    const { data: teamsData } = await sc
      .from("teams")
      .select("id")
      .eq("league_id", league.id)
      .order("draft_position", { ascending: true });

    const teamIds = (teamsData ?? []).map(t => t.id);
    if (teamIds.length < 2) {
      for (const gw of gws) {
        results.push({ league: league.name, gameweek: gw.name, created: 0, note: "less than 2 teams" });
      }
      continue;
    }

    const schedule = roundRobinSchedule(teamIds);
    const numRounds = schedule.length; // = numTeams - 1 (or numTeams if odd)

    for (const gw of gws) {
      // Skip if matchups already exist for this league + GW
      const { count } = await sc
        .from("matchups")
        .select("id", { count: "exact", head: true })
        .eq("league_id", league.id)
        .eq("gameweek_id", gw.id);

      if ((count ?? 0) > 0) {
        results.push({ league: league.name, gameweek: gw.name, created: 0, note: "already exists" });
        continue;
      }

      // Which round of the cycle does this GW correspond to?
      const roundIndex = (gw.number - 1) % numRounds;
      const pairs = schedule[roundIndex];

      const matchupStatus =
        gw.status === "complete" ? "complete" :
        gw.status === "live"     ? "live"     : "upcoming";

      const rows = pairs.map(([home, away]) => ({
        league_id:    league.id,
        gameweek_id:  gw.id,
        home_team_id: home,
        away_team_id: away,
        home_points:  0,
        away_points:  0,
        status:       matchupStatus,
      }));

      const { error: insertErr } = await sc.from("matchups").insert(rows);
      if (insertErr) {
        results.push({ league: league.name, gameweek: gw.name, created: 0, note: `insert error: ${insertErr.message}` });
        continue;
      }

      results.push({ league: league.name, gameweek: gw.name, created: rows.length, note: "" });
      totalCreated += rows.length;
    }
  }

  return NextResponse.json({ success: true, totalCreated, results });
}
