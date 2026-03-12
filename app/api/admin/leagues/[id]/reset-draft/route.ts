import { NextResponse } from "next/server";
import { requireAdmin, serviceClient, forbidden } from "@/lib/admin-auth";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth) return forbidden();

  const { id } = await params;
  const sc = serviceClient();

  // Reset draft_status on league
  const { error: leagueError } = await sc
    .from("leagues")
    .update({ draft_status: "pending" })
    .eq("id", id);

  if (leagueError) {
    return NextResponse.json({ error: leagueError.message }, { status: 500 });
  }

  // Delete all draft_picks for this league
  const { error: picksError } = await sc
    .from("draft_picks")
    .delete()
    .eq("league_id", id);

  if (picksError) {
    return NextResponse.json({ error: picksError.message }, { status: 500 });
  }

  // Get team ids for this league
  const { data: teams } = await sc
    .from("teams")
    .select("id")
    .eq("league_id", id);

  if (teams && teams.length > 0) {
    const teamIds = teams.map((t) => t.id);

    // Delete all squad_players for these teams
    const { error: squadError } = await sc
      .from("squad_players")
      .delete()
      .in("team_id", teamIds);

    if (squadError) {
      return NextResponse.json({ error: squadError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ message: "Draft reset to pending" });
}
