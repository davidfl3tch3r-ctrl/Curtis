-- League commissioners: allows a league creator to grant co-commissioner rights
-- to other managers in the league.
--
-- Permissions granted to co-commissioners:
--   - Edit scoring rules (before draft)
--   - Manage waiver bids (approve/reject)
--   - Send announcements in chat
--
-- Only the original creator (leagues.created_by) can:
--   - Delete the league
--   - Add or remove commissioners

CREATE TABLE IF NOT EXISTS public.league_commissioners (
  id         uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  league_id  uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_by   uuid REFERENCES public.profiles(id),
  added_at   timestamptz DEFAULT now(),
  UNIQUE(league_id, user_id)
);

ALTER TABLE public.league_commissioners ENABLE ROW LEVEL SECURITY;

-- League members can read who the commissioners are
CREATE POLICY "Commissioners readable by league members"
  ON public.league_commissioners FOR SELECT TO authenticated
  USING (league_id IN (SELECT public.my_league_ids()));

-- Only the league creator can insert new commissioners
CREATE POLICY "Only creator can add commissioners"
  ON public.league_commissioners FOR INSERT TO authenticated
  WITH CHECK (
    league_id IN (
      SELECT id FROM public.leagues WHERE created_by = auth.uid()
    )
  );

-- Only the league creator can remove commissioners
CREATE POLICY "Only creator can remove commissioners"
  ON public.league_commissioners FOR DELETE TO authenticated
  USING (
    league_id IN (
      SELECT id FROM public.leagues WHERE created_by = auth.uid()
    )
  );
