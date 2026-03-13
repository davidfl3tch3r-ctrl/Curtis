import { NextResponse } from "next/server";
import { requireAdmin, serviceClient, forbidden } from "@/lib/admin-auth";

export async function POST() {
  const auth = await requireAdmin({ adminOnly: false });
  if (!auth) return forbidden();

  const sc = serviceClient();

  // Find all expired active listings
  const { data: expiredListings, error } = await sc
    .from("transfer_listings")
    .select("id, seller_team_id, leading_team_id, current_bid, min_bid, player_id, status")
    .eq("status", "active")
    .lt("closes_at", new Date().toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let settled = 0, sold = 0, unsold = 0;

  for (const listing of expiredListings ?? []) {
    if (listing.current_bid >= listing.min_bid && listing.leading_team_id) {
      // Sold — transfer player
      await sc.from("squad_players").delete().eq("team_id", listing.seller_team_id).eq("player_id", listing.player_id);
      await sc.from("squad_players").insert({ team_id: listing.leading_team_id, player_id: listing.player_id, is_starting: false, bench_order: 99, acquired_via: "transfer" });

      // Credit seller
      const { data: seller } = await sc.from("teams").select("credits").eq("id", listing.seller_team_id).single();
      if (seller) await sc.from("teams").update({ credits: seller.credits + listing.current_bid }).eq("id", listing.seller_team_id);

      // Mark winning bid
      await sc.from("transfer_bids").update({ status: "won" }).eq("listing_id", listing.id).eq("status", "leading");
      await sc.from("transfer_listings").update({ status: "sold", sold_at: new Date().toISOString() }).eq("id", listing.id);
      sold++;
    } else {
      // Unsold — refund any bids
      if (listing.leading_team_id && listing.current_bid > 0) {
        const { data: leader } = await sc.from("teams").select("credits").eq("id", listing.leading_team_id).single();
        if (leader) await sc.from("teams").update({ credits: leader.credits + listing.current_bid }).eq("id", listing.leading_team_id);
        await sc.from("transfer_bids").update({ status: "refunded" }).eq("listing_id", listing.id).eq("status", "leading");
      }
      await sc.from("transfer_listings").update({ status: "unsold" }).eq("id", listing.id);
      unsold++;
    }
    settled++;
  }

  return NextResponse.json({ success: true, settled, sold, unsold });
}
