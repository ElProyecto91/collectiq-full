/*
# Enable RLS on read-only catalog tables (funko_items, funko_price_history, onepiece_cards)

NOT EXECUTED. Review and run by hand.

## Why
These three tables have RLS disabled, so the anon key can insert, update and
delete every row. funko_items and funko_price_history already carry a
"SELECT true" policy that is currently inert because RLS is off.

## What the client does today (verified in the repo)
- funko_items: the client only SELECTs (FunkoExplorerPage, FunkoScannerPage,
  FunkoChecklistPage, FunkoDetailPage). Writes come from the Worker
  (handlers/funko.js) and api/funko-import.ts, which use service_role and
  bypass RLS.
- funko_price_history: the client only inserts from FunkoStatsPage.tsx, and the
  table has 0 rows. That insert passes a funko_collection.id as funko_id, so it
  never produced data. With RLS enabled it stays blocked; the page ignores the
  error and keeps working (the price refresh on funko_collection is unaffected).
- onepiece_cards: unused by the client and the Worker, 0 rows.

## Result
Public read stays. Writes are limited to service_role.

## Deliberately NOT in this migration
- funko_collection and funko_wishlist: their policies filter on
  current_setting('app.telegram_user_id'), which the browser client never sets.
  Enabling RLS there would block the whole Funko collection UI. The real fix is
  to move those reads and writes to the Worker with Telegram initData
  verification. Until then they stay open.
- user_premium: see 20260930120100_enable_rls_user_premium.sql.
*/

ALTER TABLE public.funko_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funko_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onepiece_cards      ENABLE ROW LEVEL SECURITY;

-- funko_items ("Anyone can read funko items") and funko_price_history
-- ("Anyone can read funko prices") already have SELECT policies. Only
-- onepiece_cards lacks one.
DROP POLICY IF EXISTS "onepiece_cards_public_read" ON public.onepiece_cards;
CREATE POLICY "onepiece_cards_public_read" ON public.onepiece_cards
  FOR SELECT TO anon, authenticated USING (true);
