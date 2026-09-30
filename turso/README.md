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
