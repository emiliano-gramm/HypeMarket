// Pure parimutuel odds + payout math. No I/O, no DB — unit-testable by hand.
// Mirrors the math documented in .project_utils/explanation.md §5.19.

import type { MarketStatus, Outcome } from "@/lib/markets/types";

export type OutcomePool = {
  optionKey: string;
  label: string;
  stakedTotal: number;
  backerCount: number;
};

/** Sum of all outcome pools (negative pools clamped to 0). */
export function computeTotalPool(pools: Pick<OutcomePool, "stakedTotal">[]): number {
  return pools.reduce((sum, p) => sum + Math.max(0, p.stakedTotal), 0);
}

/** implied_prob = staked_total / total_pool. Returns 0 when the pool is empty. */
export function impliedProbability(stakedTotal: number, totalPool: number): number {
  if (totalPool <= 0 || stakedTotal <= 0) return 0;
  return stakedTotal / totalPool;
}

/** decimal_odds = total_pool / staked_total (= 1 / implied_prob). 0 when undefined. */
export function decimalOdds(stakedTotal: number, totalPool: number): number {
  if (stakedTotal <= 0 || totalPool <= 0) return 0;
  return totalPool / stakedTotal;
}

/** Derive Outcome view models (with odds) from raw pool rows. */
export function computeOutcomes(pools: OutcomePool[]): Outcome[] {
  const totalPool = computeTotalPool(pools);
  return pools.map((p) => ({
    optionKey: p.optionKey,
    label: p.label,
    stakedTotal: p.stakedTotal,
    backerCount: p.backerCount,
    impliedProb: impliedProbability(p.stakedTotal, totalPool),
    decimalOdds: decimalOdds(p.stakedTotal, totalPool),
  }));
}

/**
 * UI payout preview at the CURRENT line: amount × decimal odds, floored.
 * This is indicative only — the real payout is parimutuel and depends on the
 * pools at resolution (see settlementPayout).
 */
export function payoutPreview(amount: number, decimalOddsValue: number): number {
  if (amount <= 0 || decimalOddsValue <= 0) return 0;
  return Math.floor(amount * decimalOddsValue);
}

/**
 * Parimutuel settlement payout for a single winning stake:
 *   payout = floor(stake.amount / winning_pool * total_pool)
 * Integer math (floor) avoids fractional-credit drift. Losers get 0.
 */
export function settlementPayout(
  stakeAmount: number,
  winningPool: number,
  totalPool: number
): number {
  if (stakeAmount <= 0 || winningPool <= 0 || totalPool <= 0) return 0;
  return Math.floor((stakeAmount / winningPool) * totalPool);
}

/**
 * Derive the live market status from DB state + current time:
 *  - resolved  → a winning outcome is recorded
 *  - locked    → status flagged closed, or locks_at has passed
 *  - open      → otherwise (staking allowed)
 */
export function deriveMarketStatus(args: {
  hasResolvedOutcome: boolean;
  locksAt: Date | string | null;
  dbStatus?: string | null;
  now?: Date;
}): MarketStatus {
  if (args.hasResolvedOutcome) return "resolved";

  if (args.dbStatus && args.dbStatus !== "open") return "locked";

  if (args.locksAt) {
    const locksAtMs =
      args.locksAt instanceof Date
        ? args.locksAt.getTime()
        : new Date(args.locksAt).getTime();
    const nowMs = (args.now ?? new Date()).getTime();
    if (Number.isFinite(locksAtMs) && nowMs >= locksAtMs) return "locked";
  }

  return "open";
}
