/*
# Rollback of 20261101092000_close_rls.sql: reopen everything as it was (single open policy)

NOT EXECUTED. Run in the Supabase SQL Editor only if the app broke after closing RLS.
After this, the data is as exposed as before (anyone with the public anon key can read/write it).
*/

CREATE OR REPLACE FUNCTION pg_temp.ciq_open(tbl text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r record;
BEGIN
  IF to_regclass('public.' || tbl) IS NULL THEN RETURN; END IF;
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, tbl);
  END LOOP;
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
  EXECUTE format('GRANT ALL ON public.%I TO anon, authenticated', tbl);
  EXECUTE format('CREATE POLICY rollback_open ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', tbl);
END $$;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'user_sessions', 'auth_codes',
    'collection_items', 'wishlist_items', 'funko_collection', 'funko_wishlist', 'user_collection', 'user_wishlist',
    'user_lego_sets', 'user_lego_parts', 'user_lego_set_allocations',
    'activity_feed', 'bug_reports', 'card_price_history', 'collection_snapshots', 'daily_missions',
    'deck_cards', 'deck_comments', 'deck_copies', 'deck_votes', 'decks', 'feature_votes',
    'marketplace_listings', 'marketplace_offers', 'price_alerts', 'public_profiles',
    'user_achievements', 'user_badges', 'user_follows', 'user_notifications', 'user_reputation',
    'user_streaks', 'user_xp', 'user_premium', 'funko_price_history',
    'analytics_events', 'user_scans', 'referrals',
    'catalog_items', 'tcg_registry', 'price_history', 'funko_items', 'onepiece_cards'] LOOP
    PERFORM pg_temp.ciq_open(t);
  END LOOP;
END $$;

GRANT SELECT ON public.user_directory TO anon, authenticated;
