# LEGO catalog on Turso

Free plan (checked against Turso's pricing page): 5 GB storage, 500 M rows read and
10 M rows written per month. If any limit is exceeded the database is blocked until
the next month, so `scripts/lego-import.mjs` estimates storage and row writes first and
refuses to import over budget.

## Setup (once, on your machine)
1. Create a Turso account and a database (`turso db create lego-catalog`).
2. URL: `turso db show lego-catalog --url`
3. Write token (importer only, never in a VITE_ variable): `turso db tokens create lego-catalog`
4. Read-only token (goes into the app): `turso db tokens create lego-catalog --read-only`
5. In Vercel (and `.env.local` for local dev) set `VITE_TURSO_DATABASE_URL` and
   `VITE_TURSO_READ_TOKEN`.

## Import
Download the CSV files from https://rebrickable.com/downloads/ into `./lego-data/`
(do not commit them), then:

    node scripts/lego-import.mjs --dir ./lego-data --from-year 1949                 # estimate only
    TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... \
      node scripts/lego-import.mjs --dir ./lego-data --from-year 1949 --apply

Use `--no-spares` and `--skip-elements` to cut size and row writes. Every re-run spends
row writes again.

## Import from GitHub Actions (no tokens in Claude, works from a phone)
The workflow `.github/workflows/lego-import.yml` downloads the CSV files on GitHub's
runners and runs the importer. It is manual only (Rebrickable allows one automated
download per day).

1. Repo -> Settings -> Secrets and variables -> Actions -> add `TURSO_DATABASE_URL` and
   `TURSO_AUTH_TOKEN` (the WRITE token). Never add the read-only token here.
2. The workflow must exist on the default branch (`main`) to appear in the Actions tab.
3. Actions -> "LEGO catalog import" -> Run workflow. First run with `apply` OFF: it prints the
   size and row-write estimate (also in the run summary). If it fits the free plan, run again
   with `apply` ON.
4. If an import was interrupted, run it again with `apply` ON and `insert_only` ON: rows that
   already exist are left alone, so only the missing ones spend row writes.
5. Afterwards revoke the write token in the Turso dashboard.

The importer sends multi-row statements (about 4,000 parameters each). The first version sent one
statement per row, which was too slow for the full catalog and hit the 60-minute limit; the job
limit is now 120 minutes as a safety net.

## Phase 3 derived tables (possible sets ranking)
`lego_part_canon`, `lego_part_rarity` and `lego_set_stats` are computed by the importer from the data
it imports. After deploying phase 3, run the workflow once with `apply` ON and `insert_only` ON: the
existing rows are left alone and only the three new tables are written (about 0.2 M row writes).
Until then "Possible sets" and "My progress" show a message asking for that import.

Interchangeable molds are Rebrickable rel_type `M` only. `A` ("similar, not necessarily compatible")
and `B` (meaning not confirmed) are NOT used.

## Part scanner (phase 5)
The Worker route `lego-scan` forwards the photo to Brickognize. It needs no secret of its own (it uses
the app session token and the existing Supabase service key). Optional Cloudflare variable
`LEGO_SCAN_DAILY_LIMIT` (default 300 scans per user per day, a safety cap, not a paywall).
Brickognize's website terms allow personal, non-commercial use; its API terms were not verified.

## Coverage and images
The estimate (workflow run with `apply` OFF) now prints a "Coverage" block: sets with an inventory, with
parts and with an image URL; parts imported vs in parts.csv; part+color pairs without an image URL. It also
samples 200 set images and 200 part images (8 requests at a time) and reports how many answer.

By default EVERY part in parts.csv is imported (before, only parts used by some set). To get the missing parts
into an existing catalog run the import with `apply` ON and `insert_only` ON: only the new parts are written.
`--used-parts-only` restores the old behavior (local runs only).

Images are links to Rebrickable's CDN, not copies. Rebrickable only publishes an image per part+color that
appears in a set inventory, so a part+color that no set uses has no image to show, and a share of the published
URLs return 404 (the app shows a grey placeholder).

## Keeping the catalog up to date (new sets)

`node scripts/lego-import.mjs --dir ./lego-data --from-year 1949 --new-only --apply` reads the keys Turso
already has and writes only what is new: new sets with their parts and stats, plus any new theme, color,
part, element, relationship or rarity row. It never rewrites existing rows, so a weekly run costs a few
hundred row writes (the free plan allows 10M/month; a full import is ~3.3M). New sets are also recorded
in `lego_import_log` (set number + date) so the app can show what is new.

What it does not do: existing sets keep their old name / quantities / image URL, and the rarity weights of
old parts are not recalculated. Run a full import (`lego-import` workflow, apply on) every few months to
refresh those.

Without `--apply` it only prints what it would add (it still needs `TURSO_DATABASE_URL` and a token to
read the existing keys).

## Part pictures (Rebrickable API)

The CSV files only have a picture for a part+color pair that appears in a set inventory, so ~44% of the
parts have none. `scripts/lego-part-images.mjs` asks the Rebrickable API for one picture per part and
stores it in `lego_part_images`, only for parts without any picture. The app uses it as a fallback when
a part+color has no picture of its own (and keeps working if the table does not exist yet).

    REBRICKABLE_API_KEY=<free key> TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=<write token> \
    node scripts/lego-part-images.mjs            # report only
    node scripts/lego-part-images.mjs --apply    # store the pictures

About 65 requests for the whole catalog, one at a time with pauses; it waits on HTTP 429 and stops if the
key is refused. It reports how many parts stay without a picture (the API does not have one for every part).

The same script fills `lego_part_ext` (BrickLink number -> Rebrickable part). The scanner's recognizer answers
with BrickLink numbers and many differ from Rebrickable's (BrickLink 98613 = Rebrickable 74261), so the
scanner looks the number up there before falling back to a search by name. Until the script has run with
`--apply`, such parts show "not in the catalog" and are searched by hand.
