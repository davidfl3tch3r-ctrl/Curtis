import { NextResponse } from "next/server";
import { requireAdmin, serviceClient, forbidden } from "@/lib/admin-auth";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth) return forbidden();

  const sc = serviceClient();

  // Note: `tier` column is not yet applied to the DB — omit to avoid a PostgREST error
  const { data: leagues, error } = await sc
    .from("leagues")
    .select("id, name, privacy, draft_status, created_at, season")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get team counts per league
  const { data: teamCounts } = await sc
    .from("teams")
    .select("league_id");

  const countMap: Record<string, number> = {};
  for (const row of teamCounts ?? []) {
    countMap[row.league_id] = (countMap[row.league_id] ?? 0) + 1;
  }

  const result = (leagues ?? []).map((l) => ({
    ...l,
    tier: null,          // tier column not yet migrated to the DB
    team_count: countMap[l.id] ?? 0,
  }));

  return NextResponse.json({ leagues: result });
}
