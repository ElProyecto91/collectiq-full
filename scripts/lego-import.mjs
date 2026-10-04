#!/usr/bin/env node
/**
 * LEGO catalog importer (Rebrickable CSV -> Turso / libSQL).
 *
 * Data source: https://rebrickable.com/downloads/ (attribute Rebrickable in the
 * UI; automated downloads at most once a day). Download the files yourself and
 * put them in one folder (.csv or .csv.gz):
 *   themes colors parts part_relationships elements sets inventories inventory_parts
 *
 * Usage
 *   1) Estimate only (default, writes nothing, needs no credentials):
 *        node scripts/lego-import.mjs --dir ./lego-data --from-year 1949
 *   2) Import (creates the schema if missing, then upserts):
 *        TURSO_DATABASE_URL=libsql://<db>-<org>.turso.io TURSO_AUTH_TOKEN=<write token> \
 *        node scripts/lego-import.mjs --dir ./lego-data --from-year 1949 --apply
 *      A local SQLite file also works for testing: TURSO_DATABASE_URL=file:./lego.db
 *
 * Options
 *   --from-year N    required. Only sets with year >= N (1949 = every set).
 *   --to-year N      optional upper bound.
 *   --no-spares      do not import spare parts (smaller; spares are never used for
 *                    completeness anyway).
 *   --skip-elements  do not import elements.csv (element_id lookup, only needed for
 *                    the phase 4 shop view; can be imported later).
 *   --budget-mb N    storage budget to compare with (default 4000; Turso free = 5 GB).
 *   --writes-budget N  row-writes budget (default 8000000; Turso free = 10M/month,
 *                    and the database is BLOCKED for the rest of the month when it
 *                    is exceeded). Row writes are counted conservatively as
 *                    rows x (1 + secondary indexes).
 *   --used-parts-only  import only the parts that appear in the imported sets (plus their mold
 *                    partners). Default: EVERY part in parts.csv, so any part can be searched and
 *                    added to the inventory even if no set uses it.
 *   --check-images N sample N image URLs of sets and N of parts (default 200 each, estimate mode
 *                    only, 0 = off) and report how many answer. Light and polite: 8 at a time.
 *   --apply          actually write. Refuses to run when either estimate exceeds
 *                    its budget.
 *   --force          allow --apply above a budget. Do not use on the free plan.
 *   --insert-only    resume mode: rows that already exist are left alone (ON CONFLICT DO
 *                    NOTHING) instead of being rewritten, so an interrupted import can be
 *                    finished without spending row writes on what is already there.
 *
 * Derived tables (phase 3)
 *   lego_part_canon, lego_part_rarity and lego_set_stats are computed here from the data being
 *   imported (spare parts excluded). Interchangeable molds are Rebrickable rel_type 'M' only:
 *   'A' (alternate) is "similar, not necessarily compatible" and the meaning of 'B' could not
 *   be confirmed, so neither is used. Weights use the imported sets, so a --from-year import
 *   gives weights relative to that subset.
 *
 * Rules
 *   - Credentials only from environment variables. Never commit them.
 *   - The write token must never reach the browser: the app only gets a
 *     read-only token (VITE_TURSO_READ_TOKEN).
 *   - One inventory per set: the highest `version` in inventories.csv.
 *   - Required CSV headers are validated first; on any mismatch the script
 *     aborts before writing anything.
 *   - Re-import is an upsert, but every re-run spends row writes again. Stale
 *     rows of a set whose inventory shrank are not removed; drop the lego_*
 *     tables first if you want a clean re-import.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// ── args ────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = args[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};
const dir = opt('dir', './lego-data');
const fromYear = Number(opt('from-year', NaN));
const toYear = opt('to-year', null) === null ? null : Number(opt('to-year'));
const noSpares = args.includes('--no-spares');
const skipElements = args.includes('--skip-elements');
const force = args.includes('--force');
const insertOnly = args.includes('--insert-only');
const usedPartsOnly = args.includes('--used-parts-only');
const checkImages = Number(opt('check-images', 200)) || 0;
const apply = args.includes('--apply');
const budgetMb = Number(opt('budget-mb', 4000));
const writesBudget = Number(opt('writes-budget', 8_000_000));

if (!Number.isInteger(fromYear)) fail('--from-year is required (e.g. --from-year 2015)');

function fail(msg) {
  console.error(`\nERROR: ${msg}`);
  process.exit(1);
}

// ── required headers (validated against the real files) ─────────
const SCHEMA = {
  themes: { req: ['id', 'name', 'parent_id'], opt: [] },
  colors: { req: ['id', 'name', 'rgb', 'is_trans'], opt: [] },
  parts: { req: ['part_num', 'name', 'part_cat_id'], opt: ['part_material'] },
  part_relationships: { req: ['rel_type', 'child_part_num', 'parent_part_num'], opt: [] },
  elements: { req: ['element_id', 'part_num', 'color_id'], opt: ['design_id'] },
  sets: { req: ['set_num', 'name', 'year', 'theme_id', 'num_parts'], opt: ['img_url'] },
  inventories: { req: ['id', 'version', 'set_num'], opt: [] },
  inventory_parts: {
    req: ['inventory_id', 'part_num', 'color_id', 'quantity', 'is_spare'],
    opt: ['img_url'],
  },
};

function findFile(name) {
  for (const ext of ['.csv', '.csv.gz']) {
    const p = path.join(dir, name + ext);
    if (fs.existsSync(p)) return p;
  }
  fail(`Missing ${name}.csv (or .csv.gz) in ${path.resolve(dir)}`);
}

// ── streaming CSV reader (quotes, escaped quotes, embedded newlines) ──
async function* readCsv(name) {
  const file = findFile(name);
  let stream = fs.createReadStream(file);
  if (file.endsWith('.gz')) stream = stream.pipe(zlib.createGunzip());
  stream.setEncoding('utf8');

  let header = null;
  let row = [];
  let field = '';
  let inQ = false;
  let closed = false;

  const finishRow = function* () {
    row.push(field);
    field = '';
    closed = false;
    const r = row;
    row = [];
    if (r.length === 1 && r[0] === '') return; // blank line
    if (!header) {
      header = r.map((h) => h.replace(/^﻿/, '').trim());
      const { req } = SCHEMA[name];
      const missing = req.filter((c) => !header.includes(c));
      if (missing.length) {
        fail(
          `${name}: required column(s) missing: ${missing.join(', ')}.\n` +
            `  Found header: ${header.join(', ')}\n` +
            `  Nothing was written. Check the schema on https://rebrickable.com/downloads/`
        );
      }
      return;
    }
    const o = {};
    for (let i = 0; i < header.length; i++) o[header[i]] = r[i] ?? '';
    yield o;
  };

  for await (const chunk of stream) {
    for (let i = 0; i < chunk.length; i++) {
      const c = chunk[i];
      if (inQ) {
        if (c === '"') { inQ = false; closed = true; } else field += c;
      } else if (c === '"' && closed) {
        field += '"'; inQ = true; closed = false;
      } else if (c === '"' && field === '') {
        inQ = true;
      } else if (c === ',') {
        row.push(field); field = ''; closed = false;
      } else if (c === '\n') {
        yield* finishRow();
      } else if (c !== '\r') {
        field += c; closed = false;
      }
    }
  }
  if (field !== '' || row.length) yield* finishRow();
  if (!header) fail(`${name}: file is empty`);
}

const int = (v) => (v === '' || v == null ? null : Number.parseInt(v, 10));
const bool = (v) => /^(t|true|1)$/i.test(String(v).trim());
const txt = (v) => (v === '' || v == null ? null : v);

// ── load & filter ───────────────────────────────────────────────
console.log(`Reading CSVs from ${path.resolve(dir)} (year >= ${fromYear}${toYear ? ` and <= ${toYear}` : ''})`);

const themes = [];
for await (const r of readCsv('themes')) themes.push({ id: int(r.id), name: r.name, parent_id: int(r.parent_id) });

const colors = [];
for await (const r of readCsv('colors')) colors.push({ id: int(r.id), name: r.name, rgb: txt(r.rgb), is_trans: bool(r.is_trans) });
const colorIds = new Set(colors.map((c) => c.id));

const sets = new Map();
for await (const r of readCsv('sets')) {
  const year = int(r.year);
  if (year === null || year < fromYear || (toYear !== null && year > toYear)) continue;
  sets.set(r.set_num, {
    set_num: r.set_num, name: r.name, year, theme_id: int(r.theme_id),
    num_parts: int(r.num_parts), img_url: txt(r.img_url), inventory_version: null,
  });
}
if (sets.size === 0) fail('No sets match the year filter.');

// highest inventory version per kept set
const best = new Map(); // set_num -> { id, version }
for await (const r of readCsv('inventories')) {
  if (!sets.has(r.set_num)) continue;
  const version = int(r.version) ?? 0;
  const cur = best.get(r.set_num);
  if (!cur || version > cur.version) best.set(r.set_num, { id: r.id, version });
}
const invToSet = new Map();
for (const [setNum, { id, version }] of best) {
  invToSet.set(id, setNum);
  sets.get(setNum).inventory_version = version;
}

// inventory_parts: aggregate by (set, part, color, spare)
const setParts = new Map(); // key -> row
const partColors = new Map(); // "part|color" -> img_url
for await (const r of readCsv('inventory_parts')) {
  const setNum = invToSet.get(r.inventory_id);
  if (!setNum) continue;
  const spare = bool(r.is_spare);
  if (spare && noSpares) continue;
  const colorId = int(r.color_id);
  if (!colorIds.has(colorId)) fail(`inventory_parts references unknown color_id ${colorId} (part ${r.part_num}).`);
  const qty = int(r.quantity) ?? 0;
  if (qty <= 0) continue;
  const key = `${setNum}|${r.part_num}|${colorId}|${spare}`;
  const cur = setParts.get(key);
  if (cur) cur.quantity += qty;
  else setParts.set(key, { set_num: setNum, part_num: r.part_num, color_id: colorId, quantity: qty, is_spare: spare });
  const pcKey = `${r.part_num}|${colorId}`;
  if (!partColors.get(pcKey)) partColors.set(pcKey, txt(r.img_url));
}
const usedParts = new Set();
for (const k of partColors.keys()) usedParts.add(k.split('|')[0]);

// relationships: one hop from used parts
const relRows = [];
const keepParts = new Set(usedParts);
for await (const r of readCsv('part_relationships')) {
  if (!usedPartsOnly || usedParts.has(r.child_part_num) || usedParts.has(r.parent_part_num)) {
    relRows.push({ rel_type: r.rel_type, child_part_num: r.child_part_num, parent_part_num: r.parent_part_num });
    keepParts.add(r.child_part_num);
    keepParts.add(r.parent_part_num);
  }
}

const parts = [];
const seenParts = new Set();
let partsInCsv = 0;
for await (const r of readCsv('parts')) {
  if (!seenParts.has(r.part_num)) partsInCsv++;
  if ((usedPartsOnly && !keepParts.has(r.part_num)) || seenParts.has(r.part_num)) continue;
  seenParts.add(r.part_num);
  parts.push({ part_num: r.part_num, name: r.name, part_cat_id: int(r.part_cat_id), part_material: txt(r.part_material) });
}
// relationships must point to parts that exist in parts.csv
const relKept = relRows.filter((r) => seenParts.has(r.child_part_num) && seenParts.has(r.parent_part_num));
const relUnique = [...new Map(relKept.map((r) => [`${r.rel_type}|${r.child_part_num}|${r.parent_part_num}`, r])).values()];

// every used part must exist in parts.csv
const missingParts = [...usedParts].filter((p) => !seenParts.has(p));
if (missingParts.length) {
  fail(`${missingParts.length} parts used by inventories are not in parts.csv (e.g. ${missingParts.slice(0, 5).join(', ')}). Files may come from different snapshots.`);
}

const elements = new Map();
for await (const r of skipElements ? [] : readCsv('elements')) {
  if (!partColors.has(`${r.part_num}|${int(r.color_id)}`) || elements.has(r.element_id)) continue;
  elements.set(r.element_id, { element_id: r.element_id, part_num: r.part_num, color_id: int(r.color_id), design_id: txt(r.design_id) });
}

const partColorRows = [...partColors].map(([k, img]) => {
  const [part_num, color] = k.split('|');
  return { part_num, color_id: Number(color), img_url: img };
});

// ── derived data for the "possible sets" ranking ────────────────
const EQUIVALENT_REL_TYPES = new Set(['M']);
const parent = new Map();
const find = (x) => { let r = x; while (parent.has(r) && parent.get(r) !== r) r = parent.get(r); return r; };
for (const r of relUnique) {
  if (!EQUIVALENT_REL_TYPES.has(r.rel_type)) continue;
  for (const x of [r.child_part_num, r.parent_part_num]) if (!parent.has(x)) parent.set(x, x);
  const a = find(r.child_part_num), b = find(r.parent_part_num);
  if (a !== b) { if (a < b) parent.set(b, a); else parent.set(a, b); } // keep the smallest as root
}
const canonOf = (part) => find(part);
const canonRows = [];
for (const part of parent.keys()) { const c = canonOf(part); if (c !== part) canonRows.push({ part_num: part, canon_part_num: c }); }

const groupSets = new Map();   // "canon|color" -> Set of set_num
for (const row of setParts.values()) {
  if (row.is_spare) continue;
  const k = `${canonOf(row.part_num)}|${row.color_id}`;
  let st = groupSets.get(k); if (!st) groupSets.set(k, (st = new Set()));
  st.add(row.set_num);
}
const totalSets = new Set([...setParts.values()].filter((r) => !r.is_spare).map((r) => r.set_num)).size;
const weightOf = new Map();
const rarityRows = [];
for (const [k, st] of groupSets) {
  const [part_num, color] = k.split('|');
  const weight = Math.round(Math.log(1 + totalSets / st.size) * 1e6) / 1e6;
  weightOf.set(k, weight);
  rarityRows.push({ part_num, color_id: Number(color), sets_count: st.size, weight });
}
const statsBySet = new Map();
for (const row of setParts.values()) {
  if (row.is_spare) continue;
  let st = statsBySet.get(row.set_num);
  if (!st) statsBySet.set(row.set_num, (st = { set_num: row.set_num, total_qty: 0, distinct_parts: 0, weight_total: 0 }));
  st.total_qty += row.quantity; st.distinct_parts += 1;
  st.weight_total += row.quantity * weightOf.get(`${canonOf(row.part_num)}|${row.color_id}`);
}
const statsRows = [...statsBySet.values()].map((r) => ({ ...r, weight_total: Math.round(r.weight_total * 1e6) / 1e6 }));

const data = {
  lego_themes: themes,
  lego_colors: colors,
  lego_parts: parts,
  lego_part_colors: partColorRows,
  lego_sets: [...sets.values()],
  lego_set_parts: [...setParts.values()],
  lego_elements: [...elements.values()],
  lego_part_relationships: relUnique,
  lego_part_canon: canonRows,
  lego_part_rarity: rarityRows,
  lego_set_stats: statsRows,
};
const PK = {
  lego_themes: ['id'], lego_colors: ['id'], lego_parts: ['part_num'],
  lego_part_colors: ['part_num', 'color_id'], lego_sets: ['set_num'],
  lego_set_parts: ['set_num', 'part_num', 'color_id', 'is_spare'], lego_elements: ['element_id'],
  lego_part_relationships: ['rel_type', 'child_part_num', 'parent_part_num'],
  lego_part_canon: ['part_num'], lego_part_rarity: ['part_num', 'color_id'], lego_set_stats: ['set_num'],
};
const SECONDARY_INDEXES = { // see turso/lego-schema.sql
  lego_themes: 1, lego_colors: 0, lego_parts: 0, lego_part_colors: 0, lego_sets: 2,
  lego_set_parts: 1, lego_elements: 1, lego_part_relationships: 2,
  lego_part_canon: 1, lego_part_rarity: 0, lego_set_stats: 0,
};
const ORDER = [ // dependency order
  'lego_themes', 'lego_colors', 'lego_parts', 'lego_part_colors', 'lego_sets',
  'lego_set_parts', 'lego_elements', 'lego_part_relationships',
  'lego_part_canon', 'lego_part_rarity', 'lego_set_stats',
];

// ── size estimate (approximate, +/-30%) ─────────────────────────
function valueBytes(v) {
  if (v === null || v === undefined) return 1;
  if (typeof v === 'boolean') return 1;
  if (typeof v === 'number') return 3;          // SQLite stores small ints in 1-4 bytes
  return Buffer.byteLength(String(v));
}
function estimate(rows, nIdx) {
  if (!rows.length) return { rows: 0, bytes: 0, writes: 0 };
  const step = Math.ceil(rows.length / 5000);
  const sample = rows.filter((_, i) => i % step === 0);
  const avg = sample.reduce((s, r) => s + Object.values(r).reduce((a, v) => a + valueBytes(v), 0), 0) / sample.length;
  const rowBytes = 6 + avg;                     // record header + payload
  const idxBytes = nIdx * (0.45 * avg + 6);     // secondary index entries
  return {
    rows: rows.length,
    bytes: Math.round(rows.length * (rowBytes + idxBytes) * 1.15), // b-tree page slack
    writes: rows.length * (1 + nIdx),
  };
}
const mb = (b) => (b / 1024 / 1024).toFixed(1).padStart(7);

// ── coverage report: what the catalog will contain, and what it cannot ──
const pct = (a, b) => `${b ? ((100 * a) / b).toFixed(1) : '0.0'}%`;
const setsNoImg = data.lego_sets.filter((x) => !x.img_url).length;
const pairsNoImg = partColorRows.filter((r) => !r.img_url).length;
const partsWithPair = new Set(partColorRows.map((r) => r.part_num));
const partsWithImg = new Set(partColorRows.filter((r) => r.img_url).map((r) => r.part_num));
console.log('\nCoverage');
console.log(`  Sets in sets.csv (year filter applied): ${sets.size}`);
console.log(`    with an inventory .............. ${best.size} (${pct(best.size, sets.size)})`);
console.log(`    with at least one non-spare part ${statsRows.length} (${pct(statsRows.length, sets.size)})  <- only these can appear in "possible sets"`);
console.log(`    with a set image URL ........... ${sets.size - setsNoImg} (${pct(sets.size - setsNoImg, sets.size)})`);
console.log(`  Parts in parts.csv ............... ${partsInCsv}`);
console.log(`    imported ....................... ${parts.length} (${pct(parts.length, partsInCsv)})${usedPartsOnly ? '  (--used-parts-only)' : ''}`);
console.log(`    used by some imported set ...... ${partsWithPair.size} (${pct(partsWithPair.size, parts.length)} of imported)`);
console.log(`    with at least one image URL .... ${partsWithImg.size} (${pct(partsWithImg.size, parts.length)} of imported)`);
console.log(`  Part+color pairs with data ....... ${partColorRows.length}; without image URL: ${pairsNoImg} (${pct(pairsNoImg, partColorRows.length)})`);
console.log('  Not covered: minifigures (minifigs.csv is not imported) and any part+color pair that no set uses');
console.log('  has no image URL (Rebrickable gives images per part+color from set inventories only).');

async function checkUrls(label, urls, n) {
  if (!n || !urls.length) return;
  const pool = [...urls].sort(() => Math.random() - 0.5).slice(0, n);
  let good = 0, bad = 0, errored = 0, next = 0; const examples = [];
  const worker = async () => {
    while (next < pool.length) {
      const u = pool[next++];
      try {
        const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 10000);
        const res = await fetch(u, { headers: { Range: 'bytes=0-0', 'User-Agent': 'collectiq-lego-import (personal use)' }, signal: ctrl.signal });
        clearTimeout(timer); await res.body?.cancel?.();
        if (res.status === 200 || res.status === 206) good++; else { bad++; if (examples.length < 3) examples.push(`${res.status} ${u}`); }
      } catch { errored++; if (examples.length < 3) examples.push(`no answer ${u}`); }
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  console.log(`  ${label}: ${good}/${pool.length} answered OK (${pct(good, pool.length)}), ${bad} not found / refused, ${errored} no answer`);
  for (const e of examples) console.log(`     e.g. ${e}`);
}

console.log('\nEstimated size per table (approximate, +/-30%)');
console.log('table'.padEnd(26) + 'rows'.padStart(10) + '      MB' + '   row writes');
let total = 0;
let totalWrites = 0;
for (const t of ORDER) {
  const e = estimate(data[t], SECONDARY_INDEXES[t]);
  total += e.bytes;
  totalWrites += e.writes;
  console.log(t.padEnd(26) + String(e.rows).padStart(10) + `  ${mb(e.bytes)}` + String(e.writes).padStart(13));
}
console.log('-'.repeat(57));
console.log('TOTAL'.padEnd(26) + ''.padStart(10) + `  ${mb(total)}` + String(totalWrites).padStart(13));
console.log(`Storage budget ${budgetMb} MB, writes budget ${writesBudget.toLocaleString()} (one full import; every re-run spends them again).`);
console.log(`Sets: ${sets.size}. Sets without inventory: ${[...sets.keys()].filter((s) => !best.has(s)).length}.`);
const overStorage = total / 1024 / 1024 > budgetMb;
const overWrites = totalWrites > writesBudget;
if (overStorage) console.log('WARNING: estimated storage exceeds the budget. Raise --from-year or use --no-spares / --skip-elements.');
if (overWrites) console.log('WARNING: estimated row writes exceed the budget. Raise --from-year, use --no-spares / --skip-elements, or split the import across months.');

if (!apply) {
  if (checkImages > 0) {
    console.log(`\nImage URL sample (${checkImages} sets, ${checkImages} parts; a share of Rebrickable's image URLs is known to return 404)`);
    await checkUrls('Set images ', data.lego_sets.map((x) => x.img_url).filter(Boolean), checkImages);
    await checkUrls('Part images', partColorRows.map((r) => r.img_url).filter(Boolean), checkImages);
  }
  console.log('\nEstimate only: nothing was written. Re-run with --apply to import.');
  process.exit(0);
}
if ((overStorage || overWrites) && !force) {
  fail('The estimate exceeds a budget. Nothing was written.\n' +
    '  Raise --from-year, use --no-spares / --skip-elements, or pass --force if you are sure.');
}

// ── apply ───────────────────────────────────────────────────────
const dbUrl = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!dbUrl) fail('Set TURSO_DATABASE_URL (and TURSO_AUTH_TOKEN for a remote database) in the environment to use --apply.');
if (!dbUrl.startsWith('file:') && !authToken) fail('TURSO_AUTH_TOKEN is required for a remote database.');

const { createClient } = await import('@libsql/client');
const db = createClient({ url: dbUrl, authToken });

const schemaPath = new URL('../turso/lego-schema.sql', import.meta.url);
console.log('\nApplying schema (IF NOT EXISTS)...');
await db.executeMultiple(fs.readFileSync(schemaPath, 'utf8'));

// One statement per row (the first version) meant ~1.7M statements for a full import and
// blew the 1 h CI limit. Rows now go in multi-row statements, several per transaction.
const MAX_PARAMS = 4000;      // well under SQLite's variable limit
const STMTS_PER_BATCH = 5;    // statements per transaction (~4,000 rows for a 5-column table)

function multiRowSql(table, cols, nRows) {
  const pk = PK[table];
  const rest = cols.filter((c) => !pk.includes(c));
  const conflict = insertOnly || !rest.length
    ? 'DO NOTHING'
    : `DO UPDATE SET ${rest.map((c) => `${c}=excluded.${c}`).join(', ')}`;
  const one = `(${cols.map(() => '?').join(',')})`;
  return `INSERT INTO ${table} (${cols.join(',')}) VALUES ${Array(nRows).fill(one).join(',')} ` +
    `ON CONFLICT(${pk.join(',')}) ${conflict}`;
}
const sqlValue = (v) => (typeof v === 'boolean' ? (v ? 1 : 0) : v);

async function write(table, rows) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const perStmt = Math.max(1, Math.floor(MAX_PARAMS / cols.length));
  const perBatch = perStmt * STMTS_PER_BATCH;
  const started = Date.now();
  let lastLog = 0;
  for (let i = 0; i < rows.length; i += perBatch) {
    const stmts = [];
    for (let j = i; j < Math.min(i + perBatch, rows.length); j += perStmt) {
      const chunk = rows.slice(j, Math.min(j + perStmt, i + perBatch, rows.length));
      stmts.push({
        sql: multiRowSql(table, cols, chunk.length),
        args: chunk.flatMap((r) => cols.map((c) => sqlValue(r[c]))),
      });
    }
    let lastErr = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      try { await db.batch(stmts, 'write'); lastErr = null; break; }
      catch (e) {
        lastErr = String(e?.message ?? e);
        if (/SQLITE_CONSTRAINT|CHECK|NOT NULL|UNIQUE|FOREIGN/i.test(lastErr)) break; // not retryable
        await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
      }
    }
    if (lastErr) fail(`${table} batch at row ${i} failed: ${lastErr}\n  Stopped. Rows already written stay in place; re-run with --insert-only to finish without rewriting them.`);
    const done = Math.min(i + perBatch, rows.length);
    // plain lines (not \r) so CI logs stay readable; at most one line every 5 s
    if (done === rows.length || Date.now() - lastLog > 5000) {
      lastLog = Date.now();
      const secs = ((Date.now() - started) / 1000).toFixed(0);
      console.log(`${table}: ${done}/${rows.length} (${Math.round((100 * done) / rows.length)}%) ${secs}s`);
    }
  }
}

console.log('Importing (dependency order)...');
for (const t of ORDER) await write(t, data[t]);
db.close();
console.log('Done.');
