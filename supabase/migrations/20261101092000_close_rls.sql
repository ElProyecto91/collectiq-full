/*
# Close the open RLS (run LAST, and only after the checks below)

NOT EXECUTED. Review and run by hand in the Supabase SQL Editor, SECTION BY SECTION.

## Before running ANYTHING here (otherwise the app stops working)
1. The new Worker and app are deployed (they send a JWT) and 20261101090000 + 20261101091000 were run.
2. Worker secret SUPABASE_JWT_SECRET is set, and this returns {"ok":true,...} when opened in the app with
   your session:  GET https://collectiq-api.esxdinero.workers.dev/auth-token?check=1  (Authorization: Bearer <session>)
   If it says ok:false, DO NOT RUN THIS FILE: the secret is wrong.
3. Rollback if something breaks: run 20261101093000_rollback_open_rls.sql.

## What each section does
1. Secrets: user_sessions (session tokens!) and auth_codes become unreachable from the browser. Today anyone
   with the public anon key can read every session token and impersonate any user.
2. Shared collection: each row of the collection tables is only visible/editable by the members of the
   owner's household (by the JWT). Cards/wishlist of someone who made their profile public stay readable.
3. The rest: the anonymous visitor loses access; a logged-in user (has the JWT) keeps what they had.
   This does NOT make social tables "own rows only": any logged-in user can still edit another user's xp,
   decks, etc. (as before). user_premium is still writable by any logged-in user because the purchase flow
   writes it from the browser (use-premium.ts) - fix that flow (let the Worker write it) before locking it.
4. Public catalogs: read-only for everyone.

Tables that do not exist yet are skipped.
*/

-- helper: drop every policy of a table and enable RLS (skips missing tables)
CREATE OR REPLACE FUNCTION pg_temp.ciq_reset(tbl text) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE r record;
BEGIN
  IF to_regclass('public.' || tbl) IS NULL THEN RETURN false; END IF;
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, tbl);
  END LOOP;
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
  RETURN true;
END $$;

-- ── 1. Secrets ─────────────────────────────────────────────────────────────
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['user_sessions', 'auth_codes'] LOOP
    IF pg_temp.ciq_reset(t) THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    END IF;
  END LOOP;
END $$;
REVOKE SELECT ON public.user_directory FROM anon;

-- ── 2. Shared collection (household) ────────────────────────────────────────
DO $$
DECLARE t text;
  mine text := 'telegram_user_id IN (SELECT public.household_user_ids(public.jwt_telegram_user_id()))';
BEGIN
  FOREACH t IN ARRAY ARRAY['collection_items', 'wishlist_items', 'funko_collection', 'funko_wishlist',
                           'user_collection', 'user_wishlist',
                           'user_lego_sets', 'user_lego_parts', 'user_lego_set_allocations'] LOOP
    IF pg_temp.ciq_reset(t) THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
      EXECUTE format('CREATE POLICY ciq_household_all ON public.%I FOR ALL TO authenticated USING (%s) WITH CHECK (%s)', t, mine, mine);
    END IF;
  END LOOP;

  -- other people's cards/wishlist, only when their profile says public (PublicProfilePage)
  FOREACH t IN ARRAY ARRAY['collection_items', 'funko_collection'] LOOP
    EXECUTE format('CREATE POLICY ciq_public_profile_read ON public.%I FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.public_profiles p WHERE p.telegram_user_id = %I.telegram_user_id AND p.collection_public))', t, t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['wishlist_items', 'funko_wishlist'] LOOP
    EXECUTE format('CREATE POLICY ciq_public_profile_read ON public.%I FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.public_profiles p WHERE p.telegram_user_id = %I.telegram_user_id AND p.wishlist_public))', t, t);
  END LOOP;
END $$;

-- ── 3. The rest: no anonymous access, logged-in users unchanged ──────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'activity_feed', 'bug_reports', 'card_price_history', 'collection_snapshots', 'daily_missions',
    'deck_cards', 'deck_comments', 'deck_copies', 'deck_votes', 'decks', 'feature_votes',
    'marketplace_listings', 'marketplace_offers', 'price_alerts', 'public_profiles',
    'user_achievements', 'user_badges', 'user_follows', 'user_notifications', 'user_reputation',
    'user_streaks', 'user_xp', 'user_premium', 'funko_price_history'] LOOP
    IF pg_temp.ciq_reset(t) THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
      EXECUTE format('CREATE POLICY ciq_authenticated_all ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
    END IF;
  END LOOP;

  -- read-only for logged-in users (writes come from the Worker / Vercel functions with the service role)
  IF pg_temp.ciq_reset('analytics_events') THEN
    REVOKE ALL ON public.analytics_events FROM anon;
    CREATE POLICY ciq_authenticated_read ON public.analytics_events FOR SELECT TO authenticated USING (true);
  END IF;
  IF pg_temp.ciq_reset('user_scans') THEN
    REVOKE ALL ON public.user_scans FROM anon;
    CREATE POLICY ciq_own_read ON public.user_scans FOR SELECT TO authenticated USING (telegram_user_id = public.jwt_telegram_user_id());
  END IF;
  -- service role only
  IF pg_temp.ciq_reset('referrals') THEN
    REVOKE ALL ON public.referrals FROM anon, authenticated;
  END IF;
END $$;

-- ── 4. Public catalogs: read-only for everyone ───────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['catalog_items', 'tcg_registry', 'price_history', 'funko_items', 'onepiece_cards'] LOOP
    IF pg_temp.ciq_reset(t) THEN
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM anon, authenticated', t);
      EXECUTE format('CREATE POLICY ciq_public_read ON public.%I FOR SELECT TO anon, authenticated USING (true)', t);
    END IF;
  END LOOP;
END $$;

/*
Left untouched on purpose (legacy tables with unclear users): bot_logs, bot_sessions, collections, items,
users. Check whether the Telegram bot still uses them with the anon key before closing them too.
*/
