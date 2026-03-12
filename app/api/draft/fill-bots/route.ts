import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const BOT_NAMES = [
  "Automaton Athletic", "Silicon United",    "Circuit City FC",
  "Binary Rovers",      "Neural Network XI", "Algorithm AFC",
  "Pixel Park Rangers", "Data United",       "Matrix FC",
  "Quantum Athletic",   "Tensor Town",       "Logic FC",
];

export async function POST(request: Request) {
  const { leagueId } = await request.json();
  if (!leagueId) return NextResponse.json({ error: "Missing leagueId" }, { status: 400 });

  const supabase = adminClient();

  // Get league config
  const { data: league } = await supabase
    .from("leagues")
    .select("id, draft_status, target_teams, max_teams, is_public")
    .eq("id", leagueId)
    .single();

  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });
  if (league.draft_status === "live") return NextResponse.json({ ok: true, alreadyLive: true });

  // Count existing teams
  const { data: teams } = await supabase
    .from("teams")
    .select("id, draft_position")
    .eq("league_id", leagueId)
    .order("draft_position");

  const currentCount = teams?.length ?? 0;
  const target = league.target_teams ?? league.max_teams ?? 8;
  const spotsNeeded = target - currentCount;

  // Fill with bots
  const existingBotNames = new Set((teams ?? []).map(t => t)); // just for position calc
  let nextPosition = currentCount + 1;

  for (let i = 0; i < spotsNeeded; i++) {
    const botName = BOT_NAMES[i % BOT_NAMES.length] + (i >= BOT_NAMES.length ? ` ${Math.floor(i / BOT_NAMES.length) + 1}` : "");
    await supabase.from("teams").insert({
      league_id:      leagueId,
      user_id:        "00000000-0000-0000-0000-000000000000", // sentinel bot user
      name:           botName,
      draft_position: nextPosition++,
      is_bot:         true,
    });
  }

  // Start the draft
  await supabase
    .from("leagues")
    .update({ draft_status: "live" })
    .eq("id", leagueId);

  return NextResponse.json({ ok: true, botsAdded: spotsNeeded });
}
