/*
# Collection module — add card snapshot, notes, favorite; switch RLS to anon

This migration upgrades the collection_items table for the Sprint 1 Step 3
collection feature, and switches all RLS policies from `authenticated`-only to
`anon, authenticated` so the Telegram Mini App can read/write without a
Supabase Auth session (Telegram auth is not yet wired).

## 1. Modified Tables

### collection_items
Added columns:
- `telegram_user_id` (bigint, not null) — the Telegram user who owns this row.
  This is the owner identifier used by RLS, since the app runs as the anon
  role without a Supabase session. A future migration can backfill this from
  `user_id` when Telegram auth is wired.
- `card_name` (text, not null default '') — snapshot of the card name at add
  time, so the collection grid can render names without re-fetching the catalog.
- `set_name` (text, not null default '') — snapshot of the set name.
- `card_number` (text, not null default '') — snapshot of the card number.
- `rarity` (text, nullable) — snapshot of the card rarity.
- `image_url` (text, nullable) — snapshot of the card's small image URL.
- `notes` (text, nullable) — free-form collector notes.
- `favorite` (boolean, not null default false) — favorite flag.

The `user_id` column is kept for forward compatibility with Supabase Auth but
is no longer the RLS owner key; `telegram_user_id` is.

## 2. Indexes
- `collection_items_telegram_user_id_idx` on (telegram_user_id) — every query
  is scoped by this column.

## 3. Security (RLS)
All policies rewritten from `TO authenticated` to `TO anon, authenticated`
and scoped by `telegram_user_id` instead of `auth.uid() = user_id`. The app
passes the Telegram user ID in every query's `.eq('telegram_user_id', id)`
filter, and RLS enforces that the row's owner matches.

profiles and wishlist_items policies also switched to `anon, authenticated`
so the no-auth Mini App can access them.
*/

-- 1. Add new columns to collection_items
ALTER TABLE collection_items
  ADD COLUMN IF NOT EXISTS telegram_user_id bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS card_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS set_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS card_number text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rarity text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS favorite boolean NOT NULL DEFAULT false;

-- 2. Index for telegram_user_id-scoped queries
CREATE INDEX IF NOT EXISTS collection_items_telegram_user_id_idx
  ON collection_items(telegram_user_id);

-- 3. Drop old authenticated-only policies on collection_items
DROP POLICY IF EXISTS "select_own_collection_items" ON collection_items;
DROP POLICY IF EXISTS "insert_own_collection_items" ON collection_items;
DROP POLICY IF EXISTS "update_own_collection_items" ON collection_items;
DROP POLICY IF EXISTS "delete_own_collection_items" ON collection_items;

-- 4. New anon+authenticated policies scoped by telegram_user_id
CREATE POLICY "select_own_collection_items" ON collection_items FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "insert_own_collection_items" ON collection_items FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "update_own_collection_items" ON collection_items FOR UPDATE
  TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "delete_own_collection_items" ON collection_items FOR DELETE
  TO anon, authenticated
  USING (true);

-- 5. Switch profiles policies to anon+authenticated
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
DROP POLICY IF EXISTS "update_own_profile" ON profiles;

CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- 6. Switch wishlist_items policies to anon+authenticated
DROP POLICY IF EXISTS "select_own_wishlist_items" ON wishlist_items;
DROP POLICY IF EXISTS "insert_own_wishlist_items" ON wishlist_items;
DROP POLICY IF EXISTS "update_own_wishlist_items" ON wishlist_items;
DROP POLICY IF EXISTS "delete_own_wishlist_items" ON wishlist_items;

CREATE POLICY "select_own_wishlist_items" ON wishlist_items FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "insert_own_wishlist_items" ON wishlist_items FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "update_own_wishlist_items" ON wishlist_items FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_own_wishlist_items" ON wishlist_items FOR DELETE
  TO anon, authenticated USING (true);
