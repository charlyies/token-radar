[![Token Radar](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![Rank](https://make.fun/badge/token-radar-01/charlyies/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01)
[![Reward](https://make.fun/badge/token-radar-01/charlyies/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01)

# Token Radar

Which pre-token protocol is worth farming next, and what do I do about it?

Token Radar reads a sealed snapshot of the protocol universe (DefiLlama protocol index,
758 protocols as of 2026-11-14), ranks every pre-token protocol by an implied value, and
shows a reader how to farm each one. The board covers all 40 protocols on the snapshot's
watchlist and adds 203 more pre-token protocols below the watchlist's $50M TVL floor —
every one the rule allows.

## The model (radar-2)

```
implied = round( tvl_usd x categoryMultiple(category)
                 x (1 + clamp(change_7d, -60, 120) / 100 x 0.5)
                 x (0.6 + min(age_days, 1095) / 1095 x 0.4) )
```

The category multiple is the market speaking: the median market-cap-to-TVL ratio of that
category's live-token protocols in this same snapshot, each ratio winsorised to [0.01, 3.0],
shrunk toward the global median (0.25x) with a prior weight of 3 comps, clamped to
[0.05, 1.5]. A category with no live comps takes the global median. No protocol name is
ever special-cased: the same function scores every row, and the dashboard prints the
calibration table the snapshot produced.

The board refuses to rank what can never launch a token: exchanges, bridges, and wrapped
or staked products of an asset that already trades (WBTC, Binance staked ETH and their
kind — 46 protocols on this snapshot, the largest a $7.9B wrapped-bitcoin product).
Live-token protocols are set aside with their market caps shown, never mixed into the
ranking.

## The farm plan

Every row carries a seven-step farm plan derived from the protocol's own record
(category, chains, TVL, age): a fresh wallet, the category's action with a capital sized
to the protocol's TVL, a weekly qualifying action, a hold sized to the protocol's age,
what the protocol most likely counts when it snapshots farmers, how to claim safely,
and an exit plan. Every step states what it costs and how long it takes.

## The dashboard

A static page, no framework and no network: `dashboard/` reads `data.js` beside it.
Sortable and filterable (search, category, chain, watchlist-only), a detail view for
every protocol with the model's full breakdown and its farm plan, and a live-token view
whose market-cap-to-TVL ratios are the calibration the board is priced from. The page
recomputes each row's implied value from the snapshot figures and checks it against the
number `board.json` carries.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input path/to/snapshot.json
```

`main.ts` (Node 22, standard library only) writes `board.json`, `data.js`, `dashboard/`,
`screenshots/` and `dossier.json` to the output directory.

## Entry

Built for the [token-radar-01 bounty](https://make.fun/bounty/token-radar-01) on
[make.fun](https://make.fun).
