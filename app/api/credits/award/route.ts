import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/credits/award
// Awards credits to teams based on completed matchup results for a gameweek.
// Win = 3 credits, Draw = 1 credit, Loss = 0.
// Call this after a gameweek's matchups are all marked complete.
export async function POST(request: Request) {
  const { leagueId, gameweekId } = await request.json();
  if (!leagueId || !gameweekId) {
    return NextResponse.json({ error: "Missing leagueId or gameweekId" }, { status: 400 });
  }

  const supabase = adminClient();

  const { data: matchups, error } = await supabase
    .from("matchups")
    .select("home_team_id, away_team_id, home_points, away_points, winner_team_id, status")
    .eq("league_id", leagueId)
    .eq("gameweek_id", gameweekId)
    .eq("status", "complete");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!matchups?.length) return NextResponse.json({ ok: true, awarded: 0 });

  // Tally credits per team
  const credits: Record<string, number> = {};
  for (const m of matchups) {
    const isDraw = m.home_points === m.away_points;
    if (isDraw) {
      credits[m.home_team_id] = (credits[m.home_team_id] ?? 0) + 1;
      credits[m.away_team_id] = (credits[m.away_team_id] ?? 0) + 1;
    } else {
      credits[m.winner_team_id] = (credits[m.winner_team_id] ?? 0) + 3;
    }
  }

  // Fetch current balances, increment, update
  const teamIds = Object.keys(credits);
  const { data: teams } = await supabase
    .from("teams")
    .select("id, credits")
    .in("id", teamIds);

  let awarded = 0;
  for (const team of teams ?? []) {
    const gain = credits[team.id] ?? 0;
    if (gain === 0) continue;
    await supabase
      .from("teams")
      .update({ credits: (team.credits ?? 0) + gain })
      .eq("id", team.id);
    awarded++;
  }

  return NextResponse.json({ ok: true, awarded, breakdown: credits });
}
