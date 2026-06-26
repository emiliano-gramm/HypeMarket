"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ListOrdered } from "lucide-react";
import {
  actionStyle,
  eventTimestamp,
  type TelemetryEvent,
} from "@/lib/telemetry/types";
import {
  playerTeam,
  TEAM_COLORS,
  teamLabel,
} from "@/lib/telemetry/momentum";

interface TelemetryFeedProps {
  events: TelemetryEvent[];
  activePlayer: string | null;
  onActivePlayer: (playerId: string | null) => void;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function TelemetryFeed({ events, activePlayer, onActivePlayer }: TelemetryFeedProps) {
  // useTelemetryStream already stores events newest-first.
  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-edge bg-panel-2">
      <div className="flex shrink-0 items-center gap-2 border-b border-edge px-3 py-2">
        <ListOrdered className="h-3.5 w-3.5 text-brand-strong" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Event Feed</h3>
        <span className="ml-auto font-mono text-[10px] text-ink-faint">{events.length} events</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {events.length === 0 ? (
          <div className="flex h-full min-h-[180px] items-center justify-center">
            <span className="text-xs text-ink-faint">No events yet</span>
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5" onMouseLeave={() => onActivePlayer(null)}>
            <AnimatePresence initial={false}>
              {events.map((e) => {
                const s = actionStyle(e.Action);
                const team = playerTeam(e.PlayerId);
                const color = TEAM_COLORS[team].dot;
                const isActive = activePlayer === e.PlayerId;
                const isDimmed = activePlayer !== null && !isActive;
                return (
                  <motion.li
                    key={e.SK}
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: isDimmed ? 0.4 : 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onMouseEnter={() => onActivePlayer(e.PlayerId)}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-2.5 py-2 transition-colors ${
                      isActive
                        ? "border-brand/50 bg-brand/10"
                        : "border-edge bg-panel/40 hover:border-brand/30"
                    }`}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-xs font-medium text-ink">{e.PlayerId}</span>
                        <span
                          className={`rounded border px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${TEAM_COLORS[team].badge}`}
                        >
                          {teamLabel(team)}
                        </span>
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${s.badge}`}
                        >
                          {s.label}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-ink-faint">
                        x:{e.CoordinateX.toFixed(1)} y:{e.CoordinateY.toFixed(1)}
                      </span>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-ink-faint">
                      {formatTime(eventTimestamp(e))}
                    </span>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}
