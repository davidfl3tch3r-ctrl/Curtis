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

// Positional composition per team (15 players total)
const TEAM_COUNT = 8;
const POS_ROUNDS: Array<{ pos: string; count: number }> = [
  { pos: "GK",  count: 2 },
  { pos: "DEF", count: 5 },
  { pos: "MID", count: 5 },
  { pos: "FWD", count: 3 },
];
const SQUAD_SIZE = POS_ROUNDS.reduce((s, r) => s + r.count, 0); // 15

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

  const { data: botTeams, error: botErr } = await sc
    .from("teams")
    .insert(TEST_TEAM_NAMES.map((name, i) => ({
      league_id: league.id,
      user_id: null as string | null,
      name,
      draft_position: i + 2,
    })))
    .select("id");

  if (botErr || !botTeams) {
    return NextResponse.json({ error: botErr?.message ?? "Failed to create bot teams" }, { status: 500 });
  }

  const allTeams = [myTeam, ...botTeams];

  // ── 3. Fetch players per position ─────────────────────────────────────────
  const fetchPos = async (pos: string, limit: number) => {
    const { data } = await sc.from("players").select("id").eq("position", pos).eq("is_available", true).limit(limit);
    return (data ?? []).map((p: { id: string }) => p.id);
  };

  const [gks, defs, mids, fwds] = await Promise.all([
    fetchPos("GK",  TEAM_COUNT * 2 + 4),   // 20 GKs
    fetchPos("DEF", TEAM_COUNT * 5 + 8),   // 48 DEFs
    fetchPos("MID", TEAM_COUNT * 5 + 8),   // 48 MIDs
    fetchPos("FWD", TEAM_COUNT * 3 + 6),   // 30 FWDs
  ]);

  const posPool: Record<string, string[]> = { GK: gks, DEF: defs, MID: mids, FWD: fwds };
  const needed = { GK: TEAM_COUNT * 2, DEF: TEAM_COUNT * 5, MID: TEAM_COUNT * 5, FWD: TEAM_COUNT * 3 };
  const missing = Object.entries(needed)
    .filter(([pos, n]) => posPool[pos].length < n)
    .map(([pos, n]) => `${pos}: need ${n}, have ${posPool[pos].length}`);

  if (missing.length) {
    await sc.from("leagues").update({ draft_status: "complete" }).eq("id", league.id);
    return NextResponse.json({
      warning: `Not enough players in DB. ${missing.join("; ")}. Add player data first. League/teams created but squads empty.`,
      leagueId: league.id,
    });
  }

  // ── 4. Position-stratified snake draft ────────────────────────────────────
  // Rounds are grouped by position: 2 GK rounds, 5 DEF rounds, 5 MID rounds, 3 FWD rounds.
  // This guarantees every team gets exactly 2 GK, 5 DEF, 5 MID, 3 FWD.
  const teamPlayers: Record<string, string[]> = {};
  for (const t of allTeams) teamPlayers[t.id] = [];

  const draftPickRows: {
    league_id: string; team_id: string; player_id: string;
    round: number; pick_number: number; is_autopick: boolean;
  }[] = [];

  let pickNumber = 1;
  let round = 0;

  for (const { pos, count } of POS_ROUNDS) {
    const pool = posPool[pos];
    for (let r = 0; r < count; r++) {
      round++;
      const order = round % 2 === 1 ? allTeams : [...allTeams].reverse();
      for (const team of order) {
        const playerId = pool.shift();
        if (!playerId) continue;
        teamPlayers[team.id].push(playerId);
        draftPickRows.push({
          league_id: league.id,
          team_id: team.id,
          player_id: playerId,
          round,
          pick_number: pickNumber++,
          is_autopick: true,
        });
      }
    }
  }

  // ── 5. Insert draft_picks ─────────────────────────────────────────────────
  const { error: pickErr } = await sc.from("draft_picks").insert(draftPickRows);
  if (pickErr) {
    return NextResponse.json({ error: `draft_picks insert failed: ${pickErr.message}` }, { status: 500 });
  }

  // ── 6. Insert squad_players (11 starters + 4 bench) ──────────────────────
  const squadRows: {
    team_id: string; player_id: string; is_starting: boolean;
    bench_order: number | null; acquired_via: string;
  }[] = [];

  for (const team of allTeams) {
    teamPlayers[team.id].forEach((playerId, i) => {
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
    message: `Test league seeded: ${TEAM_COUNT} teams, ${SQUAD_SIZE} players each (2 GK / 5 DEF / 5 MID / 3 FWD), draft complete`,
    leagueName: "The Gaffer's League",
    leagueId: league.id,
    teamCount: TEAM_COUNT,
    playersPerTeam: SQUAD_SIZE,
  });
}
