import type pg from "pg";
import { computeOutcomes, deriveMarketStatus } from "@/lib/markets/odds";
import type {
  MarketState,
  ViewerPosition,
  Wallet,
} from "@/lib/markets/types";

/** Initial play-money grant for a brand-new wallet (Hype Credits). */
export const INITIAL_WALLET_BALANCE = 1000;

/**
 * The demo market reuses the demo poll id (same row, reframed as a market).
 * Kept as a separate accessor so market code never imports the poll module.
 */
export function getDemoMarketId(): string {
  const marketId = process.env.DSQL_DEMO_POLL_ID;
  if (!marketId) {
    throw new Error("DSQL_DEMO_POLL_ID is not configured");
  }
  return marketId;
}

type MarketRow = {
  match_id: string;
  question: string;
  status: string;
  market_type: string | null;
  locks_at: Date | null;
  resolved_option_id: string | null;
  resolved_at: Date | null;
  resolved_option_key: string | null;
};

type OutcomeRow = {
  option_key: string;
  label: string;
  staked_total: string;
  backer_count: string;
  aggregated_at: Date | null;
};

export async function fetchMarketState(
  client: pg.Client,
  marketId: string
): Promise<MarketState> {
  const marketResult = await client.query<MarketRow>(
    `SELECT p.match_id,
            p.question,
            p.status,
            p.market_type,
            p.locks_at,
            p.resolved_option_id,
            p.resolved_at,
            ro.option_key AS resolved_option_key
     FROM uge.polls p
     LEFT JOIN uge.poll_options ro ON ro.option_id = p.resolved_option_id
     WHERE p.poll_id = $1`,
    [marketId]
  );

  if (marketResult.rows.length === 0) {
    throw new Error("Market not found");
  }

  const market = marketResult.rows[0];

  const outcomesResult = await client.query<OutcomeRow>(
    `SELECT o.option_key,
            o.label,
            COALESCE(pt.staked_total, 0)::bigint AS staked_total,
            COALESCE(pt.backer_count, 0)::bigint AS backer_count,
            MAX(pt.aggregated_at) OVER () AS aggregated_at
     FROM uge.poll_options o
     LEFT JOIN uge.poll_totals pt
       ON pt.poll_id = o.poll_id AND pt.option_id = o.option_id
     WHERE o.poll_id = $1
     ORDER BY o.sort_order`,
    [marketId]
  );

  const outcomes = computeOutcomes(
    outcomesResult.rows.map((row) => ({
      optionKey: row.option_key,
      label: row.label,
      stakedTotal: Number(row.staked_total),
      backerCount: Number(row.backer_count),
    }))
  );

  const totalPool = outcomes.reduce((sum, o) => sum + o.stakedTotal, 0);
  const aggregatedAt = outcomesResult.rows[0]?.aggregated_at ?? null;

  const status = deriveMarketStatus({
    hasResolvedOutcome: market.resolved_option_id !== null,
    locksAt: market.locks_at,
    dbStatus: market.status,
  });

  return {
    marketId,
    matchId: market.match_id,
    question: market.question,
    marketType: market.market_type ?? "binary",
    status,
    locksAt: market.locks_at ? market.locks_at.toISOString() : null,
    resolvedOptionKey: market.resolved_option_key,
    resolvedAt: market.resolved_at ? market.resolved_at.toISOString() : null,
    totalPool,
    outcomes,
    aggregatedAt: aggregatedAt ? aggregatedAt.toISOString() : null,
  };
}

function mapWalletRow(row: {
  external_id: string;
  balance: string;
  updated_at: Date | null;
}): Wallet {
  return {
    externalId: row.external_id,
    balance: Number(row.balance),
    updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
  };
}

export async function fetchWallet(
  client: pg.Client,
  externalId: string
): Promise<Wallet | null> {
  const result = await client.query<{
    external_id: string;
    balance: string;
    updated_at: Date | null;
  }>(
    `SELECT external_id, balance::bigint AS balance, updated_at
     FROM uge.viewer_wallets
     WHERE external_id = $1`,
    [externalId]
  );

  return result.rows.length ? mapWalletRow(result.rows[0]) : null;
}

/**
 * Return the viewer's wallet, creating it (with the initial grant + ledger row)
 * on first contact. New browsers use a random localStorage id with no seeded
 * wallet, so provisioning here keeps the demo working for anyone.
 */
export async function ensureWallet(
  client: pg.Client,
  externalId: string
): Promise<Wallet> {
  const insert = await client.query<{
    external_id: string;
    balance: string;
    updated_at: Date | null;
  }>(
    `INSERT INTO uge.viewer_wallets (external_id, balance)
     VALUES ($1, $2)
     ON CONFLICT (external_id) DO NOTHING
     RETURNING external_id, balance::bigint AS balance, updated_at`,
    [externalId, INITIAL_WALLET_BALANCE]
  );

  if (insert.rows.length === 1) {
    // Wallet was just created — record the opening grant for audit.
    await client.query(
      `INSERT INTO uge.wallet_ledger (external_id, txn_type, amount, balance_after)
       VALUES ($1, 'grant', $2, $2)`,
      [externalId, INITIAL_WALLET_BALANCE]
    );
    return mapWalletRow(insert.rows[0]);
  }

  const existing = await fetchWallet(client, externalId);
  if (!existing) {
    throw new Error("Wallet provisioning failed");
  }
  return existing;
}

export async function fetchViewerPositions(
  client: pg.Client,
  marketId: string,
  externalId: string
): Promise<ViewerPosition[]> {
  const result = await client.query<{
    option_key: string;
    label: string;
    amount: string;
    stake_count: string;
    payout: string;
    settled: boolean;
  }>(
    `SELECT o.option_key,
            o.label,
            SUM(ve.amount)::bigint AS amount,
            COUNT(*)::bigint AS stake_count,
            SUM(COALESCE(ve.payout, 0))::bigint AS payout,
            bool_and(COALESCE(ve.settled, false)) AS settled
     FROM uge.vote_events ve
     JOIN uge.poll_options o ON o.option_id = ve.option_id
     WHERE ve.poll_id = $1
       AND ve.viewer_external_id = $2
       AND ve.amount IS NOT NULL
       AND ve.amount > 0
     GROUP BY o.option_key, o.label, o.sort_order
     ORDER BY o.sort_order`,
    [marketId, externalId]
  );

  return result.rows.map((row) => ({
    optionKey: row.option_key,
    label: row.label,
    amount: Number(row.amount),
    stakeCount: Number(row.stake_count),
    payout: Number(row.payout),
    settled: row.settled,
  }));
}
