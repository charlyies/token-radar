// Shoot the three dossier screenshots of a built /output directory.
//
// Usage: node scripts/shoot.mjs <out-dir> [shots-dir] [quality]
//   Renders the dashboard three ways at 1280x900 with headless Chromium
//   (puppeteer-core) and writes JPEGs into <shots-dir> (default: the
//   project's screenshots/): board.jpg (the board), detail.jpg (one
//   protocol's detail view) and filtered.jpg (the board filtered to FARM).
//   Each JPEG is kept under the dossier's 512 KiB image cap; quality drops
//   until it fits. The page is loaded over file://, so ../data.js resolves
//   from the same /output directory.
import { statSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const puppeteer = require('/home/hatch/workspace/makefun/node_modules/puppeteer-core');

const MAX_BYTES = 500_000;
const outDir = process.argv[2];
const here = fileURLToPath(new URL('..', import.meta.url));
const shotsDir = process.argv[3] ?? join(here, 'screenshots');
const startQuality = Number(process.argv[4] ?? 85);
if (!outDir) {
  process.stderr.write('usage: node scripts/shoot.mjs <out-dir> [shots-dir] [quality]\n');
  process.exit(1);
}
mkdirSync(shotsDir, { recursive: true });

const pageUrl = pathToFileURL(join(outDir, 'dashboard', 'index.html')).href;
const shots = [
  { file: 'board.jpg', url: pageUrl },
  { file: 'detail.jpg', url: `${pageUrl}#/protocol/steakhouse-financial` },
  // The filter changes the table below the fold, so scroll it into view:
  // otherwise the shot looks identical to the board shot.
  { file: 'filtered.jpg', url: `${pageUrl}#/board?verdict=FARM`, scrollTo: '.filters' },
];

const browser = await puppeteer.launch({
  executablePath: '/opt/meta-chromium/chrome',
  headless: 'new',
  args: [
    '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--proxy-server=http://127.0.0.1:3129',
    '--disable-features=LocalNetworkAccessCheck,LocalNetworkAccessChecks',
    '--hatch-webgl-allowed-domains-file=/home/hatch/workspace/makefun/webgl-policy.txt',
    '--hatch-webgl-allowed-domains-sha256=546710f1443e52e43db1cff3a52fe65d1f24ac10d6f1e4abbdcdc79225893594',
  ],
});
try {
  for (const shot of shots) {
    // A fresh page per shot: a hash-only goto is a same-document navigation
    // and would not re-run the page's hash handling.
    const page = await browser.newPage();
    page.on('pageerror', (e) => process.stderr.write(`PAGEERROR ${shot.file}: ${e.message}\n`));
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(shot.url, { waitUntil: 'networkidle0', timeout: 60_000 });
    await new Promise((r) => setTimeout(r, 900));
    if (shot.scrollTo) await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView(), shot.scrollTo);
    await new Promise((r) => setTimeout(r, 300));
    const out = join(shotsDir, shot.file);
    let quality = startQuality;
    for (;;) {
      await page.screenshot({ path: out, type: 'jpeg', quality });
      const size = statSync(out).size;
      if (size <= MAX_BYTES || quality <= 50) {
        const info = await page.evaluate(() => ({
          rows: document.querySelectorAll('#board-body tr').length,
          detail: document.querySelector('#detail-card')?.hidden === false,
          count: document.querySelector('#row-count')?.textContent ?? '',
        }));
        process.stdout.write(`${shot.file}: ${size} bytes (quality ${quality}) :: rows=${info.rows} detail=${info.detail} count="${info.count}"\n`);
        if (size > MAX_BYTES) throw new Error(`${shot.file} is ${size} bytes, over the ${MAX_BYTES} cap even at quality ${quality}`);
        break;
      }
      quality -= 10;
    }
    await page.close();
  }
  process.stdout.write(`screenshots written to ${shotsDir}\n`);
} finally {
  await browser.close();
}
