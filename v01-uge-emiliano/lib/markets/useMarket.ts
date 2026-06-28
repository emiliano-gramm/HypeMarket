"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getViewerPositions,
  getWallet,
  placeStake,
} from "@/app/actions/markets";
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
const TOAST_MS = 3200;
const MAX_ACTIVITY = 16;
/** Seed wallet grant (mirrors infrastructure/dsql/seed.sql). */
const INITIAL_WALLET_BALANCE = 1000;

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

export type ToastVariant = "success" | "info" | "error" | "muted";

export type Toast = { message: string; variant: ToastVariant };

export type ActivityEntry = {
  id: string;
  amount: number;
  optionKey: string;
  label: string;
  /** epoch ms when the stake was placed (for "Ns ago" rendering) */
  at: number;
};

export type Resolution = {
  id: number;
  userWon: boolean;
  payout: number;
  balance: number;
};

export type PositionForDisplay = {
  optionKey: string;
  label: string;
  amount: number;
  settled: boolean;
  payout: number;
};

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
 * count regress below what we optimistically showed.
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

  return computeOutcomes(pools);
}

function clearConfirmedFloors(
  floors: Record<string, number>,
  serverOutcomes: Outcome[]
): Record<string, number> {
  const next = { ...floors };
  for (const [optionKey, floor] of Object.entries(floors)) {
    const server = serverOutcomes.find((o) => o.optionKey === optionKey);
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

export type UseMarket = {
  viewerId: string | null;
  question: string;
  status: MarketStatus;
  locksAt: string | null;
  resolvedOptionKey: string | null;
  resolvedLabel: string | null;
  outcomes: Outcome[];
  wallet: Wallet | null;
  positions: ViewerPosition[];
  positionsForDisplay: PositionForDisplay[];
  totalPool: number;
  backersTotal: number;
  stakedInPlay: number;
  potential: number;
  sessionDelta: number;
  settledPayout: number;
  isLoading: boolean;
  syncStatus: SyncStatus;
  syncing: boolean;
  loadError: string | null;
  activity: ActivityEntry[];
  toast: Toast | null;
  dismissToast: () => void;
  resolution: Resolution | null;
  handleStake: (optionKey: string, amount: number) => Promise<void>;
};

export function useMarket(): UseMarket {
  const viewerId = useViewerId();
  const [meta, setMeta] = useState<MarketMeta>(DEFAULT_META);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [positions, setPositions] = useState<ViewerPosition[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [isLoading, setIsLoading] = useState(true);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [resolution, setResolution] = useState<Resolution | null>(null);

  const stakeFloorsRef = useRef<Record<string, number>>({});
  const postStakeBypassUntilRef = useRef(0);
  const syncedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevStatusRef = useRef<MarketStatus | null>(null);
  const hasHydratedRef = useRef(false);

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
    if (!hasHydratedRef.current) {
      prevStatusRef.current = state.status;
      hasHydratedRef.current = true;
    }
  }, []);

  const refreshMarket = useCallback(
    async (bypassCache = false) => {
      const hasPendingFloors = Object.keys(stakeFloorsRef.current).length > 0;
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

  // Auto-dismiss transient toasts.
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(id);
  }, [toast]);

  // When the market transitions to resolved (admin settlement ran), pull the
  // settled wallet balance + per-stake payouts so banner/positions update
  // without a manual refresh, then emit a one-shot resolution event.
  // prevStatusRef is seeded from the first server hydrate so revisiting an
  // already-resolved market does not replay the celebration banner.
  useEffect(() => {
    if (!hasHydratedRef.current) return;

    const prev = prevStatusRef.current;
    if (prev === null) {
      prevStatusRef.current = meta.status;
      return;
    }
    if (prev === meta.status) return;

    prevStatusRef.current = meta.status;
    if (meta.status === "resolved" && prev !== "resolved" && viewerId) {
      void (async () => {
        const [walletResult, posResult] = await Promise.all([
          getWallet(viewerId),
          getViewerPositions(viewerId),
        ]);
        let balance = 0;
        if (walletResult.ok) {
          setWallet(walletResult.wallet);
          balance = walletResult.wallet.balance;
        }
        let settled = 0;
        if (posResult.ok) {
          setPositions(posResult.positions);
          settled = posResult.positions
            .filter((p) => p.settled)
            .reduce((sum, p) => sum + p.payout, 0);
        }
        setResolution({
          id: Date.now(),
          userWon: settled > 0,
          payout: settled,
          balance,
        });
      })();
    }
  }, [meta.status, viewerId]);

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

  const backersTotal = useMemo(
    () => outcomes.reduce((sum, o) => sum + o.backerCount, 0),
    [outcomes]
  );

  const handleStake = useCallback(
    async (optionKey: string, amount: number) => {
      if (!viewerId || !wallet || syncStatus === "syncing") return;
      if (meta.status !== "open") {
        setToast({
          message:
            meta.status === "locked"
              ? "Market is locked — staking is closed."
              : "Market has resolved — staking is closed.",
          variant: "muted",
        });
        setSyncStatus("error");
        return;
      }
      if (wallet.balance < amount) {
        setToast({
          message: "Not enough Hype Credits for this stake.",
          variant: "error",
        });
        setSyncStatus("error");
        return;
      }

      const snapshot = {
        outcomes: outcomes.map((o) => ({ ...o })),
        wallet: { ...wallet },
      };

      const target = outcomes.find((o) => o.optionKey === optionKey);
      const label = target?.label ?? optionKey;
      const oddsAtStake = target?.decimalOdds ?? 0;

      const priorStaked = target?.stakedTotal ?? 0;
      const optimisticFloor = priorStaked + amount;
      stakeFloorsRef.current[optionKey] = optimisticFloor;

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
          delete stakeFloorsRef.current[optionKey];
          postStakeBypassUntilRef.current = 0;
          setOutcomes(snapshot.outcomes);
          setWallet(snapshot.wallet);
          setToast({ message: result.message, variant: "error" });
          setSyncStatus("error");

          if (
            result.code === "market_locked" ||
            result.code === "market_closed"
          ) {
            await refreshMarket(true);
          }
          return;
        }

        // Authoritative balance from the committed transaction.
        setWallet(result.wallet);
        setActivity((prev) =>
          [
            {
              id: `${Date.now()}-${optionKey}`,
              amount,
              optionKey,
              label,
              at: Date.now(),
            },
            ...prev,
          ].slice(0, MAX_ACTIVITY)
        );
        setToast({
          message: `Staked ${amount.toLocaleString()} on ${label}${
            oddsAtStake > 0 ? ` at ${oddsAtStake.toFixed(2)}×` : ""
          }`,
          variant: "success",
        });
        postStakeBypassUntilRef.current = Date.now() + POST_STAKE_CACHE_BYPASS_MS;
        await refreshMarket(true);
        await refreshPositions();
        markSynced();
      } catch (err) {
        delete stakeFloorsRef.current[optionKey];
        postStakeBypassUntilRef.current = 0;
        setOutcomes(snapshot.outcomes);
        setWallet(snapshot.wallet);
        setToast({
          message:
            err instanceof Error && err.message === "Stake request timed out"
              ? "Stake timed out — check your connection and try again."
              : "Network error — stake not saved. Try again.",
          variant: "error",
        });
        setSyncStatus("error");
      }
    },
    [
      viewerId,
      wallet,
      syncStatus,
      meta.status,
      outcomes,
      refreshMarket,
      refreshPositions,
      markSynced,
    ]
  );

  const resolvedLabel = useMemo(() => {
    if (meta.status !== "resolved" || !meta.resolvedOptionKey) return null;
    return (
      outcomes.find((o) => o.optionKey === meta.resolvedOptionKey)?.label ?? null
    );
  }, [meta.status, meta.resolvedOptionKey, outcomes]);

  const settledPayout = useMemo(
    () =>
      positions.filter((p) => p.settled).reduce((sum, p) => sum + p.payout, 0),
    [positions]
  );

  const stakedInPlay = useMemo(
    () =>
      positions
        .filter((p) => !p.settled)
        .reduce((sum, p) => sum + p.amount, 0),
    [positions]
  );

  /** Live potential payout from current crowd odds (DB payout is 0 until settlement). */
  const positionsForDisplay = useMemo<PositionForDisplay[]>(() => {
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

  const potential = useMemo(
    () =>
      positionsForDisplay
        .filter((p) => !p.settled)
        .reduce((sum, p) => sum + p.payout, 0),
    [positionsForDisplay]
  );

  const sessionDelta = useMemo(
    () => (wallet ? wallet.balance - INITIAL_WALLET_BALANCE : 0),
    [wallet]
  );

  const dismissToast = useCallback(() => setToast(null), []);

  return {
    viewerId,
    question: meta.question,
    status: meta.status,
    locksAt: meta.locksAt,
    resolvedOptionKey: meta.resolvedOptionKey,
    resolvedLabel,
    outcomes,
    wallet,
    positions,
    positionsForDisplay,
    totalPool,
    backersTotal,
    stakedInPlay,
    potential,
    sessionDelta,
    settledPayout,
    isLoading,
    syncStatus,
    syncing: syncStatus === "syncing",
    loadError,
    activity,
    toast,
    dismissToast,
    resolution,
    handleStake,
  };
}
