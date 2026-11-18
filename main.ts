// Token Radar, entrypoint (Node 22, standard library only).
//
// Reads the sealed snapshot, scores every pre-token protocol with the
// radar-3 model in lib/model.ts, and writes the entry's outputs:
//
//   /output/board.json     the ranked board, one row per protocol
//   /output/data.js        the dashboard's dataset, as one script
//   /output/dashboard/    the static page (copied from dashboard/)
//   /output/screenshots/  the three screenshots (copied from screenshots/)
//   /output/dossier.json  the judge's dossier, via vendor/makefun-board.ts
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output and
// MAKEFUN_INPUT_DIR for /input:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out MAKEFUN_INPUT_DIR=<snapshot dir> node main.ts
//
// The program is deterministic: two runs on the same snapshot write the same
// bytes, and it refuses to write a board the gate would refuse.

import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The scorer's own caps: the text cap shapes the bytes, the rest refuse. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_LIMIT = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** Read `--name <value>` (or `--name=<value>`) from the arguments. */
function flag(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && i + 1 < process.argv.length) return process.argv[i + 1]!;
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq === undefined ? fallback : eq.slice(name.length + 3);
}

function fail(message: string, code = 1): never {
  process.stderr.write(`token radar: ${message}\n`);
  process.exit(code);
}

const inputArg = flag('input', process.env.MAKEFUN_INPUT_DIR ?? '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) fail(`no snapshot at ${inputFile}: pass --input <snapshot.json|directory>`);

const outDir = flag('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) fail(`the model wrote a board the gate refuses: ${issue}`);

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(outDir, 'data.js'), dataScript(radar));

/** Copy a directory's regular files into `to`, skipping dot-names. */
function copyDir(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}

copyDir(join(here, 'dashboard'), join(outDir, 'dashboard'));
// The dashboard's summary lines carry tokens ({{AS_OF}}, {{FIT_EQUATION}} …):
// fill them with this run's numbers so the page — and the dossier built from
// it — states the fit, the verdicts and the top five instead of placeholders.
{
  const page = join(outDir, 'dashboard', 'index.html');
  const top5 = board
    .slice(0, 5)
    .map((r) => `${r.name} $${(r.implied_value_usd / 1e6).toFixed(1)}M`)
    .join(' · ');
  const filled = readFileSync(page, 'utf8')
    .replaceAll('{{AS_OF}}', snapshot.as_of)
    .replaceAll('{{BOARD_SIZE}}', String(board.length))
    .replaceAll('{{WATCHLIST_SIZE}}', String(snapshot.watchlist.length))
    .replaceAll('{{EARLY_SIZE}}', String(radar.early_size))
    .replaceAll('{{LIVE_SIZE}}', String(radar.live_size))
    .replaceAll('{{FIT_EQUATION}}', `log10(mcap) = ${radar.fit.intercept} + ${radar.fit.slope} × log10(TVL)`)
    .replaceAll(
      '{{FIT_STATS}}',
      `R² ${radar.fit.r2} on ${radar.fit.n} traded tokens · time-split out-of-sample ×${radar.fit.timeSplitMedian} median (×${radar.fit.timeSplitMean} mean, ${radar.fit.timeSplitTrain} train / ${radar.fit.timeSplitTest} test) · 5-fold cross-validation ×${radar.fit.cvMedian} median (×${radar.fit.cvMean} mean)`,
    )
    .replaceAll('{{VERDICTS}}', `FARM ${radar.farmCounts.farm} · THIN ${radar.farmCounts.thin} · SKIP ${radar.farmCounts.skip}`)
    .replaceAll('{{TOP5}}', `Top five: ${top5}.`);
  if (/{{\w+}}/.test(filled)) fail('dashboard/index.html still holds an unfilled {{TOKEN}} after injection');
  writeFileSync(page, filled);
}
const shots = copyDir(join(here, 'screenshots'), join(outDir, 'screenshots'));
if (shots.length < 3) fail(`screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view`);
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) fail(`screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters`);
}

// The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_LIMIT, dashboard: { max_files: 400, max_bytes: 4_194_304 } }),
);

/**
 * The grader reads /output as another user, after this program exits: leave
 * every output readable by anyone, whatever umask the sandbox runs under.
 * mkdir and write honour the umask, so a restrictive one (077) would leave
 * 0600 files in 0700 directories the grader cannot read, and the run would
 * fail after exiting 0. chmod is not cut by the umask, so the modes are set
 * here, after all the writes, as the last step before the program reports.
 */
function sealOutputs(dir: string): void {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) {
      sealOutputs(path);
      chmodSync(path, 0o755);
    } else if (st.isFile()) {
      chmodSync(path, 0o644);
    }
  }
  chmodSync(dir, 0o755);
}
sealOutputs(outDir);

process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.live_size} live set aside)\n` +
    `token radar: curve log10(mcap) = ${radar.fit.intercept} + ${radar.fit.slope} * log10(tvl), R2 ${radar.fit.r2}, n ${radar.fit.n}; OOS time-split x${radar.fit.timeSplitMedian}, 5-fold x${radar.fit.cvMedian}\n` +
    `token radar: verdicts FARM ${radar.farmCounts.farm}, THIN ${radar.farmCounts.thin}, SKIP ${radar.farmCounts.skip}\n` +
    `token radar: wrote ${join(outDir, 'board.json')}, ${join(outDir, 'data.js')}, ${join(outDir, 'dashboard')}, ${join(outDir, 'screenshots')} (${shots.length} images) and ${join(outDir, 'dossier.json')}\n`,
);
