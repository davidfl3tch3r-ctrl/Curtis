import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  const { leagueId, teamId, playerId, pickNumber, round } = await request.json();

  if (!leagueId || !teamId || !playerId || !pickNumber) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = adminClient();

  // Idempotency: if this pick_number is already taken, return success silently
  const { data: existing } = await supabase
    .from("draft_picks")
    .select("id")
    .eq("league_id", leagueId)
    .eq("pick_number", pickNumber)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Verify this team is actually a bot in this league
  const { data: team } = await supabase
    .from("teams")
    .select("id, is_bot")
    .eq("id", teamId)
    .eq("league_id", leagueId)
    .single();

  if (!team?.is_bot) {
    return NextResponse.json({ error: "Team is not a bot" }, { status: 403 });
  }

  // Insert pick
  const { error: pickErr } = await supabase.from("draft_picks").insert({
    league_id:   leagueId,
    team_id:     teamId,
    player_id:   playerId,
    round:       round ?? Math.ceil(pickNumber / 1),
    pick_number: pickNumber,
    is_autopick: true,
  });

  if (pickErr) {
    // Unique constraint violation = someone else already picked — that's fine
    if (pickErr.code === "23505") return NextResponse.json({ ok: true, skipped: true });
    return NextResponse.json({ error: pickErr.message }, { status: 500 });
  }

  // Add to squad_players
  await supabase.from("squad_players").insert({
    team_id:      teamId,
    player_id:    playerId,
    is_starting:  true,
    acquired_via: "draft",
  });

  return NextResponse.json({ ok: true });
}
