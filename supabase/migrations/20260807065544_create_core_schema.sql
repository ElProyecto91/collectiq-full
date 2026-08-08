/*
# CollectIQ core schema (foundation)

Creates the foundational tables for CollectIQ, a premium Telegram Mini App
for TCG card collectors. This migration establishes the data layer that every
future feature (catalog, scanner, trading, communities) will build on.

## 1. New Tables

### profiles
Stores the collector's identity, linked to Supabase Auth and Telegram.
- `id` (uuid, PK, references auth.users) — one row per authenticated user.
- `telegram_id` (bigint, unique, nullable) — Telegram user id when inside the Mini App.
- `username` (text, nullable) — display handle.
- `first_name` (text, nullable), `last_name` (text, nullable) — Telegram-provided names.
- `photo_url` (text, nullable) — avatar URL.
- `bio` (text, nullable) — collector bio.
- `created_at`, `updated_at` (timestamptz).

### collection_items
A card owned by a collector. Kept catalog-agnostic so future TCG expansions
(Pokemon, One Piece, Yu-Gi-Oh!, Lorcana, Magic) can plug in without schema churn.
- `id` (uuid, PK).
- `user_id` (uuid, not null, defaults to auth.uid(), references auth.users).
- `card_id` (text, not null) — reference to a future catalog entry.
- `tcg` (text, not null, default 'pokemon') — which TCG the card belongs to.
- `quantity` (int, not null, default 1).
- `condition` (text, nullable) — e.g. PSA grade / raw condition.
- `metadata` (jsonb, not null, default '{}') — extensible card details.
- `acquired_at` (date, nullable) — when the collector obtained the card.
- `created_at`, `updated_at` (timestamptz).

### wishlist_items
A card a collector wants. Mirrors collection_items structure for future trading.
- `id` (uuid, PK).
- `user_id` (uuid, not null, defaults to auth.uid(), references auth.users).
- `card_id` (text, not null).
- `tcg` (text, not null, default 'pokemon').
- `max_price` (numeric, nullable) — target price ceiling.
- `notes` (text, nullable).
- `metadata` (jsonb, not null, default '{}').
- `created_at`, `updated_at` (timestamptz).

## 2. Indexes
- `collection_items_user_id_idx` on (user_id) for per-user listing.
- `collection_items_card_id_idx` on (card_id) for catalog joins.
- `wishlist_items_user_id_idx` on (user_id).

## 3. Security (RLS)
All tables enable Row Level Security with owner-scoped CRUD policies scoped to
`authenticated`. Owner columns default to `auth.uid()` so inserts from an
authenticated session succeed even when the client omits `user_id`. Until the
Telegram authentication flow is wired, reads return empty (the app shows empty
states by design).
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_id bigint UNIQUE,
  username text,
  first_name text,
  last_name text,
  photo_url text,
  bio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS collection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id text NOT NULL,
  tcg text NOT NULL DEFAULT 'pokemon',
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  condition text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  acquired_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wishlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id text NOT NULL,
  tcg text NOT NULL DEFAULT 'pokemon',
  max_price numeric(12, 2),
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS collection_items_user_id_idx ON collection_items(user_id);
CREATE INDEX IF NOT EXISTS collection_items_card_id_idx ON collection_items(card_id);
CREATE INDEX IF NOT EXISTS wishlist_items_user_id_idx ON wishlist_items(user_id);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;

-- profiles: owner-scoped
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- collection_items: owner-scoped
DROP POLICY IF EXISTS "select_own_collection_items" ON collection_items;
CREATE POLICY "select_own_collection_items" ON collection_items FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_collection_items" ON collection_items;
CREATE POLICY "insert_own_collection_items" ON collection_items FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_collection_items" ON collection_items;
CREATE POLICY "update_own_collection_items" ON collection_items FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_collection_items" ON collection_items;
CREATE POLICY "delete_own_collection_items" ON collection_items FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- wishlist_items: owner-scoped
DROP POLICY IF EXISTS "select_own_wishlist_items" ON wishlist_items;
CREATE POLICY "select_own_wishlist_items" ON wishlist_items FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_wishlist_items" ON wishlist_items;
CREATE POLICY "insert_own_wishlist_items" ON wishlist_items FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_wishlist_items" ON wishlist_items;
CREATE POLICY "update_own_wishlist_items" ON wishlist_items FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_wishlist_items" ON wishlist_items;
CREATE POLICY "delete_own_wishlist_items" ON wishlist_items FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
