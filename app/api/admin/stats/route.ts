import { NextResponse } from "next/server";
import { requireAdmin, serviceClient, forbidden } from "@/lib/admin-auth";

async function countTable(sc: ReturnType<typeof serviceClient>, table: string): Promise<number> {
  try {
    const { count, error } = await sc
      .from(table)
      .select("*", { count: "exact", head: true });
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth) return forbidden();

  const sc = serviceClient();

  const [leagues, teams, players, draft_picks, messages, waiver_bids, trades] =
    await Promise.all([
      countTable(sc, "leagues"),
      countTable(sc, "teams"),
      countTable(sc, "players"),
      countTable(sc, "draft_picks"),
      countTable(sc, "messages"),
      countTable(sc, "waiver_bids"),
      countTable(sc, "trades"),
    ]);

  // Last sync: max updated_at from players
  let lastSync: string | null = null;
  try {
    const { data } = await sc
      .from("players")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();
    lastSync = data?.updated_at ?? null;
  } catch {
    lastSync = null;
  }

  return NextResponse.json({
    stats: { leagues, teams, players, draft_picks, messages, waiver_bids, trades },
    lastSync,
  });
}
