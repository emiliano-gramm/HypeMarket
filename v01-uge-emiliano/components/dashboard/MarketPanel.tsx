"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getViewerPositions,
  getWallet,
  placeStake,
} from "@/app/actions/markets";
import { OddsInfoPopover } from "@/components/dashboard/market/OddsInfoPopover";
import {
  PredictionMarket,
  type PredictionOutcome,
} from "@/components/dashboard/market/PredictionMarket";
import { PositionsList } from "@/components/dashboard/market/PositionsList";
import { ResolvedBanner } from "@/components/dashboard/market/ResolvedBanner";
import { computeOutcomes, payoutPreview } from "@/lib/markets/odds";
import type {
  MarketState,
  MarketStatus,
  Outcome,
  ViewerPosition,
  Wallet,
} from "@/lib/markets/types";
import { useViewerId } from "@/lib/viewer/useViewerId";

const MARKET_REFRESH_MS = 2000;
const SYNCED_BANNER_MS = 2500;
const STAKE_TIMEOUT_MS = 20_000;
/** Keep bypassing CDN cache briefly after a stake so stale edge reads cannot regress pools. */
const POST_STAKE_CACHE_BYPASS_MS = 30_000;

type SyncStatus = "idle" | "syncing" | "synced" | "error";

type MarketApiResponse =
  | { ok: true; state: MarketState }
  | { ok: false; message: string };

type MarketMeta = {
  question: string;
  marketType: string;
  status: MarketStatus;
  locksAt: string | null;
  resolvedOptionKey: string | null;
  resolvedAt: string | null;
};

const DEFAULT_META: MarketMeta = {
  question: "Who wins Map 3?",
  marketType: "binary",
  status: "open",
  locksAt: null,
  resolvedOptionKey: null,
  resolvedAt: null,
};

/**
 * Merge server pools with optimistic floors. Within a single market the staked
 * pool only grows until resolution, so we never let a displayed pool/backer
 * count regress below what we optimistically showed (mirrors SocialPanel).
 */
function mergeOutcomes(
  serverOutcomes: Outcome[],
  stakeFloors: Record<string, number>,
  current: Outcome[]
): Outcome[] {
  const currentStakedByKey = new Map(
    current.map((o) => [o.optionKey, o.stakedTotal])
  );
  const currentBackersByKey = new Map(
    current.map((o) => [o.optionKey, o.backerCount])
  );

  const pools = serverOutcomes.map((o) => ({
    optionKey: o.optionKey,
    label: o.label,
    stakedTotal: Math.max(
      o.stakedTotal,
      stakeFloors[o.optionKey] ?? 0,
      currentStakedByKey.get(o.optionKey) ?? 0
    ),
    backerCount: Math.max(
      o.backerCount,
      currentBackersByKey.get(o.optionKey) ?? 0
    ),
  }));

  // Recompute implied prob + decimal odds from the merged pools.
  return computeOutcomes(pools);
}

function clearConfirmedFloors(
  floors: Record<string, number>,
  serverOutcomes: Outcome[]
): Record<string, number> {
  const next = { ...floors };
  for (const [optionKey, floor] of Object.entries(floors)) {
    const server = serverOutcomes.find((o) => o.optionKey === optionKey);
    // Only drop the floor once the raw server pool has caught up to it.
    if (server && server.stakedTotal >= floor) {
      delete next[optionKey];
    }
  }
  return next;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Stake request timed out")),
      ms
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function MarketSkeleton() {
  return (
    <section className="rounded-xl border border-edge bg-panel" aria-hidden="true">
      <div className="flex items-center justify-between border-b border-edge px-4 py-3">
        <div className="h-4 w-32 animate-pulse rounded bg-edge" />
        <div className="h-5 w-14 animate-pulse rounded bg-edge" />
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="h-3 w-40 animate-pulse rounded bg-edge" />
        <div className="h-10 w-full animate-pulse rounded-lg bg-edge/70" />
        {[0, 1].map((i) => (
          <div key={i} className="h-14 w-full animate-pulse rounded-lg bg-edge/70" />
        ))}
        <div className="h-10 w-full animate-pulse rounded-lg bg-edge/60" />
      </div>
    </section>
  );
}

function StakeBanner({
  status,
  message,
}: {
  status: SyncStatus;
  message: string | null;
}) {
  if (status === "idle" && !message) return null;

  return (
    <AnimatePresence mode="wait" initial={false}>
      {(status === "syncing" || status === "synced" || message) && (
        <motion.div
          key={status === "error" ? "error" : status}
          initial={{ opacity: 0, y: -4, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -4, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          {status === "syncing" && (
            <p className="flex items-center gap-1.5 text-xs text-brand-strong">
              <Loader2 className="h-3 w-3 animate-spin" />
              Placing stake — wallet debit + sharded pool write in one DSQL txn…
            </p>
          )}
          {status === "synced" && (
            <p className="flex items-center gap-1.5 text-xs text-[var(--positive)]">
              <Check className="h-3 w-3" />
              Stake recorded — odds update globally via edge cache
            </p>
          )}
          {status === "error" && message && (
            <p className="text-xs text-amber-400">{message}</p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function MarketPanel() {
  const viewerId = useViewerId();
  const [meta, setMeta] = useState<MarketMeta>(DEFAULT_META);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [positions, setPositions] = useState<ViewerPosition[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stakeError, setStakeError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [isLoading, setIsLoading] = useState(true);

  const stakeFloorsRef = useRef<Record<string, number>>({});
  const postStakeBypassUntilRef = useRef(0);
  const syncedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevStatusRef = useRef<MarketStatus>(DEFAULT_META.status);

  const applyServerState = useCallback((state: MarketState) => {
    setMeta({
      question: state.question,
      marketType: state.marketType,
      status: state.status,
      locksAt: state.locksAt,
      resolvedOptionKey: state.resolvedOptionKey,
      resolvedAt: state.resolvedAt,
    });
    setOutcomes((current) => {
      const merged = mergeOutcomes(
        state.outcomes,
        stakeFloorsRef.current,
        current
      );
      stakeFloorsRef.current = clearConfirmedFloors(
        stakeFloorsRef.current,
        state.outcomes
      );
      return merged;
    });
  }, []);

  const refreshMarket = useCallback(
    async (bypassCache = false) => {
      const hasPendingFloors =
        Object.keys(stakeFloorsRef.current).length > 0;
      const inPostStakeWindow = Date.now() < postStakeBypassUntilRef.current;
      const useFreshFetch = bypassCache || hasPendingFloors || inPostStakeWindow;

      try {
        const response = await fetch(
          "/api/markets",
          useFreshFetch ? { cache: "no-store" } : undefined
        );
        const result = (await response.json()) as MarketApiResponse;

        if (!result.ok) {
          setLoadError(result.message);
          return;
        }

        applyServerState(result.state);
        setLoadError(null);
      } catch {
        setLoadError("Failed to load market state");
      } finally {
        setIsLoading(false);
      }
    },
    [applyServerState]
  );

  const refreshPositions = useCallback(async () => {
    if (!viewerId) return;
    const result = await getViewerPositions(viewerId);
    if (result.ok) {
      setPositions(result.positions);
    }
  }, [viewerId]);

  useEffect(() => {
    void refreshMarket();
    const interval = setInterval(() => void refreshMarket(), MARKET_REFRESH_MS);
    return () => clearInterval(interval);
  }, [refreshMarket]);

  // Provision/load the wallet and existing positions once we have a viewer id.
  useEffect(() => {
    if (!viewerId) return;
    let cancelled = false;
    void (async () => {
      const result = await getWallet(viewerId);
      if (!cancelled && result.ok) setWallet(result.wallet);
    })();
    void refreshPositions();
    return () => {
      cancelled = true;
    };
  }, [viewerId, refreshPositions]);

  useEffect(() => {
    return () => {
      if (syncedTimerRef.current) clearTimeout(syncedTimerRef.current);
    };
  }, []);

  // When the market transitions to resolved (admin settlement ran), pull the
  // settled wallet balance + per-stake payouts so the banner/positions update
  // without a manual refresh.
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = meta.status;
    if (meta.status === "resolved" && prev !== "resolved" && viewerId) {
      void (async () => {
        const walletResult = await getWallet(viewerId);
        if (walletResult.ok) setWallet(walletResult.wallet);
        await refreshPositions();
      })();
    }
  }, [meta.status, viewerId, refreshPositions]);

  const markSynced = useCallback(() => {
    setSyncStatus("synced");
    if (syncedTimerRef.current) clearTimeout(syncedTimerRef.current);
    syncedTimerRef.current = setTimeout(() => {
      setSyncStatus("idle");
    }, SYNCED_BANNER_MS);
  }, []);

  const totalPool = useMemo(
    () => outcomes.reduce((sum, o) => sum + o.stakedTotal, 0),
    [outcomes]
  );

  async function handleStake(optionKey: string, amount: number) {
    if (!viewerId || !wallet || syncStatus === "syncing") return;
    if (meta.status !== "open") {
      setStakeError(
        meta.status === "locked"
          ? "Market is locked — staking is closed."
          : "Market has resolved — staking is closed."
      );
      setSyncStatus("error");
      return;
    }
    if (wallet.balance < amount) {
      setStakeError("Not enough Hype Credits for this stake.");
      setSyncStatus("error");
      return;
    }

    const snapshot = {
      outcomes: outcomes.map((o) => ({ ...o })),
      wallet: { ...wallet },
    };

    const priorStaked =
      outcomes.find((o) => o.optionKey === optionKey)?.stakedTotal ?? 0;
    const optimisticFloor = priorStaked + amount;
    stakeFloorsRef.current[optionKey] = optimisticFloor;

    setStakeError(null);
    setSyncStatus("syncing");

    // Optimistically grow the chosen pool + recompute odds, and debit the wallet.
    setOutcomes((prev) =>
      computeOutcomes(
        prev.map((o) => ({
          optionKey: o.optionKey,
          label: o.label,
          backerCount:
            o.optionKey === optionKey ? o.backerCount + 1 : o.backerCount,
          stakedTotal:
            o.optionKey === optionKey ? o.stakedTotal + amount : o.stakedTotal,
        }))
      )
    );
    setWallet((prev) =>
      prev ? { ...prev, balance: prev.balance - amount } : prev
    );

    try {
      const result = await withTimeout(
        placeStake(optionKey, amount, viewerId),
        STAKE_TIMEOUT_MS
      );

      if (!result.ok) {
        // Roll back the optimistic pool + wallet.
        delete stakeFloorsRef.current[optionKey];
        postStakeBypassUntilRef.current = 0;
        setOutcomes(snapshot.outcomes);
        setWallet(snapshot.wallet);
        setStakeError(result.message);
        setSyncStatus("error");

        // A lock/resolve we didn't know about — refresh to reflect new status.
        if (result.code === "market_locked" || result.code === "market_closed") {
          await refreshMarket(true);
        }
        return;
      }

      // Authoritative balance from the committed transaction.
      setWallet(result.wallet);
      postStakeBypassUntilRef.current = Date.now() + POST_STAKE_CACHE_BYPASS_MS;
      await refreshMarket(true);
      await refreshPositions();
      markSynced();
    } catch (err) {
      delete stakeFloorsRef.current[optionKey];
      postStakeBypassUntilRef.current = 0;
      setOutcomes(snapshot.outcomes);
      setWallet(snapshot.wallet);
      setStakeError(
        err instanceof Error && err.message === "Stake request timed out"
          ? "Stake timed out — check your connection and try again."
          : "Network error — stake not saved. Try again."
      );
      setSyncStatus("error");
    }
  }

  const predictionOutcomes: PredictionOutcome[] = outcomes;

  const resolvedLabel = useMemo(() => {
    if (meta.status !== "resolved" || !meta.resolvedOptionKey) return null;
    return (
      outcomes.find((o) => o.optionKey === meta.resolvedOptionKey)?.label ?? null
    );
  }, [meta.status, meta.resolvedOptionKey, outcomes]);

  const settledPayout = useMemo(
    () =>
      positions
        .filter((p) => p.settled)
        .reduce((sum, p) => sum + p.payout, 0),
    [positions]
  );

  /** Live potential payout from current crowd odds (DB payout is 0 until settlement). */
  const positionsForDisplay = useMemo(() => {
    const oddsByKey = new Map(outcomes.map((o) => [o.optionKey, o.decimalOdds]));
    return positions.map((p) => ({
      optionKey: p.optionKey,
      label: p.label,
      amount: p.amount,
      settled: p.settled,
      payout: p.settled
        ? p.payout
        : payoutPreview(p.amount, oddsByKey.get(p.optionKey) ?? 0),
    }));
  }, [positions, outcomes]);

  if (isLoading && outcomes.length === 0) {
    return (
      <aside className="flex h-full flex-col gap-4">
        <MarketSkeleton />
      </aside>
    );
  }

  return (
    <aside className="flex h-full flex-col gap-4">
      {meta.status === "resolved" && resolvedLabel && (
        <ResolvedBanner
          winnerLabel={resolvedLabel}
          payoutAmount={settledPayout}
          walletBalance={wallet?.balance ?? 0}
        />
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
          Pool {totalPool.toLocaleString()} · parimutuel
        </p>
        <OddsInfoPopover />
      </div>

      <StakeBanner
        status={syncStatus}
        message={syncStatus === "error" ? stakeError : null}
      />
      {loadError && syncStatus !== "error" && (
        <p className="text-xs text-red-400">{loadError}</p>
      )}

      <PredictionMarket
        question={meta.question}
        status={meta.status}
        wallet={wallet ?? { balance: 0 }}
        outcomes={predictionOutcomes}
        selectedOptionKey={meta.resolvedOptionKey}
        syncing={syncStatus === "syncing"}
        onStake={(optionKey, amount) => void handleStake(optionKey, amount)}
      />

      <PositionsList positions={positionsForDisplay} />

      <p className="text-[10px] leading-relaxed text-ink-faint">
        Stakes hit sharded counters; a Lambda materializes{" "}
        <code className="text-ink-muted">staked_total</code>, read from the
        edge-cached <code className="text-ink-muted">/api/markets</code> route every{" "}
        {MARKET_REFRESH_MS / 1000}s. Odds are crowd-implied (parimutuel).
      </p>
    </aside>
  );
}
