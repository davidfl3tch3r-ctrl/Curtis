import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { isWindowOpen } from "@/lib/transfer-window";

export async function POST(req: NextRequest) {
  if (!isWindowOpen()) {
    return NextResponse.json({ error: "Transfer window is closed" }, { status: 403 });
  }

  const { leagueId, teamId, playerId } = await req.json();
  if (!leagueId || !teamId || !playerId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  // Verify team belongs to user
  const { data: team } = await supabase.from("teams").select("id, user_id").eq("id", teamId).single();
  if (!team || team.user_id !== user.id) {
    return NextResponse.json({ error: "Not your team" }, { status: 403 });
  }

  // Check player not already owned in this league
  const { data: leagueTeams } = await supabase.from("teams").select("id").eq("league_id", leagueId);
  const teamIds = (leagueTeams ?? []).map(t => t.id);
  const { data: existing } = await supabase.from("squad_players").select("id").in("team_id", teamIds).eq("player_id", playerId).maybeSingle();
  if (existing) return NextResponse.json({ error: "Player already owned in this league" }, { status: 409 });

  // Add to squad
  const { error } = await supabase.from("squad_players").insert({
    team_id: teamId,
    player_id: playerId,
    is_starting: false,
    bench_order: 99,
    acquired_via: "free_claim",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
