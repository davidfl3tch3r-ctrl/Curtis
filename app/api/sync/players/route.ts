import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchAllPremierLeaguePlayers } from "@/lib/api-football";

// Service role client — bypasses RLS, server-side only
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not set in .env.local" },
      { status: 500 }
    );
  }

  try {
    const players = await fetchAllPremierLeaguePlayers();
    const supabase = adminClient();

    const { error } = await supabase
      .from("players")
      .upsert(players, { onConflict: "id" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ synced: players.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
