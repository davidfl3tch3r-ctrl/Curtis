-- Transfer Window: new tables and columns for CURTIS transfer market

ALTER TABLE public.leagues ADD COLUMN IF NOT EXISTS transfer_window_open boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS public.transfer_listings (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  league_id uuid REFERENCES public.leagues(id) ON DELETE CASCADE,
  seller_team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id text REFERENCES public.players(id),
  min_bid int NOT NULL DEFAULT 5,
  buy_it_now_price int,
  current_bid int DEFAULT 0,
  leading_team_id uuid REFERENCES public.teams(id),
  status text CHECK (status IN ('active','sold','unsold','cancelled')) DEFAULT 'active',
  listed_at timestamptz DEFAULT now(),
  closes_at timestamptz NOT NULL,
  sold_at timestamptz
);
ALTER TABLE public.transfer_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "League members can read listings" ON public.transfer_listings
  FOR SELECT TO authenticated
  USING (league_id IN (SELECT public.my_league_ids()));
CREATE POLICY "Users can create listings for their team" ON public.transfer_listings
  FOR INSERT TO authenticated
  WITH CHECK (seller_team_id IN (SELECT id FROM public.teams WHERE user_id = auth.uid()));
CREATE POLICY "Users can update listings they are involved in" ON public.transfer_listings
  FOR UPDATE TO authenticated
  USING (league_id IN (SELECT public.my_league_ids()));

CREATE TABLE IF NOT EXISTS public.transfer_bids (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  listing_id uuid REFERENCES public.transfer_listings(id) ON DELETE CASCADE,
  bidder_team_id uuid REFERENCES public.teams(id),
  bid_amount int NOT NULL,
  placed_at timestamptz DEFAULT now(),
  status text CHECK (status IN ('leading','outbid','won','lost','refunded')) DEFAULT 'leading'
);
ALTER TABLE public.transfer_bids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "League members can read bids" ON public.transfer_bids
  FOR SELECT TO authenticated
  USING (listing_id IN (
    SELECT id FROM public.transfer_listings
    WHERE league_id IN (SELECT public.my_league_ids())
  ));
CREATE POLICY "Users can place bids" ON public.transfer_bids
  FOR INSERT TO authenticated
  WITH CHECK (bidder_team_id IN (SELECT id FROM public.teams WHERE user_id = auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.transfer_listings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transfer_bids;
