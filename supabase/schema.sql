-- ─────────────────────────────────────────────────────────────────────────────
-- CURTIS Complete Database Schema
-- Paste this into: Supabase → SQL Editor → New Query → Run
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists "uuid-ossp";

-- PROFILES (extends Supabase auth)
create table public.profiles (
  id         uuid references auth.users on delete cascade primary key,
  username   text unique not null,
  email      text not null,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Own profile" on public.profiles for all using (auth.uid() = id);

-- LEAGUES
create table public.leagues (
  id                uuid default uuid_generate_v4() primary key,
  name              text not null,
  commissioner_id   uuid references public.profiles(id) not null,
  format            text check (format in ('h2h','points')) default 'h2h',
  privacy           text check (privacy in ('private','public')) default 'private',
  season            text not null default '2025-26',
  max_teams         int  not null default 10,
  squad_size        int  not null default 15,
  bench_size        int  not null default 4,
  transfer_type     text check (transfer_type in ('none','waiver','free','trade')) default 'waiver',
  draft_type        text check (draft_type in ('snake','linear','auction','random_snake')) default 'snake',
  pick_time_seconds int  default 60,
  autopick          text check (autopick in ('best','skip')) default 'best',
  draft_status      text check (draft_status in ('pending','live','complete')) default 'pending',
  draft_date        timestamptz,
  invite_code       text unique default substr(md5(random()::text),1,8),
  created_at        timestamptz default now()
);
alter table public.leagues enable row level security;
-- All authenticated users can read leagues (needed for invite-link join flow)
create policy "Leagues readable by authenticated users" on public.leagues
  for select to authenticated using (true);
-- Only the commissioner field owner can insert
create policy "Authenticated users can create leagues" on public.leagues
  for insert to authenticated with check (commissioner_id = auth.uid());

-- SCORING RULES (one row per stat per league)
create table public.scoring_rules (
  id         uuid default uuid_generate_v4() primary key,
  league_id  uuid references public.leagues(id) on delete cascade,
  stat_key   text not null,
  stat_label text not null,
  stat_group text not null,
  fwd_pts    numeric(5,2) default 0,
  mid_pts    numeric(5,2) default 0,
  def_pts    numeric(5,2) default 0,
  gk_pts     numeric(5,2) default 0,
  unique(league_id, stat_key)
);
alter table public.scoring_rules enable row level security;
create policy "Scoring rules readable by league members" on public.scoring_rules
  for select to authenticated
  using (league_id in (select public.my_league_ids()));
create policy "Commissioner can insert scoring rules" on public.scoring_rules
  for insert to authenticated
  with check (league_id in (select id from public.leagues where commissioner_id = auth.uid()));

-- TEAMS (a user's entry inside a league)
create table public.teams (
  id             uuid default uuid_generate_v4() primary key,
  league_id      uuid references public.leagues(id) on delete cascade,
  user_id        uuid references public.profiles(id),
  name           text not null,
  draft_position int,
  total_points   numeric(8,2) default 0,
  gw_points      numeric(6,2) default 0,
  created_at     timestamptz default now(),
  unique(league_id, user_id)
);
alter table public.teams enable row level security;
-- Use a security-definer function to avoid recursive RLS on the teams table
create or replace function public.my_league_ids()
returns setof uuid language sql security definer stable as $$
  select league_id from public.teams where user_id = auth.uid()
$$;
create policy "Teams visible to league members" on public.teams
  for select to authenticated
  using (league_id in (select public.my_league_ids()));
create policy "Users can read their own teams" on public.teams
  for select to authenticated
  using (user_id = auth.uid());
create policy "Users can create their own team" on public.teams
  for insert to authenticated
  with check (user_id = auth.uid());

-- PLAYERS (synced from API-Football)
create table public.players (
  id            text primary key,   -- API-Football player ID
  name          text not null,
  first_name    text,
  last_name     text,
  club          text not null,
  club_full     text,
  position      text check (position in ('GK','DEF','MID','FWD')) not null,
  api_rank      int,
  season_points numeric(8,2) default 0,
  gw_points     numeric(6,2) default 0,
  is_available  boolean default true,
  photo_url     text,
  updated_at    timestamptz default now()
);
alter table public.players enable row level security;
create policy "Players readable by authed users" on public.players for select to authenticated using (true);

-- DRAFT PICKS
create table public.draft_picks (
  id          uuid default uuid_generate_v4() primary key,
  league_id   uuid references public.leagues(id) on delete cascade,
  team_id     uuid references public.teams(id),
  player_id   text references public.players(id),
  round       int not null,
  pick_number int not null,
  picked_at   timestamptz default now(),
  is_autopick boolean default false,
  unique(league_id, pick_number),
  unique(league_id, player_id)
);
alter table public.draft_picks enable row level security;
create policy "Draft picks readable by league members" on public.draft_picks
  for select to authenticated
  using (league_id in (select public.my_league_ids()));
create policy "Teams can insert their own picks" on public.draft_picks
  for insert to authenticated
  with check (team_id in (select id from public.teams where user_id = auth.uid()));

-- SQUAD PLAYERS (active roster)
create table public.squad_players (
  id           uuid default uuid_generate_v4() primary key,
  team_id      uuid references public.teams(id) on delete cascade,
  player_id    text references public.players(id),
  is_starting  boolean default true,
  bench_order  int,
  acquired_via text check (acquired_via in ('draft','waiver','trade','free_agent')) default 'draft',
  acquired_at  timestamptz default now(),
  unique(team_id, player_id)
);
alter table public.squad_players enable row level security;
create policy "Squad players readable by league members" on public.squad_players
  for select to authenticated
  using (team_id in (select id from public.teams where league_id in (select public.my_league_ids())));
create policy "Users can insert their own squad players" on public.squad_players
  for insert to authenticated
  with check (team_id in (select id from public.teams where user_id = auth.uid()));

-- GAMEWEEKS
create table public.gameweeks (
  id         uuid default uuid_generate_v4() primary key,
  season     text not null,
  number     int  not null,
  name       text not null,
  deadline   timestamptz not null,
  start_date date not null,
  end_date   date not null,
  status     text check (status in ('upcoming','live','complete')) default 'upcoming',
  unique(season, number)
);
alter table public.gameweeks enable row level security;
create policy "Gameweeks readable" on public.gameweeks for select to authenticated using (true);

-- FIXTURES (synced from API-Football)
create table public.fixtures (
  id            uuid default uuid_generate_v4() primary key,
  api_id        int  unique,           -- API-Football fixture ID
  gameweek_id   uuid references public.gameweeks(id),
  home_club     text not null,
  away_club     text not null,
  kickoff       timestamptz not null,
  home_score    int,
  away_score    int,
  status        text check (status in ('scheduled','live','complete')) default 'scheduled',
  minute        int
);
alter table public.fixtures enable row level security;
create policy "Fixtures readable" on public.fixtures for select to authenticated using (true);

-- PLAYER STATS (calculated from API-Football + scoring engine)
create table public.player_stats (
  id                   uuid default uuid_generate_v4() primary key,
  player_id            text references public.players(id),
  fixture_id           uuid references public.fixtures(id),
  gameweek_id          uuid references public.gameweeks(id),
  goals                int  default 0,
  assists              int  default 0,
  key_passes           int  default 0,
  shots_on_target      int  default 0,
  big_chances_created  int  default 0,
  big_chances_missed   int  default 0,
  passes_total         int  default 0,
  pass_accuracy        numeric(5,2) default 0,
  minutes_played       int  default 0,
  tackles_won          int  default 0,
  interceptions        int  default 0,
  clearances           int  default 0,
  goals_conceded       int  default 0,
  saves                int  default 0,
  penalty_saves        int  default 0,
  yellow_cards         int  default 0,
  red_cards            int  default 0,
  own_goals            int  default 0,
  penalties_missed     int  default 0,
  penalties_conceded   int  default 0,
  turnovers            int  default 0,
  corners_won          int  default 0,
  defensive_errors     int  default 0,
  fantasy_points       numeric(6,2) default 0,
  updated_at           timestamptz default now(),
  unique(player_id, fixture_id)
);
alter table public.player_stats enable row level security;
create policy "Stats readable" on public.player_stats for select to authenticated using (true);

-- MATCHUPS (H2H gameweek pairings)
create table public.matchups (
  id             uuid default uuid_generate_v4() primary key,
  league_id      uuid references public.leagues(id) on delete cascade,
  gameweek_id    uuid references public.gameweeks(id),
  home_team_id   uuid references public.teams(id),
  away_team_id   uuid references public.teams(id),
  home_points    numeric(6,2) default 0,
  away_points    numeric(6,2) default 0,
  status         text check (status in ('upcoming','live','complete')) default 'upcoming',
  winner_team_id uuid references public.teams(id)
);
alter table public.matchups enable row level security;

-- CREDITS (added to teams)
-- alter table public.teams add column if not exists credits int default 100;
-- Run the migration SQL below instead of re-running the full schema.

-- WAIVER BIDS
create table public.waiver_bids (
  id             uuid default uuid_generate_v4() primary key,
  league_id      uuid references public.leagues(id) on delete cascade,
  team_id        uuid references public.teams(id) on delete cascade,
  player_id      text references public.players(id),
  drop_player_id text references public.players(id),
  bid_amount     int  not null default 0,
  gameweek_id    uuid references public.gameweeks(id),
  status         text check (status in ('pending','won','lost','cancelled')) default 'pending',
  created_at     timestamptz default now(),
  processed_at   timestamptz
);
alter table public.waiver_bids enable row level security;
create policy "Own team bids visible" on public.waiver_bids
  for select to authenticated
  using (team_id in (select id from public.teams where user_id = auth.uid()));
create policy "All processed bids visible" on public.waiver_bids
  for select to authenticated
  using (status != 'pending');
create policy "Users can manage own team bids" on public.waiver_bids
  for all to authenticated
  using (team_id in (select id from public.teams where user_id = auth.uid()))
  with check (team_id in (select id from public.teams where user_id = auth.uid()));

-- TRADES
create table public.trades (
  id                uuid default uuid_generate_v4() primary key,
  league_id         uuid references public.leagues(id) on delete cascade,
  proposing_team_id uuid references public.teams(id),
  receiving_team_id uuid references public.teams(id),
  status            text check (status in ('pending','accepted','rejected','countered','cancelled','expired')) default 'pending',
  message           text,
  parent_trade_id   uuid references public.trades(id),
  created_at        timestamptz default now(),
  responded_at      timestamptz,
  expires_at        timestamptz default now() + interval '3 days'
);
alter table public.trades enable row level security;
create policy "Trades visible to involved teams" on public.trades
  for select to authenticated
  using (
    proposing_team_id in (select id from public.teams where user_id = auth.uid())
    or receiving_team_id in (select id from public.teams where user_id = auth.uid())
  );
create policy "Users can propose trades" on public.trades
  for insert to authenticated
  with check (proposing_team_id in (select id from public.teams where user_id = auth.uid()));

-- TRADE ITEMS
create table public.trade_items (
  id           uuid default uuid_generate_v4() primary key,
  trade_id     uuid references public.trades(id) on delete cascade,
  player_id    text references public.players(id),
  from_team_id uuid references public.teams(id),
  to_team_id   uuid references public.teams(id)
);
alter table public.trade_items enable row level security;
create policy "Trade items visible to involved teams" on public.trade_items
  for select to authenticated
  using (trade_id in (
    select id from public.trades where
      proposing_team_id in (select id from public.teams where user_id = auth.uid())
      or receiving_team_id in (select id from public.teams where user_id = auth.uid())
  ));

-- ENABLE REALTIME (for live draft + live scoring + trades)
alter publication supabase_realtime add table public.draft_picks;
alter publication supabase_realtime add table public.player_stats;
alter publication supabase_realtime add table public.fixtures;
alter publication supabase_realtime add table public.matchups;
alter publication supabase_realtime add table public.trades;
alter publication supabase_realtime add table public.waiver_bids;
