import { NextResponse } from "next/server";
import { requireAdmin, serviceClient, forbidden } from "@/lib/admin-auth";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth) return forbidden();

  const sc = serviceClient();

  const { data: profiles, error } = await sc
    .from("profiles")
    .select("id, email, username, role, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get team counts per user (distinct league_ids)
  const { data: teams } = await sc
    .from("teams")
    .select("user_id, league_id");

  // Count distinct leagues per user
  const leagueMap: Record<string, Set<string>> = {};
  for (const row of teams ?? []) {
    if (!leagueMap[row.user_id]) leagueMap[row.user_id] = new Set();
    leagueMap[row.user_id].add(row.league_id);
  }

  const users = (profiles ?? []).map((p) => ({
    id: p.id,
    email: p.email,
    username: p.username,
    role: p.role,
    league_count: leagueMap[p.id]?.size ?? 0,
    created_at: p.created_at,
  }));

  return NextResponse.json({ users });
}
