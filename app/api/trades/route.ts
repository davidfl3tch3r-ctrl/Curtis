import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/trades
// Propose a trade between two teams.
// Body: { leagueId, proposingTeamId, receivingTeamId, giving: string[], receiving: string[], message? }
// "giving" = player IDs the proposing team is offering
// "receiving" = player IDs the proposing team wants in return
export async function POST(request: Request) {
  const { leagueId, proposingTeamId, receivingTeamId, giving, receiving, message } =
    await request.json();

  if (!leagueId || !proposingTeamId || !receivingTeamId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!giving?.length && !receiving?.length) {
    return NextResponse.json({ error: "Trade must include at least one player" }, { status: 400 });
  }
  if (proposingTeamId === receivingTeamId) {
    return NextResponse.json({ error: "Cannot trade with yourself" }, { status: 400 });
  }

  const supabase = adminClient();

  // Verify teams are in the same league
  const { data: teams } = await supabase
    .from("teams")
    .select("id, league_id")
    .in("id", [proposingTeamId, receivingTeamId])
    .eq("league_id", leagueId);

  if (teams?.length !== 2) {
    return NextResponse.json({ error: "Teams not found in this league" }, { status: 404 });
  }

  // Verify "giving" players are owned by proposing team
  if (giving?.length) {
    const { data: owned } = await supabase
      .from("squad_players")
      .select("player_id")
      .eq("team_id", proposingTeamId)
      .in("player_id", giving);

    if ((owned?.length ?? 0) !== giving.length) {
      return NextResponse.json(
        { error: "You don't own all the players you're offering" },
        { status: 400 }
      );
    }
  }

  // Verify "receiving" players are owned by receiving team
  if (receiving?.length) {
    const { data: owned } = await supabase
      .from("squad_players")
      .select("player_id")
      .eq("team_id", receivingTeamId)
      .in("player_id", receiving);

    if ((owned?.length ?? 0) !== receiving.length) {
      return NextResponse.json(
        { error: "Receiving team doesn't own all the requested players" },
        { status: 400 }
      );
    }
  }

  // Create the trade
  const { data: trade, error: tradeErr } = await supabase
    .from("trades")
    .insert({
      league_id:         leagueId,
      proposing_team_id: proposingTeamId,
      receiving_team_id: receivingTeamId,
      message:           message ?? null,
      status:            "pending",
    })
    .select("id")
    .single();

  if (tradeErr || !trade) {
    return NextResponse.json({ error: tradeErr?.message ?? "Failed to create trade" }, { status: 500 });
  }

  // Insert trade items
  const items = [
    ...(giving ?? []).map((pid: string) => ({
      trade_id:     trade.id,
      player_id:    pid,
      from_team_id: proposingTeamId,
      to_team_id:   receivingTeamId,
    })),
    ...(receiving ?? []).map((pid: string) => ({
      trade_id:     trade.id,
      player_id:    pid,
      from_team_id: receivingTeamId,
      to_team_id:   proposingTeamId,
    })),
  ];

  if (items.length) {
    const { error: itemsErr } = await supabase.from("trade_items").insert(items);
    if (itemsErr) {
      // Roll back the trade
      await supabase.from("trades").delete().eq("id", trade.id);
      return NextResponse.json({ error: itemsErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, tradeId: trade.id });
}
