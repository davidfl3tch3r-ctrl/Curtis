import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { serviceClient } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  const { listingId, teamId } = await req.json();
  if (!listingId || !teamId) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: team } = await supabase.from("teams").select("id, user_id, credits").eq("id", teamId).single();
  if (!team || team.user_id !== user.id) return NextResponse.json({ error: "Not your team" }, { status: 403 });

  const { data: listing } = await supabase
    .from("transfer_listings")
    .select("id, status, buy_it_now_price, seller_team_id, leading_team_id, current_bid, player_id")
    .eq("id", listingId).single();

  if (!listing || listing.status !== "active") return NextResponse.json({ error: "Listing not available" }, { status: 404 });
  if (!listing.buy_it_now_price) return NextResponse.json({ error: "No buy-it-now price set" }, { status: 400 });
  if (team.credits < listing.buy_it_now_price) return NextResponse.json({ error: "Not enough credits" }, { status: 400 });

  const sc = serviceClient();

  // Refund any leading bidder
  if (listing.leading_team_id && listing.leading_team_id !== teamId) {
    const { data: prevLeader } = await sc.from("teams").select("credits").eq("id", listing.leading_team_id).single();
    if (prevLeader) await sc.from("teams").update({ credits: prevLeader.credits + listing.current_bid }).eq("id", listing.leading_team_id);
    await sc.from("transfer_bids").update({ status: "refunded" }).eq("listing_id", listingId).eq("status", "leading");
  }

  // Deduct from buyer
  await sc.from("teams").update({ credits: team.credits - listing.buy_it_now_price }).eq("id", teamId);

  // Credit seller
  const { data: seller } = await sc.from("teams").select("credits").eq("id", listing.seller_team_id).single();
  if (seller) await sc.from("teams").update({ credits: seller.credits + listing.buy_it_now_price }).eq("id", listing.seller_team_id);

  // Transfer player: remove from seller's squad, add to buyer's squad
  await sc.from("squad_players").delete().eq("team_id", listing.seller_team_id).eq("player_id", listing.player_id);
  await sc.from("squad_players").insert({ team_id: teamId, player_id: listing.player_id, is_starting: false, bench_order: 99, acquired_via: "transfer" });

  // Mark listing sold
  await sc.from("transfer_listings").update({ status: "sold", sold_at: new Date().toISOString(), leading_team_id: teamId, current_bid: listing.buy_it_now_price }).eq("id", listingId);

  return NextResponse.json({ success: true });
}
