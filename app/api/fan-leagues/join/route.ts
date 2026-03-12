import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/fan-leagues/join
// Body: { clubName: string, teamName: string }
// Authorization: Bearer <user-jwt>
//
// Finds an open fan league group for the club (< 8 teams) and adds the user.
// Creates a new group if all existing ones are full.
export async function POST(request: Request) {
  const { clubName, teamName } = await request.json();

  if (!clubName || !teamName?.trim()) {
    return NextResponse.json({ error: "Missing clubName or teamName" }, { status: 400 });
  }

  // Verify caller is authenticated
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  const supabase = adminClient();
  const { data: { user } } = await supabase.auth.getUser(token ?? "");
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Ensure profile exists
  await supabase.from("profiles").upsert(
    { id: user.id, email: user.email!, username: user.email!.split("@")[0] },
    { onConflict: "id", ignoreDuplicates: true }
  );

  // Check: already in a fan league for this club?
  const { data: fanLeagueIds } = await supabase
    .from("leagues")
    .select("id")
    .eq("fan_club", clubName);

  if (fanLeagueIds?.length) {
    const ids = fanLeagueIds.map((l) => l.id);
    const { data: existingTeam } = await supabase
      .from("teams")
      .select("id, league_id")
      .eq("user_id", user.id)
      .in("league_id", ids)
      .maybeSingle();

    if (existingTeam) {
      return NextResponse.json({ ok: true, leagueId: existingTeam.league_id, teamId: existingTeam.id, alreadyJoined: true });
    }
  }

  // Find an open group (< 8 non-bot teams)
  let targetLeagueId: string | null = null;

  const { data: existingGroups } = await supabase
    .from("leagues")
    .select("id")
    .eq("fan_club", clubName)
    .eq("draft_status", "complete")
    .order("created_at", { ascending: true });

  for (const group of existingGroups ?? []) {
    const { count } = await supabase
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("league_id", group.id)
      .eq("is_bot", false);

    if ((count ?? 0) < 8) {
      targetLeagueId = group.id;
      break;
    }
  }

  // No open group — create a new one
  if (!targetLeagueId) {
    const groupLetter = String.fromCharCode(
      65 + (existingGroups?.length ?? 0) // A, B, C…
    );

    const { data: newLeague, error: leagueErr } = await supabase
      .from("leagues")
      .insert({
        name:             `${clubName} Fan League — Group ${groupLetter}`,
        commissioner_id:  user.id,
        format:           "h2h",
        privacy:          "public",
        is_public:        true,
        draft_status:     "complete",  // Fan leagues don't draft
        fan_club:         clubName,
        tier:             1,
        pyramid_group:    groupLetter,
        squad_size:       15,
        bench_size:       4,
        max_teams:        8,
        target_teams:     8,
        season:           "2025-26",
      })
      .select("id")
      .single();

    if (leagueErr || !newLeague) {
      return NextResponse.json({ error: leagueErr?.message ?? "Failed to create league" }, { status: 500 });
    }
    targetLeagueId = newLeague.id;
  }

  // Add team
  const { data: team, error: teamErr } = await supabase
    .from("teams")
    .insert({
      league_id:      targetLeagueId,
      user_id:        user.id,
      name:           teamName.trim(),
      draft_position: 1,
      is_bot:         false,
    })
    .select("id")
    .single();

  if (teamErr || !team) {
    return NextResponse.json({ error: teamErr?.message ?? "Failed to create team" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, leagueId: targetLeagueId, teamId: team.id });
}
