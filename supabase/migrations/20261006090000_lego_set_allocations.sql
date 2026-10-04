/*
# LEGO: loose parts assigned to sets in the collection

NOT EXECUTED. Review and run by hand in the Supabase SQL Editor.
Requires 20261004090000_lego_user_inventory.sql (user_lego_parts, user_lego_sets).

## Idea
The inventory (user_lego_parts) is never reduced. An allocation RESERVES part of it for one
owned copy of a set (user_lego_sets row):

    free = owned quantity - sum of the allocations of every copy

Deleting the set copy deletes its allocations (ON DELETE CASCADE), so the pieces are free
again, together with any pieces added to the inventory in the meantime.

## Tables
- user_lego_set_allocations: (user_set_id, part_num, color_id) -> quantity. part_num is the
  REAL part held in the inventory (not a canonical mold), so free quantities stay exact when
  several interchangeable molds fill one slot of a set.

## Functions
- assign_lego_set_parts(user, user_set_id, items jsonb): replaces the allocation of one copy
  in a single transaction. Each quantity is clamped to what is free for that (part, color)
  after the OTHER copies' allocations, so two screens racing cannot over-assign.
  items = [{"part_num":"3001","color_id":4,"quantity":2}, ...]. Returns the number of rows kept.

## Security
Same open-RLS pattern as the other LEGO user tables (single-user app). See the note in
20261004090000_lego_user_inventory.sql before opening the app to other people.
*/

CREATE TABLE IF NOT EXISTS public.user_lego_set_allocations (
  telegram_user_id bigint  NOT NULL,
  user_set_id      uuid    NOT NULL REFERENCES public.user_lego_sets (id) ON DELETE CASCADE,
  part_num         text    NOT NULL,
  color_id         integer NOT NULL,
  quantity         integer NOT NULL CHECK (quantity > 0),
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_set_id, part_num, color_id)
);

CREATE INDEX IF NOT EXISTS user_lego_set_alloc_user_part_idx
  ON public.user_lego_set_allocations (telegram_user_id, part_num, color_id);

ALTER TABLE public.user_lego_set_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_lego_set_allocations_all" ON public.user_lego_set_allocations;
CREATE POLICY "user_lego_set_allocations_all" ON public.user_lego_set_allocations
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.assign_lego_set_parts(
  p_telegram_user_id bigint, p_user_set_id uuid, p_items jsonb)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  r record;
  free_qty integer;
  take integer;
  n integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_lego_sets
                  WHERE id = p_user_set_id AND telegram_user_id = p_telegram_user_id) THEN
    RAISE EXCEPTION 'set copy not found';
  END IF;

  -- serialize assignments of one user: free quantities are computed from the other copies
  PERFORM pg_advisory_xact_lock(p_telegram_user_id);

  DELETE FROM public.user_lego_set_allocations WHERE user_set_id = p_user_set_id;

  FOR r IN
    SELECT x.part_num, x.color_id, SUM(x.quantity)::integer AS quantity
    FROM jsonb_to_recordset(p_items) AS x(part_num text, color_id integer, quantity integer)
    WHERE x.part_num IS NOT NULL AND x.color_id IS NOT NULL AND x.quantity > 0
    GROUP BY x.part_num, x.color_id
  LOOP
    SELECT COALESCE((SELECT u.quantity FROM public.user_lego_parts u
                      WHERE u.telegram_user_id = p_telegram_user_id
                        AND u.part_num = r.part_num AND u.color_id = r.color_id), 0)
         - COALESCE((SELECT SUM(a.quantity) FROM public.user_lego_set_allocations a
                      WHERE a.telegram_user_id = p_telegram_user_id
                        AND a.part_num = r.part_num AND a.color_id = r.color_id), 0)
      INTO free_qty;
    take := LEAST(r.quantity, free_qty);
    IF take > 0 THEN
      INSERT INTO public.user_lego_set_allocations (telegram_user_id, user_set_id, part_num, color_id, quantity)
      VALUES (p_telegram_user_id, p_user_set_id, r.part_num, r.color_id, take);
      n := n + 1;
    END IF;
  END LOOP;
  RETURN n;
END;
$$;
