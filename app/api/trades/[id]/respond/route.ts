import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/trades/[id]/respond
// Accept, reject, or counter a trade.
// Body: { action: "accept" | "reject" | "counter", receivingTeamId, counterGiving?, counterReceiving?, message? }
// "counterGiving" = what the counter-proposer (original receiver) now offers
// "counterReceiving" = what the counter-proposer now wants back
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tradeId } = await params;
  const { action, receivingTeamId, counterGiving, counterReceiving, message } =
    await request.json();

  if (!action || !receivingTeamId) {
    return NextResponse.json({ error: "Missing action or receivingTeamId" }, { status: 400 });
  }
  if (!["accept", "reject", "counter"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const supabase = adminClient();

  // Load trade
  const { data: trade } = await supabase
    .from("trades")
    .select("id, league_id, proposing_team_id, receiving_team_id, status")
    .eq("id", tradeId)
    .single();

  if (!trade) return NextResponse.json({ error: "Trade not found" }, { status: 404 });
  if (trade.status !== "pending") {
    return NextResponse.json({ error: "Trade is no longer pending" }, { status: 400 });
  }
  if (trade.receiving_team_id !== receivingTeamId) {
    return NextResponse.json({ error: "You are not the receiving team" }, { status: 403 });
  }

  const now = new Date().toISOString();

  if (action === "reject") {
    await supabase
      .from("trades")
      .update({ status: "rejected", responded_at: now })
      .eq("id", tradeId);
    return NextResponse.json({ ok: true });
  }

  if (action === "accept") {
    // Load trade items
    const { data: items } = await supabase
      .from("trade_items")
      .select("player_id, from_team_id, to_team_id")
      .eq("trade_id", tradeId);

    if (!items?.length) {
      return NextResponse.json({ error: "No trade items found" }, { status: 400 });
    }

    // Execute each item: delete from from_team, insert into to_team
    for (const item of items) {
      // Remove from current owner
      await supabase
        .from("squad_players")
        .delete()
        .eq("team_id", item.from_team_id)
        .eq("player_id", item.player_id);

      // Add to new owner
      await supabase.from("squad_players").insert({
        team_id:      item.to_team_id,
        player_id:    item.player_id,
        is_starting:  true,
        acquired_via: "trade",
      });
    }

    await supabase
      .from("trades")
      .update({ status: "accepted", responded_at: now })
      .eq("id", tradeId);

    return NextResponse.json({ ok: true });
  }

  // action === "counter"
  if (!counterGiving?.length && !counterReceiving?.length) {
    return NextResponse.json(
      { error: "Counter-offer must include at least one player" },
      { status: 400 }
    );
  }

  // Mark original trade as countered
  await supabase
    .from("trades")
    .update({ status: "countered", responded_at: now })
    .eq("id", tradeId);

  // Create counter-trade (roles reversed: original receiver is now proposer)
  const { data: counterTrade, error: counterErr } = await supabase
    .from("trades")
    .insert({
      league_id:         trade.league_id,
      proposing_team_id: trade.receiving_team_id,
      receiving_team_id: trade.proposing_team_id,
      message:           message ?? null,
      parent_trade_id:   tradeId,
      status:            "pending",
    })
    .select("id")
    .single();

  if (counterErr || !counterTrade) {
    return NextResponse.json({ error: counterErr?.message ?? "Failed to create counter" }, { status: 500 });
  }

  const counterItems = [
    ...(counterGiving ?? []).map((pid: string) => ({
      trade_id:     counterTrade.id,
      player_id:    pid,
      from_team_id: trade.receiving_team_id,
      to_team_id:   trade.proposing_team_id,
    })),
    ...(counterReceiving ?? []).map((pid: string) => ({
      trade_id:     counterTrade.id,
      player_id:    pid,
      from_team_id: trade.proposing_team_id,
      to_team_id:   trade.receiving_team_id,
    })),
  ];

  if (counterItems.length) {
    await supabase.from("trade_items").insert(counterItems);
  }

  return NextResponse.json({ ok: true, counterTradeId: counterTrade.id });
}
