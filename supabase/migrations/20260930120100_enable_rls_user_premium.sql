/*
# Enable RLS on user_premium

NOT EXECUTED. Do not run before reading the "Breaks" section.

## Why
user_premium has RLS disabled, so anyone with the anon key can write to it:
  supabase.from('user_premium').upsert({ telegram_user_id: <me>, plan: 'go',
    expires_at: <far future> })
grants GO for free. The table already has the policy "Frontend solo lectura"
(SELECT true), so the intended design was read-only for the client. Only the
ENABLE was missing.

## Breaks (verified in the repo)
- src/pages/AdminPage.tsx:285, revokeGO(): the admin "revoke GO" button updates
  user_premium from the browser. After this migration that update is blocked and
  the button silently does nothing. It needs a Worker route (like
  admin-give-go) before this migration is run.
- src/hooks/use-premium.ts:58, upgradeToGO(): same problem, but the function is
  exported and never called, so nothing breaks.

Everything else (reads for plan / expires_at across Home, Profile, Scanner,
Decks, Stats, Community) keeps working through the SELECT policy. Worker and
api/* writes use service_role and are unaffected.

## Not solved here
Reads stay public: anyone can query the plan of any telegram_user_id. Restricting
that also requires moving the reads to the Worker.
*/

ALTER TABLE public.user_premium ENABLE ROW LEVEL SECURITY;
