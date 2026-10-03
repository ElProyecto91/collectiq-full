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
