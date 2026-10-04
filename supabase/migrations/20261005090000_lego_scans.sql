/*
# LEGO phase 5: part scan counter

NOT EXECUTED. Review and run by hand in the Supabase SQL Editor.

One row per scan of a LEGO part (photo -> candidates). It is a counter of its own, separate
from the card scanner's user_scans. Only the Worker writes here, with the service_role key
(which bypasses RLS), after it has verified the user's session token. The app can only read,
so the "scans today" number cannot be changed from the browser.
*/

CREATE TABLE IF NOT EXISTS public.lego_scans (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id bigint NOT NULL,
  scanned_at       timestamptz NOT NULL DEFAULT now(),
  candidates       integer NOT NULL DEFAULT 0,
  top_part         text,
  top_score        numeric(6, 4),
  ok               boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS lego_scans_user_time_idx
  ON public.lego_scans (telegram_user_id, scanned_at DESC);

ALTER TABLE public.lego_scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lego_scans_read" ON public.lego_scans;
CREATE POLICY "lego_scans_read" ON public.lego_scans
  FOR SELECT TO anon, authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.lego_scans FROM anon, authenticated;
