import { NextResponse } from "next/server";
import { requireAdmin, serviceClient, forbidden } from "@/lib/admin-auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth) return forbidden();

  const { id } = await params;
  const body = await req.json();
  const delta: number = body.delta;

  if (delta !== 1 && delta !== -1) {
    return NextResponse.json({ error: "delta must be 1 or -1" }, { status: 400 });
  }

  const sc = serviceClient();

  const { data: league, error: fetchError } = await sc
    .from("leagues")
    .select("tier")
    .eq("id", id)
    .single();

  if (fetchError || !league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const currentTier = league.tier ?? 1;
  const newTier = Math.min(6, Math.max(1, currentTier + delta));

  const { error: updateError } = await sc
    .from("leagues")
    .update({ tier: newTier })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ tier: newTier });
}
