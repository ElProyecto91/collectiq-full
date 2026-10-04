-- LEGO catalog schema for Turso (SQLite / libSQL).
--
-- Applied automatically by scripts/lego-import.mjs --apply (every statement is
-- IF NOT EXISTS, so it is safe to re-run). It can also be run by hand:
--   turso db shell <db-name> < turso/lego-schema.sql
--
-- Source: Rebrickable CSV downloads (https://rebrickable.com/downloads/).
-- Data must be attributed to Rebrickable (shown in the UI).
--
-- Design
--  * Read-only for the app: the browser uses a READ-ONLY token. Writes come only
--    from the import script with the write token, on your machine.
--  * One inventory per set: the highest `version` in inventories.csv.
--  * is_spare rows are stored (0/1) but must be ignored for completeness.
--  * Part images live in lego_part_colors (one row per part+color).
--  * Composite-key tables are WITHOUT ROWID so the primary key is the table
--    itself (no duplicated key index). Lookups by set_num are served by the
--    lego_set_parts primary key.
--  * Foreign keys are declared for documentation; the importer inserts in
--    dependency order, so it works whether or not enforcement is on.

CREATE TABLE IF NOT EXISTS lego_themes (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  parent_id  INTEGER
);

CREATE TABLE IF NOT EXISTS lego_colors (
  id        INTEGER PRIMARY KEY,          -- Rebrickable uses -1 for "Unknown"
  name      TEXT NOT NULL,
  rgb       TEXT,
  is_trans  INTEGER NOT NULL DEFAULT 0 CHECK (is_trans IN (0, 1))
);

CREATE TABLE IF NOT EXISTS lego_parts (
  part_num       TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  part_cat_id    INTEGER,
  part_material  TEXT
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS lego_part_colors (
  part_num  TEXT NOT NULL REFERENCES lego_parts(part_num),
  color_id  INTEGER NOT NULL REFERENCES lego_colors(id),
  img_url   TEXT,
  PRIMARY KEY (part_num, color_id)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS lego_sets (
  set_num            TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  year               INTEGER,
  theme_id           INTEGER REFERENCES lego_themes(id),
  num_parts          INTEGER,
  img_url            TEXT,
  inventory_version  INTEGER
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS lego_set_parts (
  set_num   TEXT NOT NULL REFERENCES lego_sets(set_num),
  part_num  TEXT NOT NULL,
  color_id  INTEGER NOT NULL,
  quantity  INTEGER NOT NULL CHECK (quantity > 0),
  is_spare  INTEGER NOT NULL DEFAULT 0 CHECK (is_spare IN (0, 1)),
  PRIMARY KEY (set_num, part_num, color_id, is_spare),
  FOREIGN KEY (part_num, color_id) REFERENCES lego_part_colors(part_num, color_id)
) WITHOUT ROWID;

-- element_id is not assumed unique in the source (duplicates have been
-- reported); the importer keeps the first occurrence.
CREATE TABLE IF NOT EXISTS lego_elements (
  element_id  TEXT PRIMARY KEY,
  part_num    TEXT NOT NULL,
  color_id    INTEGER NOT NULL,
  design_id   TEXT,
  FOREIGN KEY (part_num, color_id) REFERENCES lego_part_colors(part_num, color_id)
) WITHOUT ROWID;

-- rel_type is stored as Rebrickable gives it (single letter); no meaning is
-- interpreted here. Phase 3 must check the official meaning before using it.
CREATE TABLE IF NOT EXISTS lego_part_relationships (
  rel_type         TEXT NOT NULL,
  child_part_num   TEXT NOT NULL REFERENCES lego_parts(part_num),
  parent_part_num  TEXT NOT NULL REFERENCES lego_parts(part_num),
  PRIMARY KEY (rel_type, child_part_num, parent_part_num)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS lego_set_parts_part_color_idx ON lego_set_parts (part_num, color_id);
CREATE INDEX IF NOT EXISTS lego_elements_part_color_idx  ON lego_elements (part_num, color_id);
CREATE INDEX IF NOT EXISTS lego_sets_year_idx            ON lego_sets (year);
CREATE INDEX IF NOT EXISTS lego_sets_theme_idx           ON lego_sets (theme_id);
CREATE INDEX IF NOT EXISTS lego_themes_parent_idx        ON lego_themes (parent_id);
CREATE INDEX IF NOT EXISTS lego_part_relationships_child_idx  ON lego_part_relationships (child_part_num);
CREATE INDEX IF NOT EXISTS lego_part_relationships_parent_idx ON lego_part_relationships (parent_part_num);

-- ── Phase 3: derived tables used by the "possible sets" ranking ────────────────
-- Computed by scripts/lego-import.mjs from the data it imports (no extra download).
--
-- lego_part_canon: parts that are interchangeable molds (Rebrickable rel_type 'M', the
-- "alternate mold, functional drop-in replacement") share one canonical part number
-- (the smallest in the connected group). Parts that are their own canon are not stored.
CREATE TABLE IF NOT EXISTS lego_part_canon (
  part_num        TEXT PRIMARY KEY,
  canon_part_num  TEXT NOT NULL
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS lego_part_canon_canon_idx ON lego_part_canon (canon_part_num);

-- lego_part_rarity: how many imported sets contain this canonical part in this color, and
-- the weight derived from it: ln(1 + total_sets / sets_count). Rare parts weigh more.
CREATE TABLE IF NOT EXISTS lego_part_rarity (
  part_num    TEXT NOT NULL,
  color_id    INTEGER NOT NULL,
  sets_count  INTEGER NOT NULL,
  weight      REAL NOT NULL,
  PRIMARY KEY (part_num, color_id)
) WITHOUT ROWID;

-- lego_set_stats: totals per set, spare parts excluded.
CREATE TABLE IF NOT EXISTS lego_set_stats (
  set_num        TEXT PRIMARY KEY,
  total_qty      INTEGER NOT NULL,
  distinct_parts INTEGER NOT NULL,
  weight_total   REAL NOT NULL
) WITHOUT ROWID;
