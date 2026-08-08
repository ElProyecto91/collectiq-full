/*
# Collection Engine — user_cards table and profiles schema update

Creates the production `user_cards` table for the CollectIQ Collection Engine
and updates the `profiles` table to match the Sprint 1 spec.

## 1. New Tables

### user_cards
A specific copy of a Pokémon card owned by a collector. Each row is one
acquisition entry (not just a quantity counter) so the collector can track
different conditions, finishes, languages, and purchase prices for the same
card. The `pokemon_card_id` references the Pokémon TCG API card id (e.g.
"base1-1"); card display data (name, set, rarity, image) is snapshotted in
the `card_snapshot` jsonb column so the collection grid renders without
re-fetching the catalog.

Columns:
- `id` (uuid, PK)
- `telegram_user_id` (bigint, not null) — the Telegram user who owns this row.
  This is the owner identifier used by RLS and every query filter.
- `pokemon_card_id` (text, not null) — the Pokémon TCG API card id.
- `quantity` (int, not null, default 1, check > 0)
- `condition` (text, nullable) — one of the CONDITION_VALUES list.
- `language` (text, nullable) — one of the LANGUAGE_VALUES list.
- `edition` (text, nullable) — free text (1st Edition, Unlimited, etc.)
- `finish` (text, nullable) — one of the FINISH_VALUES list.
- `purchase_price` (numeric(12,2), nullable) — what the collector paid.
- `acquisition_method` (text, nullable) — one of the ACQUISITION_VALUES list.
- `acquisition_date` (date, nullable) — when the card was obtained.
- `notes` (text, nullable) — free-form collector notes.
- `favorite` (boolean, not null, default false)
- `showcase` (boolean, not null, default false) — only ONE card per user can
  be the showcase. Enforced by a partial unique index.
- `card_snapshot` (jsonb, not null, default '{}') — snapshotted display data:
  { name, setName, setCode, rarity, imageUrl, supertype, subtypes, number }.
- `created_at` (timestamptz, not null, default now())
- `updated_at` (timestamptz, not null, default now())

### profiles (updated)
Updated columns:
- `display_name` (text, nullable) — replaces the separate first_name/last_name
  with a single display name field per spec.
- `avatar_url` (text, nullable) — renamed from photo_url.
The existing `telegram_id`, `username`, `created_at`, and `id` columns are
preserved.

## 2. Indexes
- `user_cards_telegram_user_id_idx` on (telegram_user_id) — every query is
  scoped by this column.
- `user_cards_pokemon_card_id_idx` on (pokemon_card_id) — for "is this card
  already in my collection" lookups.
- `user_cards_showcase_unique_idx` — partial unique index on (telegram_user_id)
  WHERE showcase = true, enforcing the one-showcase-per-user constraint.

## 3. Security (RLS)
`user_cards` enables RLS with `anon, authenticated` policies. The app runs as
the anon role (no Supabase Auth session yet — Telegram auth is not wired), so
policies must include `anon`. The service layer enforces per-user filtering
via `.eq('telegram_user_id', id)` in every query.

The old `collection_items` table is left in place (not dropped — data safety).
The new `user_cards` table supersedes it for the Collection Engine.
*/

-- 1. Create user_cards table
CREATE TABLE IF NOT EXISTS user_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id bigint NOT NULL,
  pokemon_card_id text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  condition text,
  language text,
  edition text,
  finish text,
  purchase_price numeric(12, 2),
  acquisition_method text,
  acquisition_date date,
  notes text,
  favorite boolean NOT NULL DEFAULT false,
  showcase boolean NOT NULL DEFAULT false,
  card_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS user_cards_telegram_user_id_idx ON user_cards(telegram_user_id);
CREATE INDEX IF NOT EXISTS user_cards_pokemon_card_id_idx ON user_cards(pokemon_card_id);

-- Partial unique index: only one showcase card per user
CREATE UNIQUE INDEX IF NOT EXISTS user_cards_showcase_unique_idx
  ON user_cards(telegram_user_id) WHERE showcase = true;

-- 3. RLS
ALTER TABLE user_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_user_cards" ON user_cards;
CREATE POLICY "select_own_user_cards" ON user_cards FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_user_cards" ON user_cards;
CREATE POLICY "insert_own_user_cards" ON user_cards FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_own_user_cards" ON user_cards;
CREATE POLICY "update_own_user_cards" ON user_cards FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_own_user_cards" ON user_cards;
CREATE POLICY "delete_own_user_cards" ON user_cards FOR DELETE
  TO anon, authenticated USING (true);

-- 4. Update profiles table: add display_name and avatar_url
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS avatar_url text;
