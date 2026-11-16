# Token Radar — radar-3

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/charlyies/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/charlyies/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

The best token launch radar: which pre-token protocols a launch would be
worth, and what farming one costs. Built for make.fun's [`token-radar-01`](https://make.fun/bounty/token-radar-01)
($1,325, deadline 14 Dec 2026).

## The model

One sealed snapshot in, one ranked board out. The value is a single size
curve fitted on the snapshot's own traded tokens — log10(market cap)
regressed on log10(TVL) — with two dampers that only order near-ties: a
7-day growth damper (at most ±30%) and a maturity damper (at most +30% for
a protocol that has run three years with no token). The fit is tested
out of sample twice (time split and 5-fold cross-validation) and the
numbers are printed on the board: time-split median error ×3.25, against
×4.82 for the old per-category median multiple.

Every farm plan is priced in dollars — gas plus the opportunity cost of
the capital at 5% APR — against an expected value that assumes a 5%
farmer allocation split among 2,000 farmers. Net decides the verdict:
FARM above $200, THIN above $100, SKIP below. 234 rows: the 40 watchlist
slugs plus 194 early protocols the watchlist leaves out.

## The entry

- `main.ts` — reads `/input/snapshot.json`, writes `/output/board.json`,
  `/output/data.js`, copies `dashboard/` and `screenshots/`, and writes
  `/output/dossier.json` with the kit's `buildDossier`.
- `lib/model.ts` — the radar-3 model: fit, implied value, farm economics,
  farm plans, board build, snapshot validation.
- `dashboard/` — a static page (no network): sortable/filterable board,
  protocol detail with the full factor breakdown and economics, a live
  token view, the fit's scatter, and the methodology in plain words.
- `screenshots/` — the board, a protocol detail, and the board filtered
  to FARM, at 1280×900.
- `scripts/` — `shoot.mjs` (headless-Chromium screenshots) and
  `verify.mjs` (a local check of the scorer's seven gate rows).

Run it: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>`

## License

MIT — see `LICENSE`.
