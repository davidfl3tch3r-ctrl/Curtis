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

// 15 players per team, 8 teams = 120 picks
// Positions needed per team: 2 GK, 5 DEF, 5 MID, 3 FWD
const SQUAD_SIZE = 15;
const TEAM_COUNT = 8;

export async function POST() {
  const auth = await requireAdmin({ adminOnly: true });
  if (!auth) return forbidden();

  const sc = serviceClient();

  // ── 1. Create the league ──────────────────────────────────────────────────
  const { data: league, error: leagueErr } = await sc
    .from("leagues")
    .insert({
      name: "The Gaffer's League",
      commissioner_id: auth.userId,
      created_by: auth.userId,
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

  // ── 2. Create all teams ───────────────────────────────────────────────────
  const { data: myTeam, error: myTeamErr } = await sc
    .from("teams")
    .insert({ league_id: league.id, user_id: auth.userId, name: "Dave's Destroyers", draft_position: 1 })
    .select("id")
    .single();

  if (myTeamErr || !myTeam) {
    return NextResponse.json({ error: myTeamErr?.message ?? "Failed to create your team" }, { status: 500 });
  }

  const botInserts = TEST_TEAM_NAMES.map((name, i) => ({
    league_id: league.id,
    user_id: null as string | null,
    name,
    draft_position: i + 2,
  }));

  const { data: botTeams, error: botErr } = await sc.from("teams").insert(botInserts).select("id");

  if (botErr || !botTeams) {
    return NextResponse.json({ error: botErr?.message ?? "Failed to create bot teams" }, { status: 500 });
  }

  // All teams in draft order
  const allTeams = [myTeam, ...botTeams];

  // ── 3. Fetch real players from the DB ─────────────────────────────────────
  // Pull enough players: 8 teams × 15 picks = 120. Grab a spread of positions.
  const fetchPos = async (pos: string, limit: number) => {
    const { data } = await sc
      .from("players")
      .select("id, position")
      .eq("position", pos)
      .eq("is_available", true)
      .limit(limit);
    return (data ?? []).map((p: { id: string; position: string }) => ({ id: p.id, position: p.position }));
  };

  const [gks, defs, mids, fwds] = await Promise.all([
    fetchPos("GK",  TEAM_COUNT * 2 + 4),   // 20 GKs
    fetchPos("DEF", TEAM_COUNT * 5 + 8),   // 48 DEFs
    fetchPos("MID", TEAM_COUNT * 5 + 8),   // 48 MIDs
    fetchPos("FWD", TEAM_COUNT * 3 + 6),   // 30 FWDs
  ]);

  const totalNeeded = TEAM_COUNT * SQUAD_SIZE;
  const playerPool = [...gks, ...defs, ...mids, ...fwds].slice(0, totalNeeded);

  if (playerPool.length < totalNeeded) {
    // Not enough real players — seed still creates league/teams but warns
    await sc.from("leagues").update({ draft_status: "complete" }).eq("id", league.id);
    return NextResponse.json({
      warning: `Only ${playerPool.length} players in DB (need ${totalNeeded}). Add real player data first. League created but squads are empty.`,
      leagueId: league.id,
    });
  }

  // ── 4. Snake draft assignment ─────────────────────────────────────────────
  // Round 1: teams 0→7, Round 2: teams 7→0, etc.
  const teamPlayers: Record<string, string[]> = {};
  for (const t of allTeams) teamPlayers[t.id] = [];

  for (let round = 0; round < SQUAD_SIZE; round++) {
    const order = round % 2 === 0
      ? allTeams
      : [...allTeams].reverse();

    for (const team of order) {
      const player = playerPool.shift();
      if (player) teamPlayers[team.id].push(player.id);
    }
  }

  // ── 5. Insert draft_picks ─────────────────────────────────────────────────
  const draftPickRows: {
    league_id: string; team_id: string; player_id: string;
    round: number; pick_number: number; is_autopick: boolean;
  }[] = [];

  let pickNumber = 1;
  for (let round = 0; round < SQUAD_SIZE; round++) {
    const order = round % 2 === 0 ? allTeams : [...allTeams].reverse();
    for (const team of order) {
      const playerId = teamPlayers[team.id][round];
      if (playerId) {
        draftPickRows.push({
          league_id: league.id,
          team_id: team.id,
          player_id: playerId,
          round: round + 1,
          pick_number: pickNumber++,
          is_autopick: true,
        });
      }
    }
  }

  const { error: pickErr } = await sc.from("draft_picks").insert(draftPickRows);
  if (pickErr) {
    return NextResponse.json({ error: `draft_picks insert failed: ${pickErr.message}` }, { status: 500 });
  }

  // ── 6. Insert squad_players ───────────────────────────────────────────────
  // First 11 = starters (is_starting: true), last 4 = bench
  const squadRows: {
    team_id: string; player_id: string; is_starting: boolean;
    bench_order: number | null; acquired_via: string;
  }[] = [];

  for (const team of allTeams) {
    const players = teamPlayers[team.id];
    players.forEach((playerId, i) => {
      const isStarting = i < 11;
      squadRows.push({
        team_id: team.id,
        player_id: playerId,
        is_starting: isStarting,
        bench_order: isStarting ? i : i - 10,
        acquired_via: "draft",
      });
    });
  }

  const { error: squadErr } = await sc.from("squad_players").insert(squadRows);
  if (squadErr) {
    return NextResponse.json({ error: `squad_players insert failed: ${squadErr.message}` }, { status: 500 });
  }

  // ── 7. Mark draft complete ────────────────────────────────────────────────
  await sc.from("leagues").update({ draft_status: "complete" }).eq("id", league.id);

  return NextResponse.json({
    success: true,
    message: `Test league seeded: 8 teams, ${SQUAD_SIZE} players each, draft complete`,
    leagueName: "The Gaffer's League",
    leagueId: league.id,
    teamCount: 8,
    playersPerTeam: SQUAD_SIZE,
  });
}
