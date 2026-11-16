// The token radar's model, version radar-2: one snapshot of the protocol universe in, one ranked
// board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and every
// other pre-token protocol the radar can honestly rank: the early rows the radar exists to find.
// A protocol is pre-token when its index entry records no token (no market cap, no CoinGecko id,
// no symbol). The snapshot's live-token protocols are kept apart and shown as the market's own
// values, never mixed into the ranked board.
//
// What the board refuses to rank, and why: an exchange, a bridge or a wrapped or staked product
// of an asset that already trades can never launch a token of its own, so ranking one first would
// be the radar finding nothing. The starter's rule stopped at exchanges and versioned pool names;
// radar-2 also refuses bridge families (Bridge, Canonical Bridge, Cross Chain Bridge) and names
// that say wrapped or staked (WBTC, Binance staked ETH, Coinbase Wrapped Staked ETH and their
// kind). On this snapshot that removes 46 protocols the starter's rule would have ranked, the
// largest a $7.9B wrapped-bitcoin product; every one of the 40 watchlist slugs still ranks.
//
// Implied value follows only from the snapshot's own figures, in four factors:
//
//   category multiple = the market's own price for this kind of protocol, calibrated from the
//     snapshot's live-token protocols: for each category, the median market-cap-to-TVL ratio of
//     its live protocols (each ratio winsorised to [0.01, 3.0] first, so one outlier cannot set
//     a category), shrunk toward the global median with a prior weight of 3 comps, then clamped
//     to [0.05, 1.5]. A category with no live comps at all takes the global median. No protocol
//     name is ever special-cased: the same function scores every row, and the dashboard prints
//     the calibration table the snapshot produced, category by category.
//   base       = tvl_usd x category multiple
//   growth     = clamp(change_7d, -60, 120) per cent
//   growthMult = 1 + (growth / 100) x GROWTH_WEIGHT
//   maturity   = 0.6 + min(age_days, 1095) / 1095 x 0.4   (age_days unknown: 365)
//   implied    = max(1, round(base x growthMult x maturity))
//
// The three factors are the ones the bounty names: the protocol's TVL, its seven-day growth, and
// how long it has run with no token. The category multiple is the refinement: a dollar of TVL in
// a DEX is not priced like a dollar of TVL in a liquid-staking protocol, and the snapshot's own
// live market says by how much. On this snapshot the global median is 0.25x, Lending calibrates
// to 0.16x, Dexs to 0.31x, Liquid Staking to 0.10x and RWA to 0.27x.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
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

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  winsor_low: number;
  winsor_high: number;
  shrink_comps: number;
  multiple_floor: number;
  multiple_cap: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  winsor_low: 0.01,
  winsor_high: 3.0,
  shrink_comps: 3,
  multiple_floor: 0.05,
  multiple_cap: 1.5,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-2';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** One row of the calibration table the snapshot produced. */
export interface CalibrationEntry {
  category: string;
  comps: number;
  multiple: number;
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
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
    category_multiple: number;
    category_comps: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with its farm plan attached. */
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
  category_multiple: number;
  category_comps: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  is_watchlist: boolean;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, the calibration, and the model. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  global_multiple: number;
  calibration: CalibrationEntry[];
  /** Every live-token protocol the calibration reads, so the page can recompute it. */
  calibration_live: { category: string | null; tvl_usd: number; mcap_usd: number }[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a sorted array, or `fallback` when it is empty. */
function medianOf(sorted: number[], fallback: number): number {
  if (sorted.length === 0) return fallback;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/**
 * The category multiples the snapshot's own live market calibrates, and the global median they
 * shrink toward. Only live-token protocols with a positive market cap and TVL count, and never an
 * exchange: a CEX's "TVL" is customer balances, not protocol value, and its ratio would poison
 * every category it touched.
 */
export function calibrateMultiples(snapshot: Snapshot, model: ModelConstants = MODEL): { byCategory: Map<string, number>; comps: Map<string, number>; global: number; table: CalibrationEntry[] } {
  const live = snapshot.protocols.filter(
    (p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0 && p.category !== 'CEX',
  );
  const winsor = (r: number): number => Math.min(model.winsor_high, Math.max(model.winsor_low, r));
  const all = live.map((p) => winsor(p.mcap_usd! / p.tvl_usd)).sort((a, b) => a - b);
  const global = medianOf(all, 0.25);
  const byCat = new Map<string, number[]>();
  for (const p of live) {
    const list = byCat.get(p.category ?? 'Other') ?? [];
    list.push(winsor(p.mcap_usd! / p.tvl_usd));
    byCat.set(p.category ?? 'Other', list);
  }
  const byCategory = new Map<string, number>();
  const comps = new Map<string, number>();
  const table: CalibrationEntry[] = [];
  for (const [cat, ratios] of [...byCat.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    ratios.sort((a, b) => a - b);
    const med = medianOf(ratios, global);
    const shrunk = (ratios.length * med + model.shrink_comps * global) / (ratios.length + model.shrink_comps);
    const multiple = Math.min(model.multiple_cap, Math.max(model.multiple_floor, shrunk));
    byCategory.set(cat, multiple);
    comps.set(cat, ratios.length);
    table.push({ category: cat, comps: ratios.length, multiple: round4(multiple) });
  }
  return { byCategory, comps, global, table };
}

/** A category's multiple from the calibration, or the global median when it has no live comps. */
export function categoryMultiple(category: string | null, cal: { byCategory: Map<string, number>; global: number }): number {
  return cal.byCategory.get(category ?? 'Other') ?? cal.global;
}

/** The four factors and the implied value one protocol gets under `model` and `cal`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  cal: { byCategory: Map<string, number>; comps: Map<string, number>; global: number },
  model: ModelConstants = MODEL,
): { implied: number; catMult: number; catComps: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const catMult = categoryMultiple(protocol.category, cal);
  const catComps = cal.comps.get(protocol.category ?? 'Other') ?? 0;
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const base = protocol.tvl_usd * catMult;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult));
  return { implied, catMult, catComps, growthPct, growthMult, maturityMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A wrapped or staked product of an asset that already trades: it can never launch a token. */
const WRAPPED_OR_STAKED = /\b(wrapped|staked|wbtc|steth|cbeth|reth|weth|bridged)\b|binance bitcoin|binance staked|coinbase wrapped|kraken bitcoin|function fbtc|nexus btc/i;

/** Bridge families: a bridge moves another chain's asset, it does not launch a token of its own. */
const BRIDGE_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Cross Chain Bridge']);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token, not an exchange, not a bridge, not a
 * versioned pool, and not a wrapped or staked product of an asset that already trades.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    p.category !== 'CEX' &&
    !BRIDGE_CATEGORIES.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !WRAPPED_OR_STAKED.test(p.name)
  );
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const cal = calibrateMultiples(snapshot, model);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the rankable rule would refuse (it cannot on
  // this snapshot, but the board's coverage is the gate's row and is never gambled on the rule).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other pre-token protocol the rule allows, whatever its TVL. The
  // watchlist's $50M floor is a floor, never a ceiling: the radar exists to find the early ones.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, cal, model);
    return { p, ...v };
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
      category_multiple: round4(s.catMult),
      category_comps: s.catComps,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** Chains where a transaction costs cents rather than dollars. */
const CHEAP_CHAINS = new Set([
  'Solana', 'Base', 'Arbitrum', 'Optimism', 'Polygon', 'Binance', 'Avalanche', 'Sui', 'Aptos',
  'zkSync Era', 'Linea', 'Scroll', 'Blast', 'Mode', 'World Chain', 'Celo', 'Gnosis', 'Fantom',
  'Berachain', 'Sonic', 'Sei', 'Monad', 'MegaETH', 'Plasma', 'Stable', 'Hyperliquid L1',
]);

/** What one transaction costs on the protocol's main chain, in the words a farmer can budget. */
function gasFor(p: SnapshotProtocol): { tx: string; week: string } {
  const chain = chainOf(p);
  if (chain === 'Ethereum') return { tx: 'about $8 of gas', week: 'about $5 of gas a week' };
  if (chain === 'Bitcoin') return { tx: 'about $3 of gas', week: 'about $2 of gas a week' };
  if (CHEAP_CHAINS.has(chain)) return { tx: 'under $0.50 of gas', week: 'under $1 of gas a week' };
  return { tx: 'about $2 of gas', week: 'about $1 of gas a week' };
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('collateral') || c.includes('cdp')) return `Supply $${capital} of USDC to ${name} on ${chain} and borrow a small amount against it, then repay the borrow.`;
  if (c.includes('dex')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('liquid staking') || c.includes('liquid restaking') || c.includes('staking pool')) return `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and keep the receipt token.`;
  if (c.includes('restak')) return `Restake $${capital} of the liquid staking token through ${name} on ${chain} and keep the receipt.`;
  if (c.includes('yield aggregator') || c.includes('yield')) return `Deposit $${capital} of USDC into ${name}'s highest-TVL vault on ${chain} and keep the shares.`;
  if (c.includes('risk curator') || c.includes('allocator') || c.includes('curator')) return `Deposit $${capital} into a ${name} curated vault on ${chain} and keep the shares.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield-bearing asset on ${chain} and hold it.`;
  if (c.includes('basis')) return `Deposit $${capital} of USDC into ${name}'s basis vault on ${chain} and keep the position open.`;
  if (c.includes('derivative') || c.includes('perpetual')) return `Deposit $${capital} of USDC as margin on ${name} on ${chain} and open one small hedged trade.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name} on ${chain}.`;
  if (c.includes('chain')) return `Bridge $${capital} of USDC onto ${name} and use it in one app on the chain.`;
  if (c.includes('payment')) return `Send $${capital} through ${name} on ${chain} and keep the receipt.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('leveraged farm')) return `Open a $${capital} leveraged farm on ${name} on ${chain} at the lowest leverage it offers.`;
  if (c.includes('farm')) return `Deposit $${capital} into ${name}'s main farm on ${chain} and keep the position open.`;
  if (c.includes('cedefi')) return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
  if (c.includes('governance')) return `Deposit $${capital} into ${name} on ${chain} and vote once its next proposal opens.`;
  if (c.includes('index')) return `Buy $${capital} of the ${name} index on ${chain} and hold it.`;
  if (c.includes('options')) return `Deposit $${capital} into an ${name} options vault on ${chain} and keep the shares.`;
  if (c.includes('privacy')) return `Deposit $${capital} through ${name} on ${chain} and keep the receipt.`;
  if (c.includes('launchpad')) return `Hold $${capital} in ${name} on ${chain} and join one sale it lists.`;
  if (c.includes('nft')) return `List or buy one item through ${name} on ${chain} for about $${capital}.`;
  if (c.includes('otc')) return `Place one $${capital} order through ${name} on ${chain} and settle it.`;
  if (c.includes('card')) return `Top up $${capital} on the ${name} card on ${chain} and spend a little of it.`;
  if (c.includes('anchor') || c.includes('decentralized btc') || c.includes('restaked btc')) return `Deposit $${capital} of BTC through ${name} on ${chain} and keep the receipt.`;
  if (c.includes('interest rate')) return `Deposit $${capital} into an ${name} rate market on ${chain} and keep the position open.`;
  if (c.includes('ai')) return `Deposit $${capital} into ${name} on ${chain} and run one of its agents once.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The weekly action that keeps the position qualifying, by category. */
function weeklyFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('collateral') || c.includes('cdp')) return `Borrow a small amount against your supply and repay it, so the week shows both sides of ${name}.`;
  if (c.includes('dex')) return `Swap a small amount through ${name}'s main pool and top up the liquidity a little.`;
  if (c.includes('staking') || c.includes('restak')) return `Claim any staking rewards ${name} shows and restake them instead of withdrawing.`;
  if (c.includes('yield') || c.includes('curator') || c.includes('allocator') || c.includes('basis')) return `Check the vault's yield on ${name} and compound it back into the same vault.`;
  if (c.includes('rwa')) return `Check the yield your ${name} asset accrued and keep it held, not sold.`;
  if (c.includes('derivative') || c.includes('perpetual')) return `Close the week's hedge on ${name} and open one fresh small hedge.`;
  if (c.includes('prediction')) return `Settle last week's market on ${name} and place one fresh position.`;
  if (c.includes('chain')) return `Use one app on ${name} each week, such as a swap or a transfer.`;
  if (c.includes('payment')) return `Send one small payment through ${name} each week.`;
  if (c.includes('governance')) return `Vote on any open proposal ${name} lists, and check for a new one weekly.`;
  if (c.includes('insurance')) return `Check that your ${name} cover is still active and top it up if it lapsed.`;
  if (c.includes('ai')) return `Run one agent task on ${name} each week.`;
  return `Make one qualifying action each week on ${name}, such as a deposit, a swap or a vote.`;
}

/** What the protocol most likely counts when it snapshots farmers, by category. */
function signalsFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('collateral') || c.includes('cdp')) return `What ${name} most likely counts: the size of your supply, whether you also borrowed, and how many weeks the position stayed open.`;
  if (c.includes('dex')) return `What ${name} most likely counts: the liquidity you provided, your swap volume, and how long the position stayed in range.`;
  if (c.includes('staking') || c.includes('restak')) return `What ${name} most likely counts: the amount staked, how long it stayed staked, and whether rewards were restaked.`;
  if (c.includes('yield') || c.includes('curator') || c.includes('allocator') || c.includes('basis')) return `What ${name} most likely counts: the size of your vault deposit, how many weeks it stayed in, and whether yield was compounded.`;
  if (c.includes('rwa')) return `What ${name} most likely counts: the amount of the yield asset held, and how long it was held without selling.`;
  if (c.includes('derivative') || c.includes('perpetual')) return `What ${name} most likely counts: the margin you deposited, your trading volume, and the weeks you stayed active.`;
  if (c.includes('prediction')) return `What ${name} most likely counts: the number of markets you joined and the volume you placed.`;
  if (c.includes('chain')) return `What ${name} most likely counts: the number of transactions you made on the chain and the apps you touched.`;
  if (c.includes('governance')) return `What ${name} most likely counts: whether you voted, and how many proposals you voted on.`;
  if (c.includes('payment')) return `What ${name} most likely counts: the number and size of payments you sent through it.`;
  if (c.includes('ai')) return `What ${name} most likely counts: the agent tasks you ran and the fees you paid for them.`;
  return `What ${name} most likely counts: the size of your deposit, the weeks it stayed open, and whether you used more than one of its features.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of
 * names. Every step carries what it costs and how long it takes, because a plan without a price
 * is a slogan.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasFor(p);
  const action = actionFor(p, capital, chain);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and ${gas.tx}`,
      time: '15 minutes to set up',
    },
    {
      text: weeklyFor(p),
      cost: gas.week,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: signalsFor(p),
      cost: 'nothing extra beyond the weekly actions',
      time: '5 minutes a week to check',
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log, and unwind in two halves a week apart so one exit does not look like a sybil pattern.`,
      cost: gas.tx + ' to exit',
      time: '10 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
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
export function radarRow(row: BoardRow, isWatchlist: boolean): RadarRow {
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
    category_multiple: row.model.category_multiple,
    category_comps: row.model.category_comps,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    is_watchlist: isWatchlist,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const cal = calibrateMultiples(snapshot, model);
  const live = liveRows(snapshot);
  const watch = new Set(snapshot.watchlist);
  const early = board.filter((r) => !watch.has(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    global_multiple: round4(cal.global),
    calibration: cal.table,
    calibration_live: snapshot.protocols
      .filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0 && p.category !== 'CEX')
      .map((p) => ({ category: p.category, tvl_usd: p.tvl_usd, mcap_usd: p.mcap_usd! })),
    rows: board.map((r) => radarRow(r, watch.has(r.slug))),
    live,
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

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
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

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
