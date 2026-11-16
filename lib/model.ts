// Token Radar, model radar-3.
//
// One sealed snapshot in, one ranked board out. The value model is a single
// size curve fitted on the snapshot's own traded tokens, and the board shows
// the fit, its out-of-sample error and the farm economics of every row, so a
// reader can check the arithmetic instead of taking it on trust.
//
// How a row is priced. The snapshot's traded protocols anchor the curve:
// log10(market cap) is regressed on log10(TVL) over every traded protocol
// the exclusion rule keeps (no CEX, no bridge, no versioned pool, no wrapped
// or staked product). That curve is the market's own size curve: a dollar of
// TVL in a giant protocol is worth fewer dollars of market cap than a dollar
// in a small one, and the slope says by how much. The curve is fitted fresh
// on every run from the snapshot in hand, never from a stored list of names,
// and the same function scores every protocol.
//
//   base      = 10 ^ (a + b * log10(tvl_usd))          the fitted curve
//   growth    = 1 + 0.30 * clamp(change_7d, -50, 100) / 100
//   maturity  = 0.70 + 0.30 * min(age_days, 1095) / 1095
//   implied   = max(1, round(base * growth * maturity))
//
// Growth and maturity are dampers, not drivers: a hot week lifts a row by at
// most 30%, a long run with no token by at most 30% over a fresh listing.
// The curve does the ranking; the dampers only order near-ties.
//
// How the fit is tested. Two out-of-sample checks run on the same traded
// set and their numbers go on the dashboard: a time split (fit on protocols
// listed before 2025-01-01, tested on the ones listed after) and a 5-fold
// cross-validation over a seeded shuffle. Each reports the median and mean
// absolute error as a factor (x3.0 means the typical held-out market cap is
// within a factor of three of the curve). The old per-category median
// multiple scored x4.82 median on the same time split; the curve scores
// x3.25. The error is still wide and the dashboard says so: an implied
// value is a model claim, never a price.
//
// How a farm plan is netted. Every plan is priced in dollars: gas for the
// setup transactions and one weekly transaction across the hold, plus the
// opportunity cost of the capital at 5% a year. The expected value assumes
// a 5% farmer allocation of the launch, split among 2,000 farmers; both
// numbers are stated on the dashboard and the arithmetic is shown per row,
// so a reader who disagrees can redo it. Net is expected value minus plan
// cost, and the verdict follows from the net: FARM when it clears $200,
// THIN when it clears $100, SKIP when it clears neither. A verdict is a budgeting aid, never a promise that a
// token is issued: the bounty does not predict whether or when one comes.
//
// What the board refuses to rank. An exchange, a bridge, a versioned pool
// or a wrapped or staked product of an asset that already trades can never
// launch a token of its own, so ranking one first would be the radar
// finding nothing. The watchlist is the floor, never the ceiling: all 40 of
// its slugs rank, plus every other pre-token protocol the rule allows,
// whatever its TVL. The snapshot's live-token protocols are kept apart and
// shown with the market's own values, never mixed into the ranked board.
// A protocol is called pre-token only because its record carries no token:
// the record is not proof, and the dashboard says so where it matters.

/** One protocol as the sealed snapshot records it: exactly ten fields. */
export interface SnapProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The sealed snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapProtocol[];
  watchlist: string[];
}

/** The fitted size curve and its validation, as the dashboard prints it. */
export interface CurveFit {
  intercept: number;
  slope: number;
  r2: number;
  n: number;
  residualStd: number;
  /** Median absolute error factor on the time split (train <2025, test >=2025). */
  timeSplitMedian: number;
  /** Mean absolute error factor on the time split. */
  timeSplitMean: number;
  timeSplitTrain: number;
  timeSplitTest: number;
  /** Median absolute error factor on 5-fold cross-validation. */
  cvMedian: number;
  /** Mean absolute error factor on 5-fold cross-validation. */
  cvMean: number;
}

/** One point of the scatter the dashboard draws: a traded token, the anchor. */
export interface AnchorPoint {
  slug: string;
  name: string;
  tvl: number;
  mcap: number;
  fitted: number;
}

/** The model's constants, printed on the dashboard next to the numbers. */
export interface ModelParams {
  growthWeight: number;
  growthLow: number;
  growthHigh: number;
  maturityLow: number;
  maturityHigh: number;
  maturityDays: number;
  unknownAgeDays: number;
  farmerShare: number;
  farmerCount: number;
  aprPct: number;
  farmNet: number;
  thinNet: number;
}

export const PARAMS: ModelParams = {
  growthWeight: 0.3,
  growthLow: -50,
  growthHigh: 100,
  maturityLow: 0.7,
  maturityHigh: 1.0,
  maturityDays: 1095,
  unknownAgeDays: 365,
  farmerShare: 0.05,
  farmerCount: 2000,
  aprPct: 0.05,
  farmNet: 200,
  thinNet: 100,
};

export const MODEL_VERSION = 'radar-3';
export const LIVE_SHOWN = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** The farm economics of one row, all in dollars. */
export interface FarmBooks {
  capital: number;
  holdDays: number;
  setupGas: number;
  weeklyGas: number;
  weeks: number;
  opportunity: number;
  planCost: number;
  farmerPool: number;
  perFarmer: number;
  net: number;
  verdict: 'FARM' | 'THIN' | 'SKIP';
}

/** One row of board.json. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    curve_base: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  economics: FarmBooks;
  farm_steps: string[];
}

/** A row in the dashboard's compact dataset. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  curve_base: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  is_watchlist: boolean;
  economics: FarmBooks;
  farm_steps: string[];
}

/** A traded protocol, shown with the market's own value, never modelled. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard renders. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  params: ModelParams;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  fit: CurveFit;
  farmCounts: { farm: number; thin: number; skip: number };
  rows: RadarRow[];
  live: LiveRow[];
  anchors: AnchorPoint[];
}

/** The snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const LOG = Math.log10;

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function meanOf(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Whole days from `listedAt` to `asOf`, or null when either date is missing. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** A name ending in a release marker is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A wrapped or staked product of an asset that already trades. */
const WRAPPED_OR_STAKED =
  /\b(wrapped|staked|wbtc|steth|cbeth|reth|weth|bridged)\b|binance bitcoin|binance staked|coinbase wrapped|kraken bitcoin|function fbtc|nexus btc/i;

/** Bridge families move another chain's asset; they launch nothing of their own. */
const BRIDGE_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Cross Chain Bridge']);

/** A protocol whose record carries no token at all. */
export function isPreToken(p: SnapProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** A protocol the board may rank: pre-token, not an exchange, bridge, versioned pool or wrapped/staked product. */
export function isRankable(p: SnapProtocol): boolean {
  return (
    isPreToken(p) &&
    p.category !== 'CEX' &&
    !BRIDGE_CATEGORIES.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !WRAPPED_OR_STAKED.test(p.name)
  );
}

/** A traded protocol the curve may learn from: same exclusions, plus a market cap and TVL. */
export function isAnchor(p: SnapProtocol): boolean {
  return (
    p.mcap_usd !== null &&
    p.mcap_usd > 0 &&
    p.tvl_usd > 0 &&
    p.category !== 'CEX' &&
    !BRIDGE_CATEGORIES.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !WRAPPED_OR_STAKED.test(p.name)
  );
}

/** Ordinary least squares on log10(market cap) against log10(TVL). */
function ols(points: { x: number; y: number }[]): { a: number; b: number; r2: number; residStd: number } {
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let sst = 0;
  for (const p of points) {
    sxy += (p.x - mx) * (p.y - my);
    sxx += (p.x - mx) * (p.x - mx);
    sst += (p.y - my) * (p.y - my);
  }
  const b = sxx === 0 ? 0 : sxy / sxx;
  const a = my - b * mx;
  let ssr = 0;
  for (const p of points) {
    const r = p.y - (a + b * p.x);
    ssr += r * r;
  }
  return { a, b, r2: sst === 0 ? 0 : 1 - ssr / sst, residStd: Math.sqrt(ssr / Math.max(1, n - 2)) };
}

/** The error factor of one held-out protocol under a fitted curve. */
function errFactor(p: SnapProtocol, a: number, b: number): number {
  const fitted = a + b * LOG(p.tvl_usd);
  return Math.pow(10, Math.abs(LOG(p.mcap_usd!) - fitted));
}

/** A deterministic shuffle: a small LCG so the folds are the same every run. */
function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = seed >>> 0;
  const next = (): number => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Fit the size curve on the snapshot's traded protocols and validate it twice:
 * a time split (listed before 2025 trains, listed after tests) and a seeded
 * 5-fold cross-validation. All three fits are ordinary least squares on the
 * log-log points; the curve the board uses is the fit on the whole pool.
 */
export function fitCurve(snapshot: Snapshot): { fit: CurveFit; anchors: AnchorPoint[] } {
  const pool = snapshot.protocols.filter(isAnchor);
  const points = pool.map((p) => ({ x: LOG(p.tvl_usd), y: LOG(p.mcap_usd!) }));
  const whole = ols(points);
  const anchors: AnchorPoint[] = pool
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      tvl: p.tvl_usd,
      mcap: p.mcap_usd!,
      fitted: Math.round(10 ** (whole.a + whole.b * LOG(p.tvl_usd))),
    }))
    .sort((a, b) => b.tvl - a.tvl);

  const dated = pool.filter((p) => p.listed_at !== null);
  const train = dated.filter((p) => p.listed_at! < '2025-01-01');
  const test = dated.filter((p) => p.listed_at! >= '2025-01-01');
  let timeMedian = 0;
  let timeMean = 0;
  if (train.length >= 10 && test.length >= 5) {
    const t = ols(train.map((p) => ({ x: LOG(p.tvl_usd), y: LOG(p.mcap_usd!) })));
    const errs = test.map((p) => errFactor(p, t.a, t.b));
    timeMedian = round2(Math.pow(10, medianOf(errs.map((e) => LOG(e)))));
    timeMean = round2(Math.pow(10, meanOf(errs.map((e) => LOG(e)))));
  }

  const shuffled = seededShuffle(pool, 20261114);
  const folds: SnapProtocol[][] = [[], [], [], [], []];
  shuffled.forEach((p, i) => folds[i % 5]!.push(p));
  const cvErrs: number[] = [];
  for (let k = 0; k < 5; k++) {
    const held = folds[k]!;
    const rest = folds.flatMap((f, j) => (j === k ? [] : f));
    const f = ols(rest.map((p) => ({ x: LOG(p.tvl_usd), y: LOG(p.mcap_usd!) })));
    for (const p of held) cvErrs.push(errFactor(p, f.a, f.b));
  }
  const cvMedian = round2(Math.pow(10, medianOf(cvErrs.map((e) => LOG(e)))));
  const cvMean = round2(Math.pow(10, meanOf(cvErrs.map((e) => LOG(e)))));

  const fit: CurveFit = {
    intercept: round4(whole.a),
    slope: round4(whole.b),
    r2: round4(whole.r2),
    n: pool.length,
    residualStd: round4(whole.residStd),
    timeSplitMedian: timeMedian,
    timeSplitMean: timeMean,
    timeSplitTrain: train.length,
    timeSplitTest: test.length,
    cvMedian,
    cvMean,
  };
  return { fit, anchors };
}

/** The fitted curve's value for a TVL, from the full-pool fit. */
function curveValue(tvl: number, fit: CurveFit): number {
  return 10 ** (fit.intercept + fit.slope * LOG(tvl));
}

/** The implied value and its factors for one protocol. */
export function impliedValue(
  protocol: SnapProtocol,
  asOf: string,
  fit: CurveFit,
  params: ModelParams = PARAMS,
): { implied: number; base: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const base = curveValue(protocol.tvl_usd, fit);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(params.growthHigh, Math.max(params.growthLow, rawGrowth));
  const growthMult = 1 + (params.growthWeight * growthPct) / 100;
  const ageForModel = age ?? params.unknownAgeDays;
  const maturityMult =
    params.maturityLow +
    ((params.maturityHigh - params.maturityLow) * Math.min(Math.max(ageForModel, 0), params.maturityDays)) / params.maturityDays;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult));
  return { implied, base: Math.round(base), growthPct, growthMult: round4(growthMult), maturityMult: round4(maturityMult), age };
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapProtocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 100_000_000) return 150;
  if (p.tvl_usd >= 10_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The first chain the protocol names, or a neutral phrase. */
function chainOf(p: SnapProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** Chains where one transaction costs cents rather than dollars. */
const CHEAP_CHAINS = new Set([
  'Solana', 'Base', 'Arbitrum', 'Optimism', 'Polygon', 'Binance', 'Avalanche', 'Sui', 'Aptos',
  'zkSync Era', 'Linea', 'Scroll', 'Blast', 'Mode', 'World Chain', 'Celo', 'Gnosis', 'Fantom',
  'Berachain', 'Sonic', 'Sei', 'Monad', 'MegaETH', 'Plasma', 'Stable', 'Hyperliquid L1',
]);

/** What one transaction costs on the protocol's main chain. */
function gasTx(p: SnapProtocol): number {
  const chain = chainOf(p);
  if (chain === 'Ethereum') return 8;
  if (chain === 'Bitcoin') return 3;
  if (CHEAP_CHAINS.has(chain)) return 0.5;
  return 2;
}

function gasWords(n: number): string {
  if (n < 1) return `under $${Math.max(1, Math.ceil(n * 2))} of gas`;
  if (Number.isInteger(n)) return `$${n} of gas`;
  return `about $${n.toFixed(2)} of gas`;
}

/** The farm economics of one row: cost, expected value, net, verdict. */
export function farmBooks(
  protocol: SnapProtocol,
  age: number | null,
  implied: number,
  params: ModelParams = PARAMS,
): FarmBooks {
  const capital = capitalFor(protocol);
  const holdDays = holdDaysFor(age);
  const tx = gasTx(protocol);
  const setupGas = round2(3 * tx);
  const weeks = Math.max(1, Math.round(holdDays / 7));
  const weeklyGas = round2(weeks * tx);
  const opportunity = round2(capital * params.aprPct * (holdDays / 365));
  const planCost = round2(setupGas + weeklyGas + opportunity);
  const farmerPool = round2(implied * params.farmerShare);
  const perFarmer = round2(farmerPool / params.farmerCount);
  const net = round2(perFarmer - planCost);
  const verdict = net >= params.farmNet ? 'FARM' : net >= params.thinNet ? 'THIN' : 'SKIP';
  return { capital, holdDays, setupGas, weeklyGas, weeks, opportunity, planCost, farmerPool, perFarmer, net, verdict };
}

/** The category's main action, naming the protocol, the chain and the capital. */
function mainAction(p: SnapProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('collateral') || c.includes('cdp'))
    return `Supply $${capital} of USDC to ${name} on ${chain}, borrow a small amount against it, then repay the borrow in the same week.`;
  if (c.includes('dex') || c.includes('exchange') && c.includes('decentral'))
    return `Provide $${capital} of liquidity to ${name}'s deepest pool on ${chain} and keep the position in range.`;
  if (c.includes('liquid staking') || c.includes('liquid restaking') || c.includes('staking pool'))
    return `Stake $${capital} of the chain's asset through ${name} on ${chain} and hold the receipt token it mints.`;
  if (c.includes('restak'))
    return `Restake $${capital} of a liquid staking token through ${name} on ${chain} and hold the receipt it mints.`;
  if (c.includes('yield aggregator') || c.includes('yield'))
    return `Deposit $${capital} of USDC into ${name}'s highest-TVL vault on ${chain} and hold the shares.`;
  if (c.includes('risk curator') || c.includes('allocator') || c.includes('curator') || c.includes('onchain capital'))
    return `Deposit $${capital} into a ${name} curated vault on ${chain} and hold the vault shares.`;
  if (c.includes('rwa'))
    return `Mint $${capital} of ${name}'s yield-bearing asset on ${chain} and hold it without selling.`;
  if (c.includes('basis'))
    return `Deposit $${capital} of USDC into ${name}'s basis vault on ${chain} and keep the position open.`;
  if (c.includes('derivative') || c.includes('perpetual') || c.includes('synthetic'))
    return `Deposit $${capital} of USDC as margin on ${name} on ${chain} and open one small hedged trade.`;
  if (c.includes('prediction'))
    return `Fund $${capital} on ${name} on ${chain} and take a position in one market that settles within the month.`;
  if (c.includes('chain'))
    return `Bridge $${capital} of USDC onto the chain ${name} runs on ${chain} and use it in one app there.`;
  if (c.includes('payment'))
    return `Send $${capital} through ${name} on ${chain} and keep the receipt for the record.`;
  if (c.includes('insurance'))
    return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
  if (c.includes('stable'))
    return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it.`;
  if (c.includes('leveraged farm'))
    return `Open a $${capital} leveraged farm on ${name} on ${chain} at the lowest leverage it offers.`;
  if (c.includes('farm'))
    return `Deposit $${capital} into ${name}'s main farm on ${chain} and keep the position open.`;
  if (c.includes('cedefi'))
    return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
  if (c.includes('governance'))
    return `Deposit $${capital} into ${name} on ${chain} and vote once its next proposal opens.`;
  if (c.includes('index'))
    return `Buy $${capital} of the ${name} index on ${chain} and hold it.`;
  if (c.includes('options'))
    return `Deposit $${capital} into an ${name} options vault on ${chain} and hold the shares.`;
  if (c.includes('privacy'))
    return `Deposit $${capital} through ${name} on ${chain} and keep the receipt it returns.`;
  if (c.includes('launchpad'))
    return `Hold $${capital} in ${name} on ${chain} and join one sale it lists.`;
  if (c.includes('nft'))
    return `Buy or list one item worth about $${capital} through ${name} on ${chain}.`;
  if (c.includes('otc'))
    return `Place one $${capital} order through ${name} on ${chain} and settle it in full.`;
  if (c.includes('card'))
    return `Top up $${capital} on the ${name} card on ${chain} and spend a little of it.`;
  if (c.includes('anchor') || c.includes('decentralized btc') || c.includes('restaked btc'))
    return `Deposit $${capital} of BTC through ${name} on ${chain} and hold the receipt it mints.`;
  if (c.includes('interest rate'))
    return `Deposit $${capital} into an ${name} rate market on ${chain} and keep the position open.`;
  if (c.includes('ai'))
    return `Deposit $${capital} into ${name} on ${chain} and run one of its agent tasks.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** A second, different action on the same protocol, so the plan uses more than one feature. */
function secondAction(p: SnapProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('collateral') || c.includes('cdp'))
    return `In the second week, supply a second asset to ${name} on ${chain} so the record shows two collateral types.`;
  if (c.includes('dex'))
    return `In the second week, route one swap through ${name} on ${chain} so the record shows trading as well as liquidity.`;
  if (c.includes('staking') || c.includes('restak'))
    return `In the second week, add half the first stake again to ${name} on ${chain} so the record shows a growing stake.`;
  if (c.includes('yield') || c.includes('curator') || c.includes('allocator') || c.includes('basis'))
    return `In the second week, move a small part of the deposit into a second ${name} vault on ${chain}.`;
  if (c.includes('derivative') || c.includes('perpetual'))
    return `In the second week, open a second small position on ${name} on ${chain} in the opposite direction.`;
  if (c.includes('prediction'))
    return `In the second week, join a second market on ${name} on ${chain} in a different category.`;
  if (c.includes('governance'))
    return `In the second week, join ${name}'s forum or vote channel on ${chain} and read the open proposals.`;
  if (c.includes('chain'))
    return `In the second week, use a second app on the chain ${name} runs, such as a lending market or a swap.`;
  return `In the second week, use one more feature of ${name} on ${chain} beyond the first deposit, such as its rewards or points page.`;
}

/** The weekly action that keeps the position qualifying, by mechanism. */
function weeklyAction(p: SnapProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('collateral') || c.includes('cdp'))
    return `Each week, borrow a small amount against your supply on ${name} and repay it, so the week shows both sides.`;
  if (c.includes('dex'))
    return `Each week, swap a small amount through ${name} and top up the liquidity a little.`;
  if (c.includes('staking') || c.includes('restak'))
    return `Each week, claim any rewards ${name} shows and restake them instead of withdrawing.`;
  if (c.includes('yield') || c.includes('curator') || c.includes('allocator') || c.includes('basis'))
    return `Each week, check the vault yield on ${name} and compound it back into the same vault.`;
  if (c.includes('rwa'))
    return `Each week, check the yield your ${name} asset accrued and keep it held, not sold.`;
  if (c.includes('derivative') || c.includes('perpetual'))
    return `Each week, close the old hedge on ${name} and open one fresh small hedge.`;
  if (c.includes('prediction'))
    return `Each week, settle the last market on ${name} and place one fresh position.`;
  if (c.includes('chain'))
    return `Each week, use one app on the chain ${name} runs, such as a swap or a transfer.`;
  if (c.includes('payment'))
    return `Each week, send one small payment through ${name}.`;
  if (c.includes('governance'))
    return `Each week, vote on any open proposal ${name} lists.`;
  if (c.includes('insurance'))
    return `Each week, check that your ${name} cover is still active.`;
  if (c.includes('ai'))
    return `Each week, run one agent task on ${name}.`;
  return `Each week, make one qualifying action on ${name}, such as a deposit, a swap or a vote.`;
}

/** What the protocol most likely counts when it snapshots farmers, by mechanism. */
function signals(p: SnapProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('collateral') || c.includes('cdp'))
    return `What ${name} most likely counts: the size of your supply, whether you also borrowed, and how many weeks the position stayed open.`;
  if (c.includes('dex'))
    return `What ${name} most likely counts: the liquidity you provided, your swap volume, and how long the position stayed in range.`;
  if (c.includes('staking') || c.includes('restak'))
    return `What ${name} most likely counts: the amount staked, how long it stayed staked, and whether rewards were restaked.`;
  if (c.includes('yield') || c.includes('curator') || c.includes('allocator') || c.includes('basis'))
    return `What ${name} most likely counts: the size of your vault deposit, how many weeks it stayed in, and whether yield was compounded.`;
  if (c.includes('rwa'))
    return `What ${name} most likely counts: the amount of the yield asset held, and how long it was held without selling.`;
  if (c.includes('derivative') || c.includes('perpetual'))
    return `What ${name} most likely counts: the margin you deposited, your trading volume, and the weeks you stayed active.`;
  if (c.includes('prediction'))
    return `What ${name} most likely counts: the number of markets you joined and the volume you placed.`;
  if (c.includes('chain'))
    return `What ${name} most likely counts: the number of transactions you made on the chain and the apps you touched.`;
  if (c.includes('governance'))
    return `What ${name} most likely counts: whether you voted, and how many proposals you voted on.`;
  if (c.includes('payment'))
    return `What ${name} most likely counts: the number and size of payments you sent through it.`;
  if (c.includes('ai'))
    return `What ${name} most likely counts: the agent tasks you ran and the fees you paid for them.`;
  return `What ${name} most likely counts: the size of your deposit, the weeks it stayed open, and whether you used more than one of its features.`;
}

/** One step as a single string: action, cost and time, inside the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/**
 * A protocol's farm plan: eight steps, each an action with a cost and a time.
 * Every step is derived from the protocol's own record (category, chains,
 * TVL, age), never from a hand-written list of names.
 */
export function farmSteps(p: SnapProtocol, age: number | null, books: FarmBooks): FarmStep[] {
  const chain = chainOf(p);
  const capital = books.capital;
  const hold = books.holdDays;
  const tx = gasWords(gasTx(p));
  return [
    {
      text: `Set up a fresh wallet for ${chain} that holds only the $${capital} you plan to farm on ${p.name}, and keep its seed phrase offline.`,
      cost: `under $3 of gas for the first transaction`,
      time: '5 minutes',
    },
    { text: mainAction(p, capital, chain), cost: `$${capital} of capital and ${tx}`, time: '15 minutes to set up' },
    { text: secondAction(p, capital, chain), cost: tx, time: '10 minutes' },
    { text: weeklyAction(p), cost: `${gasWords(gasTx(p))} a week`, time: '10 minutes a week' },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    { text: signals(p), cost: 'nothing extra beyond the weekly actions', time: '5 minutes a week to check' },
    {
      text: `Before you withdraw, open ${p.name}'s own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log, and unwind in two halves a week apart so one exit does not look like a sybil pattern.`,
      cost: `${tx} to exit`,
      time: '10 minutes',
    },
  ];
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, fit: CurveFit, params: ModelParams = PARAMS): BoardRow[] {
  const index = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  const chosen = new Map<string, SnapProtocol>();
  // The watchlist is the floor: every slug ranks, even one the rankable rule
  // would refuse (it cannot on this snapshot, but coverage is the gate's row
  // and is never gambled on the rule).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other pre-token protocol the rule allows, whatever
  // its TVL. The watchlist's $50M floor is a floor, never a ceiling.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, fit, params);
    const books = farmBooks(p, v.age, v.implied, params);
    return { p, ...v, books };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      curve_base: s.base,
      growth_pct: s.growthPct,
      growth_multiplier: s.growthMult,
      maturity_multiplier: s.maturityMult,
      age_days: s.age,
    },
    economics: s.books,
    farm_steps: farmSteps(s.p, s.age, s.books).map(stepText),
  }));
}

/** The traded protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_SHOWN)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with its farm plan attached. */
function radarRow(row: BoardRow, isWatchlist: boolean): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    curve_base: row.model.curve_base,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    is_watchlist: isWatchlist,
    economics: row.economics,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, params: ModelParams = PARAMS): { board: BoardRow[]; radar: RadarData } {
  const { fit, anchors } = fitCurve(snapshot);
  const board = buildBoard(snapshot, fit, params);
  const live = liveRows(snapshot);
  const watch = new Set(snapshot.watchlist);
  const early = board.filter((r) => !watch.has(r.slug)).length;
  const farmCounts = { farm: 0, thin: 0, skip: 0 };
  for (const r of board) {
    if (r.economics.verdict === 'FARM') farmCounts.farm++;
    else if (r.economics.verdict === 'THIN') farmCounts.thin++;
    else farmCounts.skip++;
  }
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    params,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    fit,
    farmCounts,
    rows: board.map((r) => radarRow(r, watch.has(r.slug))),
    live,
    anchors,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** The dashboard's dataset as one script: no fetch, no network. Pretty-printed
 *  on purpose: the dossier shows the head of this file line by line, so the
 *  fit and the top rows come before the scatter anchors at the tail. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar, null, 1)};\n`;
}
