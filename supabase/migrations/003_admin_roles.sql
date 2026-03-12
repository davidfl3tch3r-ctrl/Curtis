-- ─── CURTIS Migration 003: Admin Roles ───────────────────────────────────────
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
--
-- TO ASSIGN AN ADMIN ROLE:
--   1. Go to Supabase Dashboard → Table Editor → profiles
--   2. Find the user row by email or id
--   3. Click the role cell and change it from 'user' to 'admin' or 'moderator'
--   4. Click Save
--   Alternatively run: UPDATE public.profiles SET role = 'admin' WHERE email = 'your@email.com';

-- Add role column to profiles (idempotent)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'user'
  CHECK (role IN ('user', 'admin', 'moderator'));

-- Add credits column to teams (idempotent)
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS credits int DEFAULT 100;

-- RLS policy: admins and moderators can read all profiles
-- (Drop first if re-running to avoid duplicate policy error)
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;

CREATE POLICY "Admins can read all profiles"
  ON public.profiles
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE role IN ('admin', 'moderator')
    )
  );
