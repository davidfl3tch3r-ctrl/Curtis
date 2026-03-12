import { NextResponse } from "next/server";
import { requireAdmin, serviceClient, forbidden } from "@/lib/admin-auth";

const TEST_TEAM_NAMES = [
  "Fergie's Hairdryers",
  "Klopp's Gegenpressers",
  "Pep's Philosophers",
  "Mourinho's Parking Lot",
  "Wenger's Invincibles",
  "Ranieri's Foxes",
  "Allardyce's Hoofballers",
];

export async function POST() {
  const auth = await requireAdmin({ adminOnly: true });
  if (!auth) return forbidden();

  const sc = serviceClient();

  // Create the league
  const { data: league, error: leagueErr } = await sc
    .from("leagues")
    .insert({
      name: "The Gaffer's League",
      commissioner_id: auth.userId,
      season: "2025-26",
      max_teams: 8,
      privacy: "private",
      draft_status: "pending",
    })
    .select("id")
    .single();

  if (leagueErr || !league) {
    return NextResponse.json({ error: leagueErr?.message ?? "Failed to create league" }, { status: 500 });
  }

  // Create the commissioner's team (Dave's Destroyers)
  const { error: myTeamErr } = await sc.from("teams").insert({
    league_id: league.id,
    user_id: auth.userId,
    name: "Dave's Destroyers",
    draft_position: 1,
  });

  if (myTeamErr) {
    return NextResponse.json({ error: myTeamErr.message }, { status: 500 });
  }

  // Create the 7 bot teams (no user_id — ghost teams for testing)
  const botTeams = TEST_TEAM_NAMES.map((name, i) => ({
    league_id: league.id,
    user_id: null as string | null,
    name,
    draft_position: i + 2,
  }));

  const { error: botErr } = await sc.from("teams").insert(botTeams);

  if (botErr) {
    return NextResponse.json({
      warning: `League and your team created, but bot teams failed: ${botErr.message}`,
      leagueId: league.id,
    });
  }

  return NextResponse.json({
    success: true,
    message: "Test league created with 8 teams",
    leagueName: "The Gaffer's League",
    leagueId: league.id,
    teamCount: 8,
  });
}
