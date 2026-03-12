-- Lineup management: formation, captain, vice captain

ALTER TABLE public.squad_players
  ADD COLUMN IF NOT EXISTS is_captain boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_vice_captain boolean DEFAULT false;

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS formation text DEFAULT '4-3-3';

-- Allow users to update their own squad players (for lineup saves)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='squad_players' AND policyname='Users can update their own squad players'
  ) THEN
    CREATE POLICY "Users can update their own squad players" ON public.squad_players
      FOR UPDATE TO authenticated
      USING (team_id IN (SELECT id FROM public.teams WHERE user_id = auth.uid()))
      WITH CHECK (team_id IN (SELECT id FROM public.teams WHERE user_id = auth.uid()));
  END IF;
END $$;

-- Allow users to update their own teams (for formation saves)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='teams' AND policyname='Users can update their own teams'
  ) THEN
    CREATE POLICY "Users can update their own teams" ON public.teams
      FOR UPDATE TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
