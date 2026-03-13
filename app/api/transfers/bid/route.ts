import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { serviceClient } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  const { listingId, teamId, bidAmount } = await req.json();
  if (!listingId || !teamId || !bidAmount) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  // Verify team belongs to user
  const { data: team } = await supabase.from("teams").select("id, user_id, credits").eq("id", teamId).single();
  if (!team || team.user_id !== user.id) return NextResponse.json({ error: "Not your team" }, { status: 403 });

  // Get listing
  const { data: listing } = await supabase
    .from("transfer_listings")
    .select("id, status, current_bid, min_bid, seller_team_id, leading_team_id, closes_at")
    .eq("id", listingId).single();

  if (!listing || listing.status !== "active") return NextResponse.json({ error: "Listing not found or no longer active" }, { status: 404 });
  if (new Date(listing.closes_at) < new Date()) return NextResponse.json({ error: "Auction has ended" }, { status: 400 });
  if (listing.seller_team_id === teamId) return NextResponse.json({ error: "Cannot bid on your own listing" }, { status: 400 });
  const minRequired = Math.max(listing.min_bid, listing.current_bid + 1);
  if (bidAmount < minRequired) return NextResponse.json({ error: `Bid must be at least ${minRequired} credits` }, { status: 400 });
  if (bidAmount > team.credits) return NextResponse.json({ error: "Not enough credits" }, { status: 400 });

  const sc = serviceClient();

  // Refund previous leader if different team
  if (listing.leading_team_id && listing.leading_team_id !== teamId) {
    const { data: prevLeader } = await sc.from("teams").select("credits").eq("id", listing.leading_team_id).single();
    if (prevLeader) {
      await sc.from("teams").update({ credits: prevLeader.credits + listing.current_bid }).eq("id", listing.leading_team_id);
    }
    // Mark previous leading bid as outbid
    await sc.from("transfer_bids").update({ status: "outbid" }).eq("listing_id", listingId).eq("status", "leading");
  }

  // Deduct credits from bidder (unless they were already leading — replace their bid)
  const refundOwnPrev = listing.leading_team_id === teamId ? listing.current_bid : 0;
  await sc.from("teams").update({ credits: team.credits - bidAmount + refundOwnPrev }).eq("id", teamId);
  if (refundOwnPrev > 0) {
    await sc.from("transfer_bids").update({ status: "outbid" }).eq("listing_id", listingId).eq("bidder_team_id", teamId).eq("status", "leading");
  }

  // Insert new bid
  await sc.from("transfer_bids").insert({ listing_id: listingId, bidder_team_id: teamId, bid_amount: bidAmount, status: "leading" });

  // Update listing
  await sc.from("transfer_listings").update({ current_bid: bidAmount, leading_team_id: teamId }).eq("id", listingId);

  return NextResponse.json({ success: true });
}
