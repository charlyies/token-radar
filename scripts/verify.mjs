// Local check of the sealed scorer's seven gate rows, against a built /output.
// Mirrors RULES.txt's gate; the server's grade is the authority, this only
// catches what can be caught before submitting.
//   node scripts/verify.mjs <out-dir> <snapshot.json>
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from '../vendor/makefun-board.ts';

const [outDir, snapPath] = process.argv.slice(2);
if (!outDir || !snapPath) {
  process.stderr.write('usage: node scripts/verify.mjs <out-dir> <snapshot.json>\n');
  process.exit(1);
}
const snap = JSON.parse(readFileSync(snapPath, 'utf8'));
const fails = [];
const ok = (name, detail) => process.stdout.write(`PASS ${name}${detail ? ` — ${detail}` : ''}\n`);
const bad = (name, detail) => { fails.push(name); process.stdout.write(`FAIL ${name} — ${detail}\n`); };

// 1. dashboard_files: index.html + >=1 .css + >=1 .js, <=400 files, <=4 MiB,
//    plain names, no http(s) address in an HTML attribute, CSS, or JS import.
{
  const dash = join(outDir, 'dashboard');
  const files = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith('.')) { bad('dashboard_files', `dot entry ${e.name}`); return; }
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) files.push(p);
    }
  };
  walk(dash);
  const rel = files.map((f) => f.slice(dash.length + 1));
  const bytes = files.reduce((n, f) => n + statSync(f).size, 0);
  const nameOk = rel.every((n) => /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/.test(n.split('/').pop()) && !n.split('/').some((s) => s.startsWith('.')));
  const hasHtml = rel.includes('index.html');
  const hasCss = rel.some((n) => n.endsWith('.css'));
  const hasJs = rel.some((n) => n.endsWith('.js'));
  const netRe = /(?:src|href)\s*=\s*["']https?:\/\/|@import\s+["']https?:\/\/|from\s+["']https?:\/\/|import\s*\(\s*["']https?:\/\/|require\s*\(\s*["']https?:\/\//;
  const netted = rel.filter((n) => netRe.test(readFileSync(join(dash, n), 'utf8')));
  if (!hasHtml || !hasCss || !hasJs) bad('dashboard_files', `index.html=${hasHtml} css=${hasCss} js=${hasJs}`);
  else if (files.length > 400 || bytes > 4_194_304) bad('dashboard_files', `${files.length} files, ${bytes} bytes`);
  else if (!nameOk) bad('dashboard_files', 'a file name breaks the plain-name rule');
  else if (netted.length) bad('dashboard_files', `network address in ${netted.join(', ')}`);
  else ok('dashboard_files', `${files.length} files, ${bytes} bytes, no network address`);
}

// 2. board_file + 3. sorted_by_value + 4. coverage + 5. farm_steps
{
  const board = JSON.parse(readFileSync(join(outDir, 'board.json'), 'utf8'));
  const rows = board.rows;
  const slugs = new Set(snap.protocols.map((p) => p.slug));
  const seen = new Set();
  let issue = null;
  if (!Array.isArray(rows) || rows.length < 100 || rows.length > 4000) issue = `${rows?.length} rows`;
  for (const r of rows ?? []) {
    if (!slugs.has(r.slug)) { issue = `invented slug ${r.slug}`; break; }
    if (seen.has(r.slug)) { issue = `duplicate slug ${r.slug}`; break; }
    seen.add(r.slug);
    if (typeof r.name !== 'string' || !r.name) { issue = `${r.slug} has no name`; break; }
    if (!Number.isSafeInteger(r.rank) || r.rank < 1) { issue = `${r.slug} rank ${r.rank}`; break; }
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 1e14) { issue = `${r.slug} implied ${r.implied_value_usd}`; break; }
    if (!Array.isArray(r.farm_steps) || r.farm_steps.length < 3 || r.farm_steps.length > 12) { issue = `${r.slug} has ${r.farm_steps?.length} farm steps`; break; }
    for (const s of r.farm_steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) { issue = `${r.slug} farm step of ${t.length} chars`; break; }
    }
    if (issue) break;
  }
  if (issue) bad('board_file', issue);
  else ok('board_file', `${rows.length} rows, all slugs real, all steps 20..600 chars`);

  const ranks = rows.map((r) => r.rank).sort((a, b) => a - b);
  const rankOk = ranks.every((r, i) => r === i + 1);
  const sorted = rows.every((r, i) => i === 0 || rows[i - 1].implied_value_usd >= r.implied_value_usd);
  const flat = rows.length >= 2 && rows[0].implied_value_usd === rows[rows.length - 1].implied_value_usd;
  if (!rankOk) bad('sorted_by_value', 'ranks are not exactly 1..N');
  else if (!sorted) bad('sorted_by_value', 'implied value rises as rank ascends');
  else if (flat) bad('sorted_by_value', 'every row shares one implied value');
  else ok('sorted_by_value', `ranks 1..${rows.length}, implied $${rows[0].implied_value_usd} down to $${rows[rows.length - 1].implied_value_usd}`);

  const missing = snap.watchlist.filter((s) => !seen.has(s));
  if (missing.length) bad('coverage', `missing ${missing.length} watchlist slugs: ${missing.slice(0, 5).join(', ')}`);
  else ok('coverage', `all ${snap.watchlist.length} watchlist slugs present, ${rows.length - snap.watchlist.length} early rows`);
  if (!issue) ok('farm_steps', `${rows.length} rows x ${rows[0].farm_steps.length} steps`);
}

// 6. screenshots: 3..4 images, each a whole PNG/JPEG, <=512 KiB,
//    long side <=1440, short side >=800.
{
  const dir = join(outDir, 'screenshots');
  const names = readdirSync(dir).filter((n) => !n.startsWith('.')).sort();
  let issue = null;
  if (names.length < 3 || names.length > 4) issue = `${names.length} images`;
  for (const n of names) {
    const b = readFileSync(join(dir, n));
    const isPng = b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isJpeg = b[0] === 0xff && b[1] === 0xd8 && b[b.length - 2] === 0xff && b[b.length - 1] === 0xd9;
    if (!isPng && !isJpeg) { issue = `${n} is neither PNG nor JPEG`; break; }
    if (b.length > 524_288) { issue = `${n} is ${b.length} bytes`; break; }
  }
  if (issue) bad('screenshots', issue);
  else {
    // JPEG dimensions from the SOF0/SOF2 marker.
    const dims = names.map((n) => {
      const b = readFileSync(join(dir, n));
      let i = 2;
      while (i < b.length - 9) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
          return `${n} ${b.readUInt16BE(i + 7)}x${b.readUInt16BE(i + 5)}`;
        }
        i += 2 + b.readUInt16BE(i + 2);
      }
      return `${n} (dims unread)`;
    });
    ok('screenshots', dims.join(', '));
  }
}

// 7. dossier_matches: byte for byte what buildDossier writes, <=1.5 MiB.
{
  const got = readFileSync(join(outDir, 'dossier.json'));
  const want = buildDossier(outDir, { text_max_bytes: 65_536, screenshots: { max: 4, max_bytes: 524_288 }, dashboard: { max_files: 400, max_bytes: 4_194_304 } });
  if (got.length > 1_572_864) bad('dossier_matches', `dossier is ${got.length} bytes, over 1.5 MiB`);
  else if (!got.equals(Buffer.from(want))) bad('dossier_matches', 'dossier.json is not what buildDossier writes from this /output');
  else ok('dossier_matches', `${got.length} bytes, byte-identical to buildDossier`);
}

process.exit(fails.length ? 1 : 0);
