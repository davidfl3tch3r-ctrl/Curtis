import { NextResponse } from "next/server";
import { createClient as createBrowserClient } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/waivers/bid
// Place or update a waiver bid. One pending bid per team per player.
// Body: { leagueId, teamId, playerId, dropPlayerId?, bidAmount, gameweekId }
//
// DELETE /api/waivers/bid
// Cancel a pending bid.
// Body: { bidId, teamId }

export async function POST(request: Request) {
  const { leagueId, teamId, playerId, dropPlayerId, bidAmount, gameweekId } =
    await request.json();

  if (!leagueId || !teamId || !playerId || bidAmount == null || !gameweekId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (bidAmount < 0) {
    return NextResponse.json({ error: "Bid amount cannot be negative" }, { status: 400 });
  }

  const supabase = adminClient();

  // Verify team has enough credits
  const { data: team } = await supabase
    .from("teams")
    .select("id, credits, league_id")
    .eq("id", teamId)
    .eq("league_id", leagueId)
    .single();

  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
  if ((team.credits ?? 0) < bidAmount) {
    return NextResponse.json(
      { error: `Not enough credits. You have ${team.credits ?? 0}, bid requires ${bidAmount}.` },
      { status: 400 }
    );
  }

  // Verify player is not already in a squad in this league
  const { data: alreadyOwned } = await supabase
    .from("squad_players")
    .select("id")
    .eq("player_id", playerId)
    .in("team_id", (
      await supabase.from("teams").select("id").eq("league_id", leagueId)
    ).data?.map((t) => t.id) ?? [])
    .maybeSingle();

  if (alreadyOwned) {
    return NextResponse.json({ error: "Player is already owned in this league" }, { status: 400 });
  }

  // Upsert bid (one pending bid per team per player per gameweek)
  const { data: existing } = await supabase
    .from("waiver_bids")
    .select("id")
    .eq("team_id", teamId)
    .eq("player_id", playerId)
    .eq("gameweek_id", gameweekId)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    await supabase
      .from("waiver_bids")
      .update({ bid_amount: bidAmount, drop_player_id: dropPlayerId ?? null })
      .eq("id", existing.id);
    return NextResponse.json({ ok: true, updated: true });
  }

  const { error: insertErr } = await supabase.from("waiver_bids").insert({
    league_id:      leagueId,
    team_id:        teamId,
    player_id:      playerId,
    drop_player_id: dropPlayerId ?? null,
    bid_amount:     bidAmount,
    gameweek_id:    gameweekId,
    status:         "pending",
  });

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, updated: false });
}

export async function DELETE(request: Request) {
  const { bidId, teamId } = await request.json();
  if (!bidId || !teamId) {
    return NextResponse.json({ error: "Missing bidId or teamId" }, { status: 400 });
  }

  const supabase = adminClient();

  // Verify ownership before cancelling
  const { data: bid } = await supabase
    .from("waiver_bids")
    .select("id, team_id, status")
    .eq("id", bidId)
    .single();

  if (!bid) return NextResponse.json({ error: "Bid not found" }, { status: 404 });
  if (bid.team_id !== teamId) return NextResponse.json({ error: "Not your bid" }, { status: 403 });
  if (bid.status !== "pending") {
    return NextResponse.json({ error: "Cannot cancel a processed bid" }, { status: 400 });
  }

  await supabase.from("waiver_bids").update({ status: "cancelled" }).eq("id", bidId);
  return NextResponse.json({ ok: true });
}
