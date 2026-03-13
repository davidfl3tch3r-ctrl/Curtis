-- Migration 008: RLS policy fixes
-- Fixes:
-- 1. matchups table had RLS enabled but NO policies → 0 rows for all clients
-- 2. teams table missing UPDATE policy → formation saves silently fail
-- 3. squad_players table missing UPDATE policy → lineup saves silently fail
-- 4. leagues table missing UPDATE policy → settings saves silently fail
-- Note: score sync uses serviceClient() (service role), which bypasses RLS,
--       so only client-facing SELECT/UPDATE policies are needed here.

-- ─── MATCHUPS ────────────────────────────────────────────────────────────────
-- League members can read all matchups in their league
create policy "Matchups readable by league members"
  on public.matchups
  for select to authenticated
  using (league_id in (select public.my_league_ids()));

-- ─── TEAMS ───────────────────────────────────────────────────────────────────
-- Users can update their own team (formation, name, etc.)
create policy "Users can update their own team"
  on public.teams
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── SQUAD PLAYERS ───────────────────────────────────────────────────────────
-- Users can update their own squad players (is_starting, bench_order, captain, etc.)
create policy "Users can update their own squad players"
  on public.squad_players
  for update to authenticated
  using (team_id in (select id from public.teams where user_id = auth.uid()))
  with check (team_id in (select id from public.teams where user_id = auth.uid()));

-- Users can delete their own squad players (needed for waiver/trade processing on client)
create policy "Users can delete their own squad players"
  on public.squad_players
  for delete to authenticated
  using (team_id in (select id from public.teams where user_id = auth.uid()));

-- ─── LEAGUES ─────────────────────────────────────────────────────────────────
-- Commissioner can update league settings
create policy "Commissioner can update league"
  on public.leagues
  for update to authenticated
  using (commissioner_id = auth.uid())
  with check (commissioner_id = auth.uid());
