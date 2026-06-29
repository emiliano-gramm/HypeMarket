"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";

import { ConnectionBadge } from "@/components/dashboard/ConnectionBadge";
import { TelemetryFeed } from "@/components/dashboard/TelemetryFeed";
import { TelemetryMap } from "@/components/dashboard/TelemetryMap";
import { OddsInfoPopover } from "@/components/dashboard/market/OddsInfoPopover";
import { PositionsList } from "@/components/dashboard/market/PositionsList";

import { ActivityFeed } from "@/components/hypemarket/activity-feed";
import { ArenaIntel } from "@/components/hypemarket/arena-intel";
import { MobileTabs, type MobileTab } from "@/components/hypemarket/mobile-tabs";
import { MomentumStrip } from "@/components/hypemarket/momentum-strip";
import { PoolPulse } from "@/components/hypemarket/pool-pulse";
import { PredictionMarket } from "@/components/hypemarket/prediction-market";
import { ResolvedBanner } from "@/components/hypemarket/resolved-banner";
import { StakeSuccessToast } from "@/components/hypemarket/stake-success-toast";
import { StreamTheater } from "@/components/hypemarket/stream-theater";
import { TopBar } from "@/components/hypemarket/top-bar";
import { WalletCard } from "@/components/hypemarket/wallet-card";
import type {
  ActivityItem,
  MarketStatus as V0MarketStatus,
  Outcome as V0Outcome,
  OutcomeKey,
} from "@/components/hypemarket/types";

import { computeMomentumBreakdown } from "@/lib/telemetry/momentum";
import { useTelemetryStream } from "@/lib/telemetry/useTelemetryStream";
import { useMarket, type Resolution } from "@/lib/markets/useMarket";

const STREAM_EMBED_URL = process.env.NEXT_PUBLIC_STREAM_EMBED_URL;

/** Binary market: first outcome → "alpha" styling, second → "beta". */
const KEY_TO_OUTCOME: Record<string, OutcomeKey> = {
  "team-a": "alpha",
  "team-b": "beta",
};

function toOutcomeKey(optionKey: string, index: number): OutcomeKey {
  return KEY_TO_OUTCOME[optionKey] ?? (index === 0 ? "alpha" : "beta");
}

function formatCountdown(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function MarketCardSkeleton() {
  return (
    <section className="rounded-xl border border-edge bg-panel" aria-hidden="true">
      <div className="flex items-center justify-between border-b border-edge px-4 py-3">
        <div className="h-4 w-32 animate-pulse rounded bg-edge" />
        <div className="h-5 w-14 animate-pulse rounded bg-edge" />
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="h-3 w-40 animate-pulse rounded bg-edge" />
        {[0, 1].map((i) => (
          <div key={i} className="h-14 w-full animate-pulse rounded-lg bg-edge/70" />
        ))}
        <div className="h-10 w-full animate-pulse rounded-lg bg-edge/60" />
      </div>
    </section>
  );
}

export function Dashboard() {
  const { events, status, error, reconnectAttempt, matchId, topic } =
    useTelemetryStream();
  const market = useMarket();

  const [lockedPlayer, setLockedPlayer] = useState<string | null>(null);
  const [hoverPlayer, setHoverPlayer] = useState<string | null>(null);
  const activePlayer = lockedPlayer ?? hoverPlayer;

  const handleHoverPlayer = (playerId: string | null) => {
    if (!lockedPlayer) setHoverPlayer(playerId);
  };

  const handleLockPlayer = (playerId: string | null) => {
    setLockedPlayer(playerId);
    setHoverPlayer(null);
  };
  const [mobileTab, setMobileTab] = useState<MobileTab>("predict");
  const [banner, setBanner] = useState<Resolution | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // One shared 1s clock drives the lock countdown + "Ns ago" activity stamps.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Surface a one-shot resolution celebration banner when settlement lands.
  useEffect(() => {
    if (market.resolution) setBanner(market.resolution);
  }, [market.resolution]);

  const connected = status === "connected";
  const hasEvents = events.length > 0;

  const { momentum } = useMemo(
    () => computeMomentumBreakdown(events, now),
    [events, now]
  );
  const alphaShare = (momentum + 1) / 2;

  const { kills, objectives } = useMemo(
    () => ({
      kills: events.filter((e) => e.Action === "Kill").length,
      objectives: events.filter((e) => e.Action === "Objective").length,
    }),
    [events]
  );
  const objectiveLabel = hasEvents
    ? `${kills} kills · ${objectives} obj`
    : "awaiting feed";

  // --- Market view-model adapters (app types → v0 presentational types) -----
  const { outcomes } = market;

  const v0Outcomes: V0Outcome[] = useMemo(
    () =>
      outcomes.map((o, i) => ({
        key: toOutcomeKey(o.optionKey, i),
        team: o.label,
        tag: "",
        odds: o.decimalOdds,
        share: o.impliedProb,
        pool: o.stakedTotal,
        backers: o.backerCount,
      })),
    [outcomes]
  );

  const optionKeyByOutcomeKey = useMemo(() => {
    const map = new Map<OutcomeKey, string>();
    outcomes.forEach((o, i) => map.set(toOutcomeKey(o.optionKey, i), o.optionKey));
    return map;
  }, [outcomes]);

  const v0Status: V0MarketStatus =
    market.status === "open" ? "live" : market.status;

  const winnerKey: OutcomeKey | undefined = useMemo(() => {
    if (!market.resolvedOptionKey) return undefined;
    const idx = outcomes.findIndex(
      (o) => o.optionKey === market.resolvedOptionKey
    );
    return toOutcomeKey(market.resolvedOptionKey, idx < 0 ? 0 : idx);
  }, [market.resolvedOptionKey, outcomes]);

  const closesIn = useMemo(() => {
    if (!market.locksAt) return "";
    return formatCountdown(new Date(market.locksAt).getTime() - now);
  }, [market.locksAt, now]);

  const activityItems: ActivityItem[] = useMemo(
    () =>
      market.activity.map((a) => {
        const idx = outcomes.findIndex((o) => o.optionKey === a.optionKey);
        return {
          id: a.id,
          user: "you",
          amount: a.amount,
          team: a.label,
          outcomeKey: toOutcomeKey(a.optionKey, idx < 0 ? 0 : idx),
          ago: Math.max(0, Math.floor((now - a.at) / 1000)),
        };
      }),
    [market.activity, outcomes, now]
  );

  function handleV0Stake(key: OutcomeKey, amount: number) {
    const optionKey = optionKeyByOutcomeKey.get(key);
    if (optionKey) void market.handleStake(optionKey, amount);
  }

  const showMarketSkeleton = market.isLoading && outcomes.length === 0;

  return (
    <div className="min-h-dvh bg-app text-ink">
      <TopBar
        connected={connected}
        connection={
          <ConnectionBadge
            status={status}
            topic={topic}
            error={error}
            reconnectAttempt={reconnectAttempt}
          />
        }
      />

      <main className="mx-auto max-w-[1600px] px-3 pb-24 pt-4 sm:px-4 lg:px-6 lg:pb-8">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* LEFT — stream + telemetry */}
          <div
            className={`flex-col gap-3 ${
              mobileTab === "predict" ? "hidden lg:flex" : "flex"
            }`}
          >
            <div className={mobileTab === "arena" ? "hidden lg:block" : "block"}>
              <StreamTheater
                title={`Live Match · ${matchId}`}
                embedUrl={STREAM_EMBED_URL}
              />
              <div className="mt-2">
                <MomentumStrip
                  alphaTeam="Team Alpha"
                  betaTeam="Team Bravo"
                  alphaShare={alphaShare}
                />
              </div>
            </div>

            <div className={mobileTab === "watch" ? "hidden lg:block" : "block"}>
              <ArenaIntel
                objective={objectiveLabel}
                map={
                  <TelemetryMap
                    events={events}
                    activePlayer={activePlayer}
                    lockedPlayer={lockedPlayer}
                    onHoverPlayer={handleHoverPlayer}
                    onLockPlayer={handleLockPlayer}
                  />
                }
                feed={
                  <TelemetryFeed
                    events={events}
                    activePlayer={activePlayer}
                    lockedPlayer={lockedPlayer}
                    onHoverPlayer={handleHoverPlayer}
                    onLockPlayer={handleLockPlayer}
                    now={now}
                  />
                }
              />
            </div>
          </div>

          {/* RIGHT RAIL — wallet + market + pool + positions + activity */}
          <aside
            className={`${
              mobileTab === "predict" ? "block" : "hidden lg:block"
            }`}
          >
            <div className="flex flex-col gap-4 scroll-thin lg:sticky lg:top-[72px] lg:max-h-[calc(100dvh-88px)] lg:overflow-y-auto lg:pr-1">
              <WalletCard
                balance={market.wallet?.balance ?? 0}
                staked={market.stakedInPlay}
                potential={Math.round(market.potential)}
                sessionDelta={market.sessionDelta}
              />

              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                  Pool {market.totalPool.toLocaleString()} · parimutuel
                </p>
                <OddsInfoPopover />
              </div>

              {market.loadError && (
                <p className="text-xs text-[var(--live)]">{market.loadError}</p>
              )}

              {showMarketSkeleton ? (
                <MarketCardSkeleton />
              ) : (
                <PredictionMarket
                  question={market.question}
                  outcomes={v0Outcomes}
                  balance={market.wallet?.balance ?? 0}
                  closesIn={closesIn}
                  status={v0Status}
                  winnerKey={winnerKey}
                  onStake={handleV0Stake}
                />
              )}

              <PoolPulse pool={market.totalPool} backers={market.backersTotal} />

              <PositionsList positions={market.positionsForDisplay} />

              <ActivityFeed items={activityItems} />

              <p className="text-[10px] leading-relaxed text-ink-faint">
                Odds are crowd-implied (parimutuel) — telemetry only moves the
                momentum strip.
              </p>
            </div>
          </aside>
        </div>
      </main>

      <MobileTabs active={mobileTab} onChange={setMobileTab} />

      {banner && (
        <ResolvedBanner
          userWon={banner.userWon}
          payout={banner.payout}
          newBalance={banner.balance}
          onDismiss={() => setBanner(null)}
        />
      )}

      <AnimatePresence>
        {market.toast && (
          <StakeSuccessToast
            key="toast"
            message={market.toast.message}
            variant={market.toast.variant}
            onDismiss={market.dismissToast}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
