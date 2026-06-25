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
  GetMarketStateResult,
  GetViewerPositionsResult,
  GetWalletResult,
  StakeResult,
  Wallet,
} from "@/lib/markets/types";
import { triggerPollAggregator } from "@/lib/polls/triggerAggregator";

export type {
  GetMarketStateResult,
  GetViewerPositionsResult,
  GetWalletResult,
  MarketState,
  Outcome,
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

async function withOccRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_OCC_RETRIES; attempt += 1) {
    try {
      return await fn();
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
    const result = await withOccRetry(() =>
      withDsqlClient((client) =>
        runStakeTxn(client, marketId, optionKey, amount, viewerExternalId)
      )
    );

    if (result.ok) {
      triggerPollAggregator();
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
