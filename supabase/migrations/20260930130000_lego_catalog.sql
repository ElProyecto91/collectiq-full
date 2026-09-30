/*
# LEGO catalog (Phase 1)

NOT EXECUTED. Review and run by hand in the Supabase SQL Editor.

Source: Rebrickable CSV downloads (https://rebrickable.com/downloads/).
Data must be attributed to Rebrickable (shown in the UI). Column names below
follow the Rebrickable CSV headers; scripts/lego-import.mjs validates the real
headers of the files you download and aborts before inserting anything if a
required column is missing.

## Design decisions
- Catalog is public read, no client writes. Only service_role (the import
  script) writes. RLS is on with a single SELECT policy; INSERT/UPDATE/DELETE
  are also revoked from anon and authenticated.
- lego_set_parts holds ONE inventory per set: the highest `version` of that set
  in inventories.csv. Older inventory versions are dropped (documented choice).
- is_spare rows are stored but must be ignored when computing completeness.
- Part images live in lego_part_colors (one row per part+color, deduplicated
  from inventory_parts.img_url) so lego_set_parts stays small.
- Only parts used by the imported sets, plus their one-hop relationship
  partners, are stored in lego_parts. The importer takes a --from-year filter
  and prints the estimated size per table BEFORE writing anything.
- Composite primary keys start with set_num, so lookups by set_num are served by
  the primary key index; a second set_num index would only waste space.
- lego_elements.element_id is not assumed unique in the source (duplicates have
  been reported); the importer keeps the first occurrence.

## Tables
lego_themes, lego_colors, lego_parts, lego_part_colors, lego_sets,
lego_set_parts, lego_elements, lego_part_relationships
View: lego_set_parts_full (set parts joined with part, color and image)
*/

CREATE TABLE IF NOT EXISTS public.lego_themes (
  id integer PRIMARY KEY,
  name text NOT NULL,
  parent_id integer
);

CREATE TABLE IF NOT EXISTS public.lego_colors (
  id integer PRIMARY KEY,           -- Rebrickable uses -1 for "Unknown"
  name text NOT NULL,
  rgb text,
  is_trans boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.lego_parts (
  part_num text PRIMARY KEY,
  name text NOT NULL,
  part_cat_id integer,
  part_material text
);

CREATE TABLE IF NOT EXISTS public.lego_part_colors (
  part_num text NOT NULL REFERENCES public.lego_parts(part_num) ON DELETE CASCADE,
  color_id integer NOT NULL REFERENCES public.lego_colors(id),
  img_url text,
  PRIMARY KEY (part_num, color_id)
);

CREATE TABLE IF NOT EXISTS public.lego_sets (
  set_num text PRIMARY KEY,
  name text NOT NULL,
  year integer,
  theme_id integer REFERENCES public.lego_themes(id),
  num_parts integer,
  img_url text,
  inventory_version integer
);

CREATE TABLE IF NOT EXISTS public.lego_set_parts (
  set_num text NOT NULL REFERENCES public.lego_sets(set_num) ON DELETE CASCADE,
  part_num text NOT NULL,
  color_id integer NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  is_spare boolean NOT NULL DEFAULT false,
  PRIMARY KEY (set_num, part_num, color_id, is_spare),
  CONSTRAINT lego_set_parts_part_fk
    FOREIGN KEY (part_num) REFERENCES public.lego_parts(part_num),
  CONSTRAINT lego_set_parts_color_fk
    FOREIGN KEY (color_id) REFERENCES public.lego_colors(id),
  CONSTRAINT lego_set_parts_part_color_fk
    FOREIGN KEY (part_num, color_id) REFERENCES public.lego_part_colors(part_num, color_id)
);

CREATE TABLE IF NOT EXISTS public.lego_elements (
  element_id text PRIMARY KEY,
  part_num text NOT NULL,
  color_id integer NOT NULL,
  design_id text,
  CONSTRAINT lego_elements_part_color_fk
    FOREIGN KEY (part_num, color_id) REFERENCES public.lego_part_colors(part_num, color_id)
);

-- rel_type is stored as Rebrickable gives it (single letter); no meaning is
-- interpreted here. Phase 3 must check the official meaning before using it.
CREATE TABLE IF NOT EXISTS public.lego_part_relationships (
  rel_type text NOT NULL,
  child_part_num text NOT NULL REFERENCES public.lego_parts(part_num) ON DELETE CASCADE,
  parent_part_num text NOT NULL REFERENCES public.lego_parts(part_num) ON DELETE CASCADE,
  PRIMARY KEY (rel_type, child_part_num, parent_part_num)
);

-- Indexes
CREATE INDEX IF NOT EXISTS lego_set_parts_part_color_idx
  ON public.lego_set_parts (part_num, color_id);
CREATE INDEX IF NOT EXISTS lego_elements_part_color_idx
  ON public.lego_elements (part_num, color_id);
CREATE INDEX IF NOT EXISTS lego_sets_year_idx ON public.lego_sets (year);
CREATE INDEX IF NOT EXISTS lego_sets_theme_idx ON public.lego_sets (theme_id);
CREATE INDEX IF NOT EXISTS lego_themes_parent_idx ON public.lego_themes (parent_id);
CREATE INDEX IF NOT EXISTS lego_part_relationships_child_idx
  ON public.lego_part_relationships (child_part_num);
CREATE INDEX IF NOT EXISTS lego_part_relationships_parent_idx
  ON public.lego_part_relationships (parent_part_num);

-- Flat read model used by the set detail page. A view avoids relying on
-- PostgREST embedding hints for a 3-way join. security_invoker makes the caller's
-- RLS apply to the underlying tables.
CREATE OR REPLACE VIEW public.lego_set_parts_full
WITH (security_invoker = true) AS
SELECT
  sp.set_num,
  sp.part_num,
  sp.color_id,
  sp.quantity,
  sp.is_spare,
  p.name    AS part_name,
  c.name    AS color_name,
  c.rgb     AS color_rgb,
  c.is_trans AS color_is_trans,
  pc.img_url
FROM public.lego_set_parts sp
JOIN public.lego_parts p        ON p.part_num = sp.part_num
JOIN public.lego_colors c       ON c.id = sp.color_id
JOIN public.lego_part_colors pc ON pc.part_num = sp.part_num AND pc.color_id = sp.color_id;

-- RLS: public read, no client writes (service_role bypasses RLS)
ALTER TABLE public.lego_themes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lego_colors             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lego_parts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lego_part_colors        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lego_sets               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lego_set_parts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lego_elements           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lego_part_relationships ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'lego_themes','lego_colors','lego_parts','lego_part_colors',
    'lego_sets','lego_set_parts','lego_elements','lego_part_relationships'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_public_read', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)',
      t || '_public_read', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

REVOKE ALL ON public.lego_set_parts_full FROM anon, authenticated;
GRANT SELECT ON public.lego_set_parts_full TO anon, authenticated;
