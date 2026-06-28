"use server";

import type pg from "pg";
import { withDsqlClient } from "@/lib/dsql/client";
import { deriveMarketStatus } from "@/lib/markets/odds";
import {
  ensureWallet,
  fetchMarketState,
  fetchViewerPositions,
  fetchWallet,
  getDemoMarketId,
  INITIAL_WALLET_BALANCE,
} from "@/lib/markets/queries";
import type {
  AdminErrorCode,
  GetMarketStateResult,
  GetViewerPositionsResult,
  GetWalletResult,
  LockResult,
  ResolveResult,
  SettlementSummary,
  StakeResult,
  Wallet,
} from "@/lib/markets/types";
import { triggerPollAggregator } from "@/lib/polls/triggerAggregator";

export type {
  GetMarketStateResult,
  GetViewerPositionsResult,
  GetWalletResult,
  LockResult,
  MarketState,
  Outcome,
  ResolveResult,
  SettlementSummary,
  StakeResult,
  ViewerPosition,
  Wallet,
} from "@/lib/markets/types";

const MAX_STAKE = 1_000_000;
const MAX_OCC_RETRIES = 3;

/** Aurora DSQL surfaces OCC conflicts as serialization failures (SQLSTATE 40001). */
function isOccConflict(err: unknown): boolean {
  return (
    !!err &&
    typeof err === "object" &&
    "code" in err &&
    typeof (err as { code?: unknown }).code === "string" &&
    ((err as { code: string }).code === "40001" ||
      (err as { code: string }).code === "40P01")
  );
}

type OccRetryResult<T> = { value: T; occRetries: number };

async function withOccRetry<T>(fn: () => Promise<T>): Promise<OccRetryResult<T>> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_OCC_RETRIES; attempt += 1) {
    try {
      return { value: await fn(), occRetries: attempt };
    } catch (err) {
      if (!isOccConflict(err)) throw err;
      lastErr = err;
    }
  }
  throw lastErr;
}

export async function getMarketState(): Promise<GetMarketStateResult> {
  try {
    const marketId = getDemoMarketId();
    const state = await withDsqlClient((client) =>
      fetchMarketState(client, marketId)
    );
    return { ok: true, state };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Failed to load market from DSQL",
    };
  }
}

export async function getWallet(
  viewerExternalId: string
): Promise<GetWalletResult> {
  if (!viewerExternalId || viewerExternalId.length > 128) {
    return { ok: false, message: "Invalid viewer id" };
  }

  try {
    const wallet = await withDsqlClient((client) =>
      ensureWallet(client, viewerExternalId)
    );
    return { ok: true, wallet };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Failed to load wallet",
    };
  }
}

export async function getViewerPositions(
  viewerExternalId: string
): Promise<GetViewerPositionsResult> {
  if (!viewerExternalId || viewerExternalId.length > 128) {
    return { ok: false, message: "Invalid viewer id" };
  }

  try {
    const marketId = getDemoMarketId();
    const positions = await withDsqlClient((client) =>
      fetchViewerPositions(client, marketId, viewerExternalId)
    );
    return { ok: true, positions };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Failed to load viewer positions",
    };
  }
}

type StakeTxnRow = {
  status: string;
  shard_count: number;
  locks_at: Date | null;
  resolved_option_id: string | null;
};

async function runStakeTxn(
  client: pg.Client,
  marketId: string,
  optionKey: string,
  amount: number,
  viewerExternalId: string
): Promise<StakeResult> {
  const marketResult = await client.query<StakeTxnRow>(
    `SELECT status, shard_count, locks_at, resolved_option_id
     FROM uge.polls
     WHERE poll_id = $1`,
    [marketId]
  );

  if (marketResult.rows.length === 0) {
    return { ok: false, code: "market_closed", message: "Market not found" };
  }

  const market = marketResult.rows[0];
  const status = deriveMarketStatus({
    hasResolvedOutcome: market.resolved_option_id !== null,
    locksAt: market.locks_at,
    dbStatus: market.status,
  });

  if (status === "resolved") {
    return {
      ok: false,
      code: "market_closed",
      message: "This market has already resolved",
    };
  }
  if (status === "locked") {
    return {
      ok: false,
      code: "market_locked",
      message: "This market is locked — staking is closed",
    };
  }

  const optionResult = await client.query<{ option_id: string }>(
    `SELECT option_id
     FROM uge.poll_options
     WHERE poll_id = $1 AND option_key = $2`,
    [marketId, optionKey]
  );

  if (optionResult.rows.length === 0) {
    return { ok: false, code: "invalid_option", message: "Unknown outcome" };
  }

  const optionId = optionResult.rows[0].option_id;
  const shardCount = market.shard_count > 0 ? market.shard_count : 32;
  const shardId = Math.floor(Math.random() * shardCount);

  await client.query("BEGIN");
  try {
    // Keep a viewers row for parity with the poll path (no FK, but consistent).
    await client.query(
      `INSERT INTO uge.viewers (external_id)
       VALUES ($1)
       ON CONFLICT (external_id) DO NOTHING`,
      [viewerExternalId]
    );

    // Provision wallet on first stake (initial grant + ledger row).
    const walletInsert = await client.query(
      `INSERT INTO uge.viewer_wallets (external_id, balance)
       VALUES ($1, $2)
       ON CONFLICT (external_id) DO NOTHING`,
      [viewerExternalId, INITIAL_WALLET_BALANCE]
    );
    if (walletInsert.rowCount === 1) {
      await client.query(
        `INSERT INTO uge.wallet_ledger (external_id, txn_type, amount, balance_after)
         VALUES ($1, 'grant', $2, $2)`,
        [viewerExternalId, INITIAL_WALLET_BALANCE]
      );
    }

    // Debit the wallet, guarding against insufficient funds in the same UPDATE.
    const debit = await client.query<{ balance: string }>(
      `UPDATE uge.viewer_wallets
       SET balance = balance - $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE external_id = $1 AND balance >= $2
       RETURNING balance::bigint AS balance`,
      [viewerExternalId, amount]
    );

    if (debit.rowCount !== 1) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        code: "insufficient_funds",
        message: "Not enough Hype Credits for this stake",
      };
    }

    const balanceAfter = Number(debit.rows[0].balance);

    // Append-only stake record (amount > 0 distinguishes it from legacy votes).
    await client.query(
      `INSERT INTO uge.vote_events
         (poll_id, option_id, viewer_external_id, shard_id, amount, settled)
       VALUES ($1, $2, $3, $4, $5, false)`,
      [marketId, optionId, viewerExternalId, shardId, amount]
    );

    // Credit the pool on a random shard (sharded counter avoids a hot row).
    const shardUpdate = await client.query(
      `UPDATE uge.vote_shards
       SET staked_amount = COALESCE(staked_amount, 0) + $4,
           vote_count = vote_count + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE poll_id = $1 AND option_id = $2 AND shard_id = $3`,
      [marketId, optionId, shardId, amount]
    );

    if (shardUpdate.rowCount !== 1) {
      throw new Error("Stake shard row missing — re-run seed.sql");
    }

    await client.query(
      `INSERT INTO uge.wallet_ledger
         (external_id, txn_type, amount, balance_after, poll_id)
       VALUES ($1, 'stake', $2, $3, $4)`,
      [viewerExternalId, -amount, balanceAfter, marketId]
    );

    await client.query("COMMIT");

    return {
      ok: true,
      wallet: {
        externalId: viewerExternalId,
        balance: balanceAfter,
        updatedAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

export async function placeStake(
  optionKey: string,
  amount: number,
  viewerExternalId: string
): Promise<StakeResult> {
  if (!viewerExternalId || viewerExternalId.length > 128) {
    return { ok: false, code: "invalid_viewer", message: "Invalid viewer id" };
  }
  if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_STAKE) {
    return { ok: false, code: "invalid_amount", message: "Invalid stake amount" };
  }

  const marketId = getDemoMarketId();

  try {
    const { value: result, occRetries } = await withOccRetry(() =>
      withDsqlClient((client) =>
        runStakeTxn(client, marketId, optionKey, amount, viewerExternalId)
      )
    );

    if (result.ok) {
      triggerPollAggregator();
      if (occRetries > 0) {
        return { ...result, occRetries };
      }
    }

    return result;
  } catch (err) {
    return {
      ok: false,
      code: "error",
      message: err instanceof Error ? err.message : "Stake failed",
    };
  }
}

export async function refreshWallet(
  viewerExternalId: string
): Promise<Wallet | null> {
  if (!viewerExternalId || viewerExternalId.length > 128) return null;
  try {
    return await withDsqlClient((client) =>
      fetchWallet(client, viewerExternalId)
    );
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Phase 3 — lock / resolve / parimutuel settlement (admin-only)
// ---------------------------------------------------------------------------

/**
 * Validate an admin secret against ADMIN_SECRET. Returns an error code when the
 * secret is missing on the server or does not match, otherwise null.
 */
function checkAdminSecret(provided: string): AdminErrorCode | null {
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return "not_configured";
  if (!provided || provided !== expected) return "unauthorized";
  return null;
}

const ADMIN_ERROR_MESSAGES: Record<AdminErrorCode, string> = {
  unauthorized: "Invalid admin secret",
  not_configured: "ADMIN_SECRET is not configured on the server",
  market_not_found: "Market not found",
  invalid_option: "Unknown winning outcome",
  already_resolved: "Market is already resolved to a different outcome",
  error: "Admin operation failed",
};

/**
 * Lock the market so staking is closed (without resolving it yet). Useful for
 * the demo beat "lock → resolve". Sets locks_at to now; deriveMarketStatus then
 * reports the market as locked. Idempotent and admin-guarded.
 */
export async function lockMarket(adminSecret: string): Promise<LockResult> {
  const authError = checkAdminSecret(adminSecret);
  if (authError) {
    return { ok: false, code: authError, message: ADMIN_ERROR_MESSAGES[authError] };
  }

  const marketId = getDemoMarketId();

  try {
    const { value: status } = await withOccRetry(() =>
      withDsqlClient(async (client) => {
        const result = await client.query<{ resolved_option_id: string | null }>(
          `UPDATE uge.polls
           SET locks_at = CURRENT_TIMESTAMP
           WHERE poll_id = $1 AND resolved_option_id IS NULL
           RETURNING resolved_option_id`,
          [marketId]
        );
        // Already resolved (or missing) → report resolved; otherwise locked.
        return result.rowCount === 1 ? "locked" : "resolved";
      })
    );

    return { ok: true, status };
  } catch (err) {
    return {
      ok: false,
      code: "error",
      message: err instanceof Error ? err.message : ADMIN_ERROR_MESSAGES.error,
    };
  }
}

type SettleResolveOutcome =
  | { kind: "ok"; summary: SettlementSummary }
  | { kind: "error"; code: AdminErrorCode };

/**
 * Resolve the market to a winning outcome and pay winners parimutuel-style, all
 * in one DSQL transaction. Idempotent: stakes already marked settled are never
 * paid twice, and re-resolving to the same outcome only settles leftovers.
 *
 *   winning_pool = SUM(staked_amount on winning outcome)   [shard ground truth]
 *   total_pool   = SUM(staked_amount across all outcomes)
 *   payout(stake) = floor(stake.amount / winning_pool * total_pool)
 */
async function runResolveTxn(
  client: pg.Client,
  marketId: string,
  winningOptionKey: string
): Promise<SettleResolveOutcome> {
  const marketResult = await client.query<{ resolved_option_id: string | null }>(
    `SELECT resolved_option_id FROM uge.polls WHERE poll_id = $1`,
    [marketId]
  );
  if (marketResult.rows.length === 0) {
    return { kind: "error", code: "market_not_found" };
  }

  const optionResult = await client.query<{ option_id: string; label: string }>(
    `SELECT option_id, label
     FROM uge.poll_options
     WHERE poll_id = $1 AND option_key = $2`,
    [marketId, winningOptionKey]
  );
  if (optionResult.rows.length === 0) {
    return { kind: "error", code: "invalid_option" };
  }

  const winningOptionId = optionResult.rows[0].option_id;
  const winningLabel = optionResult.rows[0].label;
  const existingResolved = marketResult.rows[0].resolved_option_id;
  const alreadyResolved = existingResolved !== null;

  // Cannot flip a resolved market to a different winner — keeps payouts honest.
  if (alreadyResolved && existingResolved !== winningOptionId) {
    return { kind: "error", code: "already_resolved" };
  }

  // Pools from shard ground truth (avoids materialized-aggregator lag).
  const poolResult = await client.query<{ option_id: string; pool: string }>(
    `SELECT o.option_id,
            COALESCE(SUM(vs.staked_amount), 0)::bigint AS pool
     FROM uge.poll_options o
     LEFT JOIN uge.vote_shards vs
       ON vs.poll_id = o.poll_id AND vs.option_id = o.option_id
     WHERE o.poll_id = $1
     GROUP BY o.option_id`,
    [marketId]
  );

  let totalPool = 0;
  let winningPool = 0;
  for (const row of poolResult.rows) {
    const pool = Number(row.pool);
    totalPool += pool;
    if (row.option_id === winningOptionId) winningPool = pool;
  }

  await client.query("BEGIN");
  try {
    // 1. Mark the market resolved (idempotent — preserves first resolved_at).
    await client.query(
      `UPDATE uge.polls
       SET resolved_option_id = $2,
           resolved_at = COALESCE(resolved_at, CURRENT_TIMESTAMP),
           locks_at = COALESCE(locks_at, CURRENT_TIMESTAMP),
           status = 'resolved'
       WHERE poll_id = $1`,
      [marketId, winningOptionId]
    );

    // 2. Settle losing stakes (payout 0) — single bulk update.
    const losers = await client.query(
      `UPDATE uge.vote_events
       SET settled = true, payout = 0
       WHERE poll_id = $1
         AND option_id <> $2
         AND amount IS NOT NULL AND amount > 0
         AND COALESCE(settled, false) = false`,
      [marketId, winningOptionId]
    );

    // 3. Settle winning stakes, computing each payout with integer floor math.
    let winnerRows: { viewer_external_id: string; payout: string }[] = [];
    if (winningPool > 0) {
      const winners = await client.query<{
        viewer_external_id: string;
        payout: string;
      }>(
        `UPDATE uge.vote_events
         SET settled = true,
             payout = floor(amount::numeric / $3::numeric * $4::numeric)
         WHERE poll_id = $1
           AND option_id = $2
           AND amount IS NOT NULL AND amount > 0
           AND COALESCE(settled, false) = false
         RETURNING viewer_external_id, payout::bigint AS payout`,
        [marketId, winningOptionId, winningPool, totalPool]
      );
      winnerRows = winners.rows;
    }

    // 4. Aggregate payouts per viewer → one wallet credit + ledger row each.
    const payoutByViewer = new Map<string, number>();
    for (const row of winnerRows) {
      const payout = Number(row.payout);
      if (payout <= 0) continue;
      payoutByViewer.set(
        row.viewer_external_id,
        (payoutByViewer.get(row.viewer_external_id) ?? 0) + payout
      );
    }

    let creditsPaidOut = 0;
    for (const [viewer, payout] of payoutByViewer) {
      const credit = await client.query<{ balance: string }>(
        `UPDATE uge.viewer_wallets
         SET balance = balance + $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE external_id = $1
         RETURNING balance::bigint AS balance`,
        [viewer, payout]
      );
      if (credit.rowCount !== 1) {
        // A winning staker always has a wallet (placeStake provisions it);
        // a missing row means corrupt state — fail the whole settlement.
        throw new Error(`Wallet missing for winning viewer ${viewer}`);
      }
      await client.query(
        `INSERT INTO uge.wallet_ledger
           (external_id, txn_type, amount, balance_after, poll_id)
         VALUES ($1, 'payout', $2, $3, $4)`,
        [viewer, payout, Number(credit.rows[0].balance), marketId]
      );
      creditsPaidOut += payout;
    }

    await client.query("COMMIT");

    return {
      kind: "ok",
      summary: {
        marketId,
        winningOptionKey,
        winningLabel,
        winningPool,
        totalPool,
        winnersPaid: payoutByViewer.size,
        stakesSettled: (losers.rowCount ?? 0) + winnerRows.length,
        creditsPaidOut,
        alreadyResolved,
      },
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

/**
 * Admin-guarded market resolution + parimutuel settlement. Pass the winning
 * outcome key (e.g. "team-a") and the ADMIN_SECRET. Safe to retry on OCC.
 */
export async function resolveMarket(
  winningOptionKey: string,
  adminSecret: string
): Promise<ResolveResult> {
  const authError = checkAdminSecret(adminSecret);
  if (authError) {
    return { ok: false, code: authError, message: ADMIN_ERROR_MESSAGES[authError] };
  }
  if (!winningOptionKey || winningOptionKey.length > 64) {
    return {
      ok: false,
      code: "invalid_option",
      message: ADMIN_ERROR_MESSAGES.invalid_option,
    };
  }

  const marketId = getDemoMarketId();

  try {
    const { value: outcome } = await withOccRetry(() =>
      withDsqlClient((client) => runResolveTxn(client, marketId, winningOptionKey))
    );

    if (outcome.kind === "error") {
      return {
        ok: false,
        code: outcome.code,
        message: ADMIN_ERROR_MESSAGES[outcome.code],
      };
    }

    return { ok: true, summary: outcome.summary };
  } catch (err) {
    return {
      ok: false,
      code: "error",
      message: err instanceof Error ? err.message : ADMIN_ERROR_MESSAGES.error,
    };
  }
}
