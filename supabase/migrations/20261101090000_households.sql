/*
# Households: several people sharing one CollectIQ collection

NOT EXECUTED. Review and run by hand in the Supabase SQL Editor.
Safe to run at any time: it only ADDS tables and a function, nothing existing changes.

## Model
- A household groups the Telegram users that share one collection. Every row keeps its own
  telegram_user_id (who added it); "shared" means every member can see and edit the rows of
  every other member (phase 3 policies use household_user_ids()).
- A user belongs to at most ONE household (UNIQUE on household_members.telegram_user_id).
- Invitations are single-use codes with an expiry, created from the app.

## Security
RLS is enabled with NO policy for anon/authenticated: these tables are only reachable through
the Worker (service role). The browser can never read invitation codes or member lists directly.
*/

CREATE TABLE IF NOT EXISTS public.households (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL DEFAULT 'Mi CollectIQ',
  created_by  bigint NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.household_members (
  household_id     uuid   NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  telegram_user_id bigint NOT NULL UNIQUE,
  role             text   NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  display_name     text,
  joined_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, telegram_user_id)
);

CREATE TABLE IF NOT EXISTS public.household_invites (
  code         text PRIMARY KEY,
  household_id uuid   NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  created_by   bigint NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  used_by      bigint,
  used_at      timestamptz
);

CREATE INDEX IF NOT EXISTS household_invites_household_idx ON public.household_invites (household_id);

ALTER TABLE public.households        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_invites ENABLE ROW LEVEL SECURITY;

/*
Every user id that shares a collection with p_user (always includes p_user itself, also when
the user has no household). Used by the phase 3 RLS policies.
*/
CREATE OR REPLACE FUNCTION public.household_user_ids(p_user bigint)
RETURNS SETOF bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_user
  UNION
  SELECT m2.telegram_user_id
  FROM public.household_members m1
  JOIN public.household_members m2 ON m2.household_id = m1.household_id
  WHERE m1.telegram_user_id = p_user;
$$;
