#!/usr/bin/env node
/**
 * LEGO catalog importer (Rebrickable CSV -> Supabase).
 *
 * Data source: https://rebrickable.com/downloads/ (attribute Rebrickable in the
 * UI; automated downloads at most once a day). Download the files yourself and
 * put them in one folder (.csv or .csv.gz):
 *   themes colors parts part_relationships elements sets inventories inventory_parts
 *
 * Usage
 *   1) Estimate only (default, writes nothing, needs no credentials):
 *        node scripts/lego-import.mjs --dir ./lego-data --from-year 2015
 *   2) Import (after running the migration by hand):
 *        SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *        node scripts/lego-import.mjs --dir ./lego-data --from-year 2015 --apply
 *
 * Options
 *   --from-year N   required. Only sets with year >= N.
 *   --to-year N     optional upper bound.
 *   --no-spares     do not import spare parts (smaller, spares are never used
 *                   for completeness anyway).
 *   --skip-elements do not import elements.csv (element_id lookup, only needed for
 *                   the phase 4 shop view; can be imported later).
 *   --budget-mb N   free space you want to compare the estimate with (default 370).
 *   --apply         actually write. Without it nothing is written. Refuses to run
 *                   when the estimate exceeds --budget-mb.
 *   --force         allow --apply above the budget. Do not use on the free plan:
 *                   at 500 MB Supabase makes the WHOLE project read-only.
 *
 * Rules
 *   - Credentials only from environment variables. Never commit them.
 *   - The service_role key bypasses RLS: run this on your machine only.
 *   - One inventory per set: the highest `version` in inventories.csv.
 *   - Required CSV headers are validated first; on any mismatch the script
 *     aborts before writing anything.
 *   - Re-import is an upsert. Stale rows of a set whose inventory shrank are not
 *     removed; truncate the lego_* tables first if you want a clean re-import.
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
const apply = args.includes('--apply');
const budgetMb = Number(opt('budget-mb', 370));

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
  if (usedParts.has(r.child_part_num) || usedParts.has(r.parent_part_num)) {
    relRows.push({ rel_type: r.rel_type, child_part_num: r.child_part_num, parent_part_num: r.parent_part_num });
    keepParts.add(r.child_part_num);
    keepParts.add(r.parent_part_num);
  }
}

const parts = [];
const seenParts = new Set();
for await (const r of readCsv('parts')) {
  if (!keepParts.has(r.part_num) || seenParts.has(r.part_num)) continue;
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

const data = {
  lego_themes: themes,
  lego_colors: colors,
  lego_parts: parts,
  lego_part_colors: partColorRows,
  lego_sets: [...sets.values()],
  lego_set_parts: [...setParts.values()],
  lego_elements: [...elements.values()],
  lego_part_relationships: relUnique,
};
const PK = {
  lego_themes: 'id', lego_colors: 'id', lego_parts: 'part_num',
  lego_part_colors: 'part_num,color_id', lego_sets: 'set_num',
  lego_set_parts: 'set_num,part_num,color_id,is_spare', lego_elements: 'element_id',
  lego_part_relationships: 'rel_type,child_part_num,parent_part_num',
};
const INDEXES = { // btree indexes per table, PK included
  lego_themes: 2, lego_colors: 1, lego_parts: 1, lego_part_colors: 1, lego_sets: 3,
  lego_set_parts: 2, lego_elements: 2, lego_part_relationships: 3,
};

// ── size estimate (approximate, +/-30%) ─────────────────────────
function valueBytes(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'boolean') return 1;
  if (typeof v === 'number') return 4;
  return Buffer.byteLength(String(v)) + 1;
}
function estimate(rows, nIdx) {
  if (!rows.length) return { rows: 0, bytes: 0 };
  const sample = rows.length > 5000 ? rows.filter((_, i) => i % Math.ceil(rows.length / 5000) === 0) : rows;
  const avg = sample.reduce((s, r) => s + Object.values(r).reduce((a, v) => a + valueBytes(v), 0), 0) / sample.length;
  const heap = 28 + Math.ceil(avg * 1.1);      // tuple header + line pointer + alignment slack
  const index = nIdx * (avg * 0.35 + 24);      // rough btree entry (keys are a fraction of the row)
  return { rows: rows.length, bytes: Math.round(rows.length * (heap + index) * 1.1) };
}
const mb = (b) => (b / 1024 / 1024).toFixed(1).padStart(7);

console.log('\nEstimated size per table (approximate, +/-30%)');
console.log('table'.padEnd(26) + 'rows'.padStart(10) + '      MB');
let total = 0;
for (const [t, rows] of Object.entries(data)) {
  const e = estimate(rows, INDEXES[t]);
  total += e.bytes;
  console.log(t.padEnd(26) + String(e.rows).padStart(10) + `  ${mb(e.bytes)}`);
}
console.log('-'.repeat(44));
console.log('TOTAL'.padEnd(26) + ''.padStart(10) + `  ${mb(total)} MB  (budget ${budgetMb} MB)`);
console.log(`Sets: ${sets.size}. Sets without inventory: ${[...sets.keys()].filter((s) => !best.has(s)).length}.`);
if (total / 1024 / 1024 > budgetMb) console.log('WARNING: estimate exceeds the budget. Raise --from-year or use --no-spares.');

if (!apply) {
  console.log('\nEstimate only: nothing was written. Re-run with --apply to import.');
  process.exit(0);
}
if (total / 1024 / 1024 > budgetMb && !force) {
  fail(`Estimated ${(total / 1024 / 1024).toFixed(0)} MB exceeds the ${budgetMb} MB budget. Nothing was written.\n` +
    '  Raise --from-year, use --no-spares / --skip-elements, or pass --force if you know you have the space.');
}

// ── apply ───────────────────────────────────────────────────────
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) fail('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment to use --apply.');

async function upsert(table, rows) {
  const BATCH = 1000;
  for (let i = 0; i < rows.length; i += BATCH) {
    const body = JSON.stringify(rows.slice(i, i + BATCH));
    let lastErr = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await fetch(`${url}/rest/v1/${table}?on_conflict=${PK[table]}`, {
          method: 'POST',
          headers: {
            apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=minimal',
          },
          body,
        });
        if (res.ok) { lastErr = null; break; }
        lastErr = `HTTP ${res.status}: ${await res.text()}`;
        if (res.status < 500 && res.status !== 429) break; // not retryable
      } catch (e) { lastErr = String(e); }
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    }
    if (lastErr) fail(`${table} batch at row ${i} failed: ${lastErr}\n  Stopped. Rows already written stay in place (upsert is safe to re-run).`);
    process.stdout.write(`\r${table}: ${Math.min(i + BATCH, rows.length)}/${rows.length}   `);
  }
  process.stdout.write('\n');
}

console.log('\nImporting (FK order)...');
for (const t of [
  'lego_themes', 'lego_colors', 'lego_parts', 'lego_part_colors', 'lego_sets',
  'lego_set_parts', 'lego_elements', 'lego_part_relationships',
]) {
  await upsert(t, data[t]);
}
console.log('Done.');
