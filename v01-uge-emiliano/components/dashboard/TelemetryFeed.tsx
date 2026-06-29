"use client";

import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ListOrdered, Pin } from "lucide-react";
import {
  actionStyle,
  eventTimestamp,
  type TelemetryEvent,
} from "@/lib/telemetry/types";
import {
  computeEventWindowShare,
  formatMomentumDelta,
  playerTeam,
  TEAM_COLORS,
  teamLabel,
} from "@/lib/telemetry/momentum";

interface TelemetryFeedProps {
  events: TelemetryEvent[];
  activePlayer: string | null;
  lockedPlayer: string | null;
  onHoverPlayer: (playerId: string | null) => void;
  onLockPlayer: (playerId: string | null) => void;
  /** Shared 1s clock — keeps feed % aligned with the momentum bar window. */
  now: number;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function TelemetryFeed({
  events,
  activePlayer,
  lockedPlayer,
  onHoverPlayer,
  onLockPlayer,
  now,
}: TelemetryFeedProps) {
  const feedRef = useRef<HTMLDivElement>(null);

  const momentumShares = useMemo(() => {
    const shares = new Map<string, number>();
    for (const event of events) {
      const share = computeEventWindowShare(event, events, now);
      if (share !== null) shares.set(event.SK, share);
    }
    return shares;
  }, [events, now]);

  useEffect(() => {
    if (!lockedPlayer) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (feedRef.current?.contains(target)) return;
      if ((target as Element).closest?.("[data-telemetry-map]")) return;
      onLockPlayer(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [lockedPlayer, onLockPlayer]);

  // useTelemetryStream already stores events newest-first.
  return (
    <div ref={feedRef} className="flex flex-col rounded-lg border border-edge bg-panel-2">
      <div className="flex items-center gap-2 border-b border-edge px-3 py-2">
        <ListOrdered className="h-3.5 w-3.5 text-brand-strong" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Event Feed</h3>
        <span className="ml-auto font-mono text-[10px] text-ink-faint">{events.length} events</span>
      </div>

      <div className="p-3">
        <div className="aspect-square w-full overflow-y-auto rounded-md border border-edge bg-panel/40 p-2">
        {events.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <span className="text-xs text-ink-faint">No events yet</span>
          </div>
        ) : (
          <ul
            className="flex flex-col gap-1.5"
            onMouseLeave={() => onHoverPlayer(null)}
          >
            <AnimatePresence initial={false}>
              {events.map((e) => {
                const s = actionStyle(e.Action);
                const team = playerTeam(e.PlayerId);
                const color = TEAM_COLORS[team].dot;
                const momentumShare = momentumShares.get(e.SK);
                const isActive = activePlayer === e.PlayerId;
                const isLocked = lockedPlayer === e.PlayerId;
                const isDimmed = activePlayer !== null && !isActive;
                return (
                  <motion.li
                    key={e.SK}
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: isDimmed ? 0.4 : 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onMouseEnter={() => onHoverPlayer(e.PlayerId)}
                    onClick={() => onLockPlayer(e.PlayerId)}
                    aria-pressed={isLocked}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-2.5 py-2 transition-colors ${
                      isLocked
                        ? "border-brand bg-brand/15 ring-1 ring-brand/40"
                        : isActive
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
                        {isLocked && (
                          <Pin
                            className="h-2.5 w-2.5 shrink-0 text-brand-strong"
                            aria-hidden
                          />
                        )}
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
                        {momentumShare !== undefined && (
                          <span
                            className={`font-mono text-[9px] font-semibold tabular-nums ${
                              momentumShare > 0
                                ? "text-alpha"
                                : momentumShare < 0
                                  ? "text-beta"
                                  : "text-ink-faint"
                            }`}
                            title="Share of the current 5-minute momentum window"
                          >
                            {formatMomentumDelta(momentumShare)}
                          </span>
                        )}
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
    </div>
  );
}
