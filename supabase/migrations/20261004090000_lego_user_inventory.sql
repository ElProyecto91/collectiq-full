/*
# LEGO phase 2: user inventory (loose parts) and owned sets

NOT EXECUTED. Review and run by hand in the Supabase SQL Editor.

The LEGO catalog lives in Turso, so these tables have no foreign keys to it:
part_num / color_id / set_num are Rebrickable identifiers, resolved in the app.

## Tables
- user_lego_parts: one row per (user, part, color) with a quantity.
- user_lego_sets: one row per owned COPY of a set (you can own a sealed and an
  open copy of the same set). status: sealed | open_complete | incomplete.
  Not user_collection on purpose: that table's RLS policy filters on
  current_setting('app.telegram_user_id'), which the browser client never sets,
  so the app could not read or write it.

## Functions
- add_lego_parts(user, items jsonb): adds quantities, creating rows as needed.
  items = [{"part_num":"3001","color_id":4,"quantity":2}, ...]. Duplicates inside
  one call are summed first. Returns the number of (part, color) rows touched.
- remove_lego_parts(user, items jsonb): subtracts quantities; a row that would
  reach zero or below is deleted. Used to undo "I own this whole set".

## Security (read this)
Same pattern as user_cards: RLS policies are open (anon + authenticated) and the
app scopes every query with telegram_user_id on the client. Anyone holding the
anon key could read or change any user's rows. That is acceptable only because
the app has a single user. If other people ever use it, move these reads and
writes behind the Worker (Telegram initData verification) before opening it up.
*/

CREATE TABLE IF NOT EXISTS public.user_lego_parts (
  telegram_user_id bigint NOT NULL,
  part_num         text   NOT NULL,
  color_id         integer NOT NULL,
  quantity         integer NOT NULL CHECK (quantity > 0),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (telegram_user_id, part_num, color_id)
);

CREATE TABLE IF NOT EXISTS public.user_lego_sets (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id bigint NOT NULL,
  set_num          text   NOT NULL,
  status           text   NOT NULL DEFAULT 'sealed'
                   CHECK (status IN ('sealed', 'open_complete', 'incomplete')),
  price_paid       numeric(12, 2) CHECK (price_paid IS NULL OR price_paid >= 0),
  rrp              numeric(12, 2) CHECK (rrp IS NULL OR rrp >= 0),
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_lego_sets_user_set_idx
  ON public.user_lego_sets (telegram_user_id, set_num);

ALTER TABLE public.user_lego_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_lego_sets  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_lego_parts_all" ON public.user_lego_parts;
CREATE POLICY "user_lego_parts_all" ON public.user_lego_parts
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "user_lego_sets_all" ON public.user_lego_sets;
CREATE POLICY "user_lego_sets_all" ON public.user_lego_sets
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.add_lego_parts(p_telegram_user_id bigint, p_items jsonb)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  n integer;
BEGIN
  WITH agg AS (
    SELECT x.part_num, x.color_id, SUM(x.quantity)::integer AS quantity
    FROM jsonb_to_recordset(p_items) AS x(part_num text, color_id integer, quantity integer)
    WHERE x.part_num IS NOT NULL AND x.color_id IS NOT NULL AND x.quantity > 0
    GROUP BY x.part_num, x.color_id
  ), ins AS (
    INSERT INTO public.user_lego_parts AS u (telegram_user_id, part_num, color_id, quantity)
    SELECT p_telegram_user_id, a.part_num, a.color_id, a.quantity FROM agg a
    ON CONFLICT (telegram_user_id, part_num, color_id)
    DO UPDATE SET quantity = u.quantity + EXCLUDED.quantity, updated_at = now()
    RETURNING 1
  )
  SELECT count(*) INTO n FROM ins;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_lego_parts(p_telegram_user_id bigint, p_items jsonb)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  r record;
  n integer := 0;
BEGIN
  FOR r IN
    SELECT x.part_num, x.color_id, SUM(x.quantity)::integer AS quantity
    FROM jsonb_to_recordset(p_items) AS x(part_num text, color_id integer, quantity integer)
    WHERE x.part_num IS NOT NULL AND x.color_id IS NOT NULL AND x.quantity > 0
    GROUP BY x.part_num, x.color_id
  LOOP
    UPDATE public.user_lego_parts
       SET quantity = quantity - r.quantity, updated_at = now()
     WHERE telegram_user_id = p_telegram_user_id
       AND part_num = r.part_num AND color_id = r.color_id
       AND quantity > r.quantity;
    IF NOT FOUND THEN
      -- the row has r.quantity or less: it reaches zero, so it goes away
      DELETE FROM public.user_lego_parts
       WHERE telegram_user_id = p_telegram_user_id
         AND part_num = r.part_num AND color_id = r.color_id;
    END IF;
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;
