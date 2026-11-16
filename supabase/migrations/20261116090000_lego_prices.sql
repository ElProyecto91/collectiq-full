/*
# LEGO prices (BrickLink price guide, in euros)

NOT EXECUTED. Review and run by hand in the Supabase SQL Editor. Only ADDS two tables.

- lego_prices: one row per part+color (kind 'part', color_id = the REBRICKABLE color id) or per set
  (kind 'set', color_id = -1). Average sold price, new and used, in EUR, with how many units it is based on and
  whether it comes from 'sold' (last 6 months) or, when nothing sold, 'stock' (current offers).
  Filled by the Worker (route lego-prices) from the BrickLink API; refreshed after 30 days.
  status 'not_found' = BrickLink has no such item/color under that number (e.g. numbering differs).
- lego_bl_colors: BrickLink's color list, used by the Worker to match Rebrickable colors by name.

Prices are public market data: readable by the app, written only by the Worker (service role).
*/

CREATE TABLE IF NOT EXISTS public.lego_prices (
  kind        text    NOT NULL CHECK (kind IN ('part', 'set')),
  item_num    text    NOT NULL,
  color_id    integer NOT NULL DEFAULT -1,
  status      text    NOT NULL CHECK (status IN ('ok', 'not_found', 'error')),
  bl_item     text,
  bl_color    integer,
  new_avg     numeric(12, 4),
  new_qty     integer,
  new_basis   text,
  used_avg    numeric(12, 4),
  used_qty    integer,
  used_basis  text,
  currency    text    NOT NULL DEFAULT 'EUR',
  fetched_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, item_num, color_id)
);

CREATE TABLE IF NOT EXISTS public.lego_bl_colors (
  bl_id      integer PRIMARY KEY,
  name       text NOT NULL,
  rgb        text,
  color_type text
);

ALTER TABLE public.lego_prices    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lego_bl_colors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lego_prices_read" ON public.lego_prices;
CREATE POLICY "lego_prices_read" ON public.lego_prices FOR SELECT TO anon, authenticated USING (true);
-- lego_bl_colors: no policy = only the Worker (service role) can read or write it
REVOKE INSERT, UPDATE, DELETE ON public.lego_prices FROM anon, authenticated;
