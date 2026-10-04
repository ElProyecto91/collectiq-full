#!/usr/bin/env node
/**
 * Fills lego_part_images (one fallback picture per part) from the Rebrickable API.
 *
 * It also fills lego_part_ext (BrickLink number -> Rebrickable part), because the part recognizer (Brickognize)
 * answers with BrickLink numbers and many differ from Rebrickable's (BrickLink 98613 = Rebrickable 74261).
 *
 * Why: Rebrickable's CSV files only give an image for a part+color pair that appears in some set
 * inventory, so parts that no set uses (and pairs missing an image) have none. The API's parts list
 * carries a picture for each part. Only parts WITHOUT any image in lego_part_colors are stored.
 *
 * Needs a free API key (https://rebrickable.com/api/), read from the environment, never committed:
 *   REBRICKABLE_API_KEY=<key> TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=<write token> \
 *   node scripts/lego-part-images.mjs [--apply]
 *
 * Without --apply it only reports (it still reads the target list from Turso). Polite by design:
 * one request at a time, at most one per --delay-ms (default 1200), 1000 parts per request (about
 * 65 requests for the whole catalog), waits and retries on HTTP 429 and stops on 401/403.
 *
 * Options
 *   --apply              write the images found (INSERT ... ON CONFLICT DO NOTHING).
 *   --delay-ms N         pause between requests (default 1200).
 *   --max-pages N        stop after N pages (testing).
 *   --writes-budget N    refuse to write more rows than this, per table (default 100000).
 *   --check N            sample N of the found URLs and report how many answer (default 100, 0 = off).
 * Test hook: REBRICKABLE_API_BASE overrides https://rebrickable.com/api/v3.
 */
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined && !args[i + 1].startsWith('--') ? args[i + 1] : def;
};
const apply = args.includes('--apply');
const delayMs = Number(opt('delay-ms', 1200));
const maxPages = Number(opt('max-pages', Infinity));
const writesBudget = Number(opt('writes-budget', 100_000));
const checkN = Number(opt('check', 100)) || 0;

function fail(msg) {
  console.error(`\nERROR: ${msg}`);
  process.exit(1);
}

const apiKey = process.env.REBRICKABLE_API_KEY;
if (!apiKey) fail('Set REBRICKABLE_API_KEY (a free key from https://rebrickable.com/api/) in the environment.');
const dbUrl = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!dbUrl) fail('Set TURSO_DATABASE_URL (and TURSO_AUTH_TOKEN for a remote database).');
if (!dbUrl.startsWith('file:') && !authToken) fail('TURSO_AUTH_TOKEN is required for a remote database.');

const { createClient } = await import('@libsql/client');
const db = createClient({ url: dbUrl, authToken });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── which parts need a picture ──────────────────────────────────
await db.executeMultiple(
  'CREATE TABLE IF NOT EXISTS lego_part_images (part_num TEXT PRIMARY KEY, img_url TEXT NOT NULL) WITHOUT ROWID;\n' +
  'CREATE TABLE IF NOT EXISTS lego_part_ext (ext_system TEXT NOT NULL, ext_id TEXT NOT NULL, part_num TEXT NOT NULL, ' +
  'PRIMARY KEY (ext_system, ext_id, part_num)) WITHOUT ROWID;'
);
const allParts = new Set((await db.execute('SELECT part_num FROM lego_parts')).rows.map((r) => String(r.part_num)));
const haveExt = Number((await db.execute("SELECT COUNT(*) AS n FROM lego_part_ext WHERE ext_system = 'BrickLink'")).rows[0].n);
const target = new Set(
  (await db.execute(
    'SELECT p.part_num FROM lego_parts p ' +
      'WHERE NOT EXISTS (SELECT 1 FROM lego_part_colors pc WHERE pc.part_num = p.part_num AND pc.img_url IS NOT NULL) ' +
      'AND NOT EXISTS (SELECT 1 FROM lego_part_images i WHERE i.part_num = p.part_num)'
  )).rows.map((r) => String(r.part_num))
);
const totalParts = Number((await db.execute('SELECT COUNT(*) AS n FROM lego_parts')).rows[0].n);
console.log(`Parts in the catalog: ${totalParts}. Without any picture yet: ${target.size}. BrickLink numbers stored: ${haveExt}.`);
if (target.size === 0 && haveExt > 0) { console.log('Nothing to do.'); db.close(); process.exit(0); }

// ── fetch the parts list from the API ───────────────────────────
const base = process.env.REBRICKABLE_API_BASE ?? 'https://rebrickable.com/api/v3';
let url = `${base}/lego/parts/?page_size=1000&ordering=part_num`;
const found = new Map(); // part_num -> img_url
const extRows = new Map(); // 'BrickLink|id|part' -> [system, id, part_num]
let pages = 0, apiParts = 0, apiNoImage = 0;

async function getPage(u) {
  for (let attempt = 0; attempt < 6; attempt++) {
    let res;
    try { res = await fetch(u, { headers: { Authorization: `key ${apiKey}`, Accept: 'application/json' } }); }
    catch (e) { await sleep(5000 * (attempt + 1)); continue; }
    if (res.status === 401 || res.status === 403) fail(`Rebrickable refused the API key (HTTP ${res.status}). Check REBRICKABLE_API_KEY. Nothing was written.`);
    if (res.status === 429) {
      const wait = Math.min(120, Number(res.headers.get('retry-after')) || 30 * (attempt + 1));
      console.log(`  rate limited (429): waiting ${wait}s`);
      await sleep(wait * 1000);
      continue;
    }
    if (res.status >= 500) { await sleep(5000 * (attempt + 1)); continue; }
    if (!res.ok) fail(`Unexpected HTTP ${res.status} from ${u}`);
    return res.json();
  }
  fail(`Gave up on ${u} after several attempts (network errors or rate limits). Nothing was written.`);
}

while (url && pages < maxPages) {
  const page = await getPage(url);
  pages++;
  for (const p of page.results ?? []) {
    apiParts++;
    // BrickLink numbers (the recognizer's numbering) for parts that are in the catalog
    const bl = p.external_ids?.BrickLink;
    if (Array.isArray(bl) && allParts.has(String(p.part_num))) {
      for (const id of bl) extRows.set(`BrickLink|${id}|${p.part_num}`, ['BrickLink', String(id), String(p.part_num)]);
    }
    if (!p.part_img_url) { apiNoImage++; continue; }
    if (target.has(String(p.part_num))) found.set(String(p.part_num), String(p.part_img_url));
  }
  if (pages % 10 === 0 || !page.next) console.log(`  page ${pages}: ${apiParts} parts read, ${found.size} pictures found for the target`);
  url = page.next;
  if (url) await sleep(delayMs);
}

const missingAfter = target.size - found.size;
console.log(`\nAPI parts read: ${apiParts} (${apiNoImage} without a picture in the API).`);
console.log(`Target parts: ${target.size}. Picture found for ${found.size}; still without any picture: ${missingAfter}.`);
console.log(`BrickLink numbers read: ${extRows.size} (already stored: ${haveExt}).`);
if (pages >= maxPages && url) console.log('(stopped early by --max-pages: the numbers above are partial)');

if (checkN > 0 && found.size) {
  const urls = [...found.values()].sort(() => Math.random() - 0.5).slice(0, checkN);
  let ok = 0, bad = 0, none = 0;
  const queue = [...urls];
  await Promise.all(Array.from({ length: 6 }, async () => {
    for (let u; (u = queue.pop()); ) {
      try {
        const r = await fetch(u, { headers: { Range: 'bytes=0-0' }, signal: AbortSignal.timeout(10_000) });
        if (r.ok || r.status === 206) ok++; else bad++;
      } catch { none++; }
    }
  }));
  console.log(`Picture URL sample (${urls.length}): ${ok} answer OK, ${bad} not found / refused, ${none} no answer.`);
}

if (found.size > writesBudget || extRows.size > writesBudget) fail(`Would write ${found.size} pictures and ${extRows.size} numbers, over --writes-budget ${writesBudget} per table. Nothing was written.`);
if (!apply) { console.log('\nReport only: nothing was written. Re-run with --apply to store the pictures.'); db.close(); process.exit(0); }

// ── write ───────────────────────────────────────────────────────
const rows = [...found];
const PER_STMT = 400, STMTS = 5;
for (let i = 0; i < rows.length; i += PER_STMT * STMTS) {
  const stmts = [];
  for (let j = i; j < Math.min(i + PER_STMT * STMTS, rows.length); j += PER_STMT) {
    const chunk = rows.slice(j, Math.min(j + PER_STMT, i + PER_STMT * STMTS, rows.length));
    stmts.push({
      sql: `INSERT INTO lego_part_images (part_num, img_url) VALUES ${chunk.map(() => '(?, ?)').join(',')} ON CONFLICT(part_num) DO NOTHING`,
      args: chunk.flat(),
    });
  }
  await db.batch(stmts, 'write');
}
console.log(`\nWrote ${rows.length} picture(s) to lego_part_images.`);

const ext = [...extRows.values()];
const EXT_PER_STMT = 300;
for (let i = 0; i < ext.length; i += EXT_PER_STMT * STMTS) {
  const stmts = [];
  for (let j = i; j < Math.min(i + EXT_PER_STMT * STMTS, ext.length); j += EXT_PER_STMT) {
    const chunk = ext.slice(j, Math.min(j + EXT_PER_STMT, i + EXT_PER_STMT * STMTS, ext.length));
    stmts.push({
      sql: `INSERT INTO lego_part_ext (ext_system, ext_id, part_num) VALUES ${chunk.map(() => '(?, ?, ?)').join(',')} ON CONFLICT DO NOTHING`,
      args: chunk.flat(),
    });
  }
  await db.batch(stmts, 'write');
}
console.log(`Wrote ${ext.length} BrickLink number(s) to lego_part_ext (rows that already existed are left alone).`);
db.close();
console.log('Done.');
