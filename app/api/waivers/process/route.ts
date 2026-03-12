import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/waivers/process
// Process all pending waiver bids for a league + gameweek.
// For each contested player: highest bid wins (ties go to lower draft_position = higher waiver priority).
// Winners: credits deducted, player added to squad, drop_player removed if specified.
// Losers: bid marked as lost, credits returned (bids are only "reserved" not spent until processed).
export async function POST(request: Request) {
  const { leagueId, gameweekId } = await request.json();
  if (!leagueId || !gameweekId) {
    return NextResponse.json({ error: "Missing leagueId or gameweekId" }, { status: 400 });
  }

  const supabase = adminClient();

  // Load all pending bids for this league + gameweek
  const { data: bids, error } = await supabase
    .from("waiver_bids")
    .select("id, team_id, player_id, drop_player_id, bid_amount")
    .eq("league_id", leagueId)
    .eq("gameweek_id", gameweekId)
    .eq("status", "pending")
    .order("bid_amount", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!bids?.length) return NextResponse.json({ ok: true, processed: 0 });

  // Load teams for waiver priority (draft_position as tiebreaker — lower = higher priority)
  const { data: teams } = await supabase
    .from("teams")
    .select("id, draft_position, credits")
    .eq("league_id", leagueId);

  const teamMap = new Map((teams ?? []).map((t) => [t.id, t]));

  // Group bids by player, pick winner per player
  const byPlayer = new Map<string, typeof bids>();
  for (const bid of bids) {
    if (!byPlayer.has(bid.player_id)) byPlayer.set(bid.player_id, []);
    byPlayer.get(bid.player_id)!.push(bid);
  }

  let processed = 0;

  for (const [playerId, playerBids] of byPlayer.entries()) {
    // Sort: highest bid first, then lowest draft_position (better waiver priority) as tiebreaker
    playerBids.sort((a, b) => {
      if (b.bid_amount !== a.bid_amount) return b.bid_amount - a.bid_amount;
      const aPriority = teamMap.get(a.team_id)?.draft_position ?? 999;
      const bPriority = teamMap.get(b.team_id)?.draft_position ?? 999;
      return aPriority - bPriority;
    });

    const winner = playerBids[0];
    const losers = playerBids.slice(1);

    // Check winner still has the credits (may have won another bid already this run)
    const winnerTeam = teamMap.get(winner.team_id);
    if (!winnerTeam || (winnerTeam.credits ?? 0) < winner.bid_amount) {
      // Mark all as lost if winner can't pay
      await supabase
        .from("waiver_bids")
        .update({ status: "lost", processed_at: new Date().toISOString() })
        .in("id", playerBids.map((b) => b.id));
      continue;
    }

    // Verify player still available (not already won in a prior iteration)
    const { data: alreadyOwned } = await supabase
      .from("squad_players")
      .select("id")
      .eq("player_id", playerId)
      .in("team_id", [...teamMap.keys()])
      .maybeSingle();

    if (alreadyOwned) {
      await supabase
        .from("waiver_bids")
        .update({ status: "lost", processed_at: new Date().toISOString() })
        .in("id", playerBids.map((b) => b.id));
      continue;
    }

    // Add player to winner's squad
    await supabase.from("squad_players").insert({
      team_id:      winner.team_id,
      player_id:    playerId,
      is_starting:  true,
      acquired_via: "waiver",
    });

    // Remove drop player if specified
    if (winner.drop_player_id) {
      await supabase
        .from("squad_players")
        .delete()
        .eq("team_id", winner.team_id)
        .eq("player_id", winner.drop_player_id);
    }

    // Deduct credits from winner
    const newCredits = (winnerTeam.credits ?? 0) - winner.bid_amount;
    await supabase.from("teams").update({ credits: newCredits }).eq("id", winner.team_id);
    teamMap.set(winner.team_id, { ...winnerTeam, credits: newCredits });

    // Mark winner bid as won, losers as lost
    await supabase
      .from("waiver_bids")
      .update({ status: "won", processed_at: new Date().toISOString() })
      .eq("id", winner.id);

    if (losers.length) {
      await supabase
        .from("waiver_bids")
        .update({ status: "lost", processed_at: new Date().toISOString() })
        .in("id", losers.map((b) => b.id));
    }

    processed++;
  }

  return NextResponse.json({ ok: true, processed });
}
