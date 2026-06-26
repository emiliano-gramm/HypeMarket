// HypeMarket prediction-market types (Updated Idea / Phase 1).
// A market reuses the poll tables: a poll = market, options = outcomes,
// vote_shards.staked_amount = pool slices, poll_totals.staked_total = the pool.

export type MarketStatus = "open" | "locked" | "resolved";

export type Outcome = {
  optionKey: string;
  label: string;
  /** Pool credits backing this outcome (includes the house float). */
  stakedTotal: number;
  /** Number of stakes backing this outcome (reuses per-shard vote_count). */
  backerCount: number;
  /** stakedTotal / totalPool, in [0, 1]. */
  impliedProb: number;
  /** Decimal odds = totalPool / stakedTotal (1 / impliedProb). */
  decimalOdds: number;
};

export type MarketState = {
  marketId: string;
  matchId: string;
  question: string;
  /** "binary" | "multi" */
  marketType: string;
  status: MarketStatus;
  locksAt: string | null;
  resolvedOptionKey: string | null;
  resolvedAt: string | null;
  /** Sum of every outcome's stakedTotal. */
  totalPool: number;
  outcomes: Outcome[];
  /** When poll_totals was last materialized (null if never aggregated). */
  aggregatedAt: string | null;
};

export type Wallet = {
  externalId: string;
  balance: number;
  updatedAt: string | null;
};

export type ViewerPosition = {
  optionKey: string;
  label: string;
  /** Total credits this viewer staked on the outcome. */
  amount: number;
  /** How many separate stakes the viewer placed on the outcome. */
  stakeCount: number;
  /** Settled payout total (0 until resolution). */
  payout: number;
  /** True when every stake on this outcome has been settled. */
  settled: boolean;
};

export type StakeErrorCode =
  | "market_closed"
  | "market_locked"
  | "invalid_option"
  | "invalid_amount"
  | "insufficient_funds"
  | "invalid_viewer"
  | "error";

export type StakeResult =
  | { ok: true; wallet: Wallet }
  | { ok: false; code: StakeErrorCode; message: string };

export type GetMarketStateResult =
  | { ok: true; state: MarketState }
  | { ok: false; message: string };

export type GetWalletResult =
  | { ok: true; wallet: Wallet }
  | { ok: false; message: string };

export type GetViewerPositionsResult =
  | { ok: true; positions: ViewerPosition[] }
  | { ok: false; message: string };

// --- Phase 3: lock / resolve / parimutuel settlement -----------------------

export type AdminErrorCode =
  | "unauthorized"
  | "not_configured"
  | "market_not_found"
  | "invalid_option"
  | "already_resolved"
  | "error";

/** Outcome of a parimutuel settlement run (idempotent). */
export type SettlementSummary = {
  marketId: string;
  winningOptionKey: string;
  winningLabel: string;
  /** Ground-truth pools (sum of shard staked_amount) at resolution. */
  winningPool: number;
  totalPool: number;
  /** Distinct winning viewers credited in this run. */
  winnersPaid: number;
  /** Stakes marked settled in this run (winners + losers). */
  stakesSettled: number;
  /** Total Hype Credits paid out in this run. */
  creditsPaidOut: number;
  /** True when the market was already resolved before this call (no double pay). */
  alreadyResolved: boolean;
};

export type ResolveResult =
  | { ok: true; summary: SettlementSummary }
  | { ok: false; code: AdminErrorCode; message: string };

export type LockResult =
  | { ok: true; status: MarketStatus }
  | { ok: false; code: AdminErrorCode; message: string };
