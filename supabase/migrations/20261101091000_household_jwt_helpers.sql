/*
# Households, step 2: helpers for the database token + shared LEGO reservations

NOT EXECUTED. Review and run by hand in the Supabase SQL Editor, after 20261101090000_households.sql.
Safe to run at any time: it only ADDS a function and a view, and replaces assign_lego_set_parts with a
version that behaves exactly the same for people who are alone.

- jwt_telegram_user_id(): the telegram_user_id inside the JWT minted by the Worker (route /auth-token),
  or NULL for anon. The Worker's  /auth-token?check=1  calls it to prove the JWT secret is right.
- household_user_ids(): only logged-in users (and the service role) may call it.
- user_directory: names/profile data of users WITHOUT the session tokens that sit in user_sessions.
  The app reads this instead of user_sessions, so user_sessions can be locked (20261101092000).
- assign_lego_set_parts(): reservations now work across the whole household (a member can reserve parts
  for a set copy another member added; free stock = everyone's parts minus everyone's reservations).
*/

CREATE OR REPLACE FUNCTION public.jwt_telegram_user_id()
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(auth.jwt() ->> 'telegram_user_id', '')::bigint;
$$;

REVOKE ALL ON FUNCTION public.household_user_ids(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.household_user_ids(bigint) TO authenticated, service_role;

CREATE OR REPLACE VIEW public.user_directory AS
SELECT telegram_user_id,
       user_data ->> 'username'   AS username,
       user_data ->> 'first_name' AS first_name,
       user_data,
       created_at
FROM public.user_sessions;

GRANT SELECT ON public.user_directory TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.assign_lego_set_parts(
  p_telegram_user_id bigint, p_user_set_id uuid, p_items jsonb)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  ids bigint[];
  owner_id bigint;
  r record;
  free_qty integer;
  take integer;
  n integer := 0;
BEGIN
  SELECT array_agg(x) INTO ids FROM public.household_user_ids(p_telegram_user_id) AS x;

  SELECT telegram_user_id INTO owner_id FROM public.user_lego_sets
   WHERE id = p_user_set_id AND telegram_user_id = ANY (ids);
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'set copy not found';
  END IF;

  -- serialize assignments of one household: free quantities are computed from the other copies
  PERFORM pg_advisory_xact_lock((SELECT min(x) FROM unnest(ids) AS x));

  DELETE FROM public.user_lego_set_allocations WHERE user_set_id = p_user_set_id;

  FOR r IN
    SELECT x.part_num, x.color_id, SUM(x.quantity)::integer AS quantity
    FROM jsonb_to_recordset(p_items) AS x(part_num text, color_id integer, quantity integer)
    WHERE x.part_num IS NOT NULL AND x.color_id IS NOT NULL AND x.quantity > 0
    GROUP BY x.part_num, x.color_id
  LOOP
    SELECT COALESCE((SELECT SUM(u.quantity) FROM public.user_lego_parts u
                      WHERE u.telegram_user_id = ANY (ids)
                        AND u.part_num = r.part_num AND u.color_id = r.color_id), 0)
         - COALESCE((SELECT SUM(a.quantity) FROM public.user_lego_set_allocations a
                      WHERE a.telegram_user_id = ANY (ids)
                        AND a.part_num = r.part_num AND a.color_id = r.color_id), 0)
      INTO free_qty;
    take := LEAST(r.quantity, free_qty);
    IF take > 0 THEN
      INSERT INTO public.user_lego_set_allocations (telegram_user_id, user_set_id, part_num, color_id, quantity)
      VALUES (owner_id, p_user_set_id, r.part_num, r.color_id, take);
      n := n + 1;
    END IF;
  END LOOP;
  RETURN n;
END;
$$;
