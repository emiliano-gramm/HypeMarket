"use client";

import { ConnectionBadge } from "@/components/dashboard/ConnectionBadge";
import { LiveStreamPanel } from "@/components/dashboard/LiveStreamPanel";
import { SocialPanel } from "@/components/dashboard/SocialPanel";
import { TelemetryFeed } from "@/components/dashboard/TelemetryFeed";
import { TelemetryMap } from "@/components/dashboard/TelemetryMap";
import { useTelemetryStream } from "@/lib/telemetry/useTelemetryStream";

export function Dashboard() {
  const { events, status, error, matchId, topic } = useTelemetryStream();

  const killCount = events.filter((e) => e.Action === "Kill").length;
  const objectiveCount = events.filter((e) => e.Action === "Objective").length;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-950/90 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-violet-400">
              Ultimate Global Entertainment
            </p>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Live Match Command Center
            </h1>
          </div>
          <ConnectionBadge status={status} topic={topic} error={error} />
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1600px] flex-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-6">
        <div className="flex min-h-0 flex-col gap-4">
          <LiveStreamPanel matchId={matchId} />

          <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
                  Real-Time Telemetry
                </p>
                <h2 className="text-sm font-semibold text-zinc-100">
                  IoT stream · {events.length} events buffered
                </h2>
              </div>
              <div className="flex gap-2">
                <StatPill label="Kills" value={killCount} tone="red" />
                <StatPill label="Objectives" value={objectiveCount} tone="amber" />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <TelemetryMap events={events} />
              <TelemetryFeed events={events} />
            </div>
          </section>
        </div>

        <SocialPanel />
      </main>
    </div>
  );
}

function StatPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "red" | "amber";
}) {
  const toneClass =
    tone === "red"
      ? "border-red-500/30 bg-red-500/10 text-red-300"
      : "border-amber-500/30 bg-amber-500/10 text-amber-300";

  return (
    <div
      className={`rounded-lg border px-3 py-1.5 text-center ${toneClass}`}
    >
      <p className="text-[10px] uppercase tracking-wider opacity-80">{label}</p>
      <p className="font-mono text-sm font-semibold">{value}</p>
    </div>
  );
}
