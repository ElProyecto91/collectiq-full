/*
# Lock the session tokens (the one real hole), without any JWT

NOT EXECUTED automatically. Idempotent. Safe to run now.

Today user_sessions (every user's session token!) and auth_codes are readable and writable by anyone holding the
public anon key, which ships in the app: anyone could read a token and act as that user.

This does the minimum needed to close it, and nothing else:
- public.user_directory: names/profile data WITHOUT tokens (the app already reads this view instead of user_sessions:
  public profiles, followers, admin). Created here too so the file works on its own.
- user_sessions and auth_codes: every policy dropped, RLS on, all access revoked from anon/authenticated. Only the
  service role (the Worker, the Vercel functions, the Telegram bot) can touch them.

It needs no JWT secret: the rest of the RLS closing (20261101092000) is separate and still optional.
Rollback: 20261101093000_rollback_open_rls.sql reopens both tables.
*/

CREATE OR REPLACE VIEW public.user_directory AS
SELECT telegram_user_id,
       user_data ->> 'username'   AS username,
       user_data ->> 'first_name' AS first_name,
       user_data,
       created_at
FROM public.user_sessions;

GRANT SELECT ON public.user_directory TO anon, authenticated;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies
           WHERE schemaname = 'public' AND tablename IN ('user_sessions', 'auth_codes') LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_codes    ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.user_sessions FROM anon, authenticated;
REVOKE ALL ON public.auth_codes    FROM anon, authenticated;
