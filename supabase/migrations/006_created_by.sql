-- Add created_by to leagues (tracks original creator for commissioner permissions)
ALTER TABLE public.leagues ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);

-- Backfill from commissioner_id for existing leagues
UPDATE public.leagues SET created_by = commissioner_id WHERE created_by IS NULL;
