"use client";

import { useMemo } from "react";
import type { TelemetryEvent } from "@/lib/telemetry/types";

const PLAYER_COLORS = [
  "#f87171",
  "#60a5fa",
  "#34d399",
  "#fbbf24",
  "#a78bfa",
  "#fb7185",
  "#2dd4bf",
  "#f97316",
  "#818cf8",
  "#4ade80",
];

function playerColor(playerId: string) {
  const index = Number(playerId.replace("Player_", "")) || 0;
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}

interface TelemetryMapProps {
  events: TelemetryEvent[];
}

export function TelemetryMap({ events }: TelemetryMapProps) {
  const positions = useMemo(() => {
    const latest = new Map<string, TelemetryEvent>();
    for (const event of [...events].reverse()) {
      if (!latest.has(event.PlayerId)) {
        latest.set(event.PlayerId, event);
      }
    }
    return Array.from(latest.values());
  }, [events]);

  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-zinc-800 bg-[radial-gradient(circle_at_center,_#1a1a1a_0%,_#09090b_70%)]">
      <div className="absolute inset-0 opacity-30">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={`h-${i}`}
            className="absolute left-0 right-0 border-t border-zinc-700/50"
            style={{ top: `${(i + 1) * 16.66}%` }}
          />
        ))}
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={`v-${i}`}
            className="absolute bottom-0 top-0 border-l border-zinc-700/50"
            style={{ left: `${(i + 1) * 12.5}%` }}
          />
        ))}
      </div>

      {positions.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-500">
          Player positions will appear here
        </div>
      ) : (
        positions.map((event) => (
          <div
            key={event.PlayerId}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${event.CoordinateX}%`,
              top: `${100 - event.CoordinateY}%`,
            }}
            title={`${event.PlayerId} · ${event.Action}`}
          >
            <span
              className="block h-3 w-3 rounded-full ring-2 ring-black/60"
              style={{ backgroundColor: playerColor(event.PlayerId) }}
            />
            <span className="mt-1 block whitespace-nowrap text-center font-mono text-[9px] text-zinc-300">
              {event.PlayerId.replace("Player_", "P")}
            </span>
          </div>
        ))
      )}

      <div className="absolute left-2 top-2 rounded bg-black/50 px-2 py-1 text-[10px] uppercase tracking-wider text-zinc-400">
        Arena map
      </div>
    </div>
  );
}
