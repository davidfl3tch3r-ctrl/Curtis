-- Gamification: streaks + badges
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS streak int DEFAULT 0;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS best_streak int DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.manager_badges (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_key text NOT NULL,
  badge_name text NOT NULL,
  badge_emoji text NOT NULL,
  earned_at timestamptz DEFAULT now(),
  UNIQUE(user_id, badge_key)
);

ALTER TABLE public.manager_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own badges" ON public.manager_badges
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
