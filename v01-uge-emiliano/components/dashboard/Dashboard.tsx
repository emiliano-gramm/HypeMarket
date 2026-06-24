"use client";

import { Activity, Crosshair, Flag, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { ConnectionBadge } from "@/components/dashboard/ConnectionBadge";
import { LiveStreamPanel } from "@/components/dashboard/LiveStreamPanel";
import { SocialPanel } from "@/components/dashboard/SocialPanel";
import { TelemetryFeed } from "@/components/dashboard/TelemetryFeed";
import { TelemetryMap } from "@/components/dashboard/TelemetryMap";
import { ThemeSwitcher } from "@/components/dashboard/ThemeSwitcher";
import { useTelemetryStream } from "@/lib/telemetry/useTelemetryStream";

const STREAM_EMBED_URL = process.env.NEXT_PUBLIC_STREAM_EMBED_URL;

function StatPill({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-edge bg-panel-2 px-3 py-1.5">
      <span className={accent}>{icon}</span>
      <span className="font-mono text-lg font-bold tabular-nums text-ink">{value}</span>
      <span className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">{label}</span>
    </div>
  );
}

function TelemetrySkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="aspect-square w-full animate-pulse rounded-lg bg-edge/60" />
      <div className="min-h-[220px] w-full animate-pulse rounded-lg bg-edge/60" />
    </div>
  );
}

function StreamSkeleton() {
  return (
    <section className="overflow-hidden rounded-xl border border-edge bg-panel">
      <div className="flex items-center justify-between border-b border-edge px-4 py-3">
        <div className="h-4 w-32 animate-pulse rounded bg-edge" />
        <div className="h-5 w-12 animate-pulse rounded bg-edge" />
      </div>
      <div className="aspect-video w-full animate-pulse bg-edge/60" />
    </section>
  );
}

export function Dashboard() {
  const { events, status, error, matchId, topic } = useTelemetryStream();
  const [activePlayer, setActivePlayer] = useState<string | null>(null);

  const hasEvents = events.length > 0;
  // Show skeletons while we are still establishing the stream and nothing has
  // arrived yet; once real telemetry flows we always render the live panels.
  const showSkeleton = !hasEvents && (status === "idle" || status === "connecting");

  const { kills, objectives } = useMemo(
    () => ({
      kills: events.filter((e) => e.Action === "Kill").length,
      objectives: events.filter((e) => e.Action === "Objective").length,
    }),
    [events]
  );

  return (
    <div className="min-h-screen bg-app text-ink">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-5 lg:px-6">
        {/* HEADER */}
        <header className="mb-5 flex flex-col gap-3 border-b border-edge pb-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-brand/30 bg-brand/15">
              <Trophy className="h-5 w-5 text-brand-strong" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-strong">
                Ultimate Global Entertainment
              </p>
              <h1 className="text-pretty text-lg font-bold tracking-tight text-ink sm:text-xl md:text-2xl">
                Live Match Command Center
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ThemeSwitcher />
            <ConnectionBadge status={status} topic={topic} error={error} />
          </div>
        </header>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* LEFT COLUMN */}
          <div className="flex min-w-0 flex-col gap-5">
            {showSkeleton ? (
              <StreamSkeleton />
            ) : (
              <LiveStreamPanel matchId={matchId} streamEmbedUrl={STREAM_EMBED_URL} />
            )}

            {/* REAL-TIME TELEMETRY */}
            <section className="rounded-xl border border-edge bg-panel">
              <div className="flex flex-wrap items-center gap-3 border-b border-edge px-4 py-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-brand-strong" />
                  <h2 className="text-sm font-semibold tracking-wide text-ink">Real-Time Telemetry</h2>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <StatPill
                    icon={<Crosshair className="h-4 w-4" />}
                    label="Kills"
                    value={kills}
                    accent="text-red-500"
                  />
                  <StatPill
                    icon={<Flag className="h-4 w-4" />}
                    label="Objectives"
                    value={objectives}
                    accent="text-amber-500"
                  />
                </div>
              </div>

              <div className="p-4">
                {showSkeleton ? (
                  <TelemetrySkeleton />
                ) : hasEvents ? (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <TelemetryMap
                      events={events}
                      activePlayer={activePlayer}
                      onActivePlayer={setActivePlayer}
                    />
                    <TelemetryFeed
                      events={events}
                      activePlayer={activePlayer}
                      onActivePlayer={setActivePlayer}
                    />
                  </div>
                ) : (
                  <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-edge">
                    <Activity className="h-6 w-6 text-ink-faint" />
                    <p className="text-sm text-ink-faint">
                      Waiting for telemetry… run{" "}
                      <code className="font-mono text-ink-muted">node producer.js</code>
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN */}
          <SocialPanel />
        </div>
      </div>
    </div>
  );
}
