"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Crosshair } from "lucide-react";
import { memo, useMemo } from "react";
import { actionStyle, type TelemetryEvent } from "@/lib/telemetry/types";
import {
  playerTeam,
  TEAM_COLORS,
  teamLabel,
} from "@/lib/telemetry/momentum";

interface TelemetryMapProps {
  events: TelemetryEvent[];
  activePlayer: string | null;
  onActivePlayer: (playerId: string | null) => void;
}

interface PlayerDotData {
  playerId: string;
  x: number;
  y: number;
  isKill: boolean;
  sk: string;
  latest: TelemetryEvent;
}

const GRID_LINES = [20, 40, 60, 80];

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

const PlayerDot = memo(function PlayerDot({
  dot,
  isActive,
  isDimmed,
  onActivePlayer,
}: {
  dot: PlayerDotData;
  isActive: boolean;
  isDimmed: boolean;
  onActivePlayer: (playerId: string | null) => void;
}) {
  const s = actionStyle(dot.latest.Action);
  const team = playerTeam(dot.playerId);
  const color = TEAM_COLORS[team].dot;
  const teamName = teamLabel(team);

  return (
    <motion.div
      className="absolute cursor-pointer"
      initial={false}
      animate={{
        left: `${dot.x}%`,
        top: `${dot.y}%`,
        opacity: isDimmed ? 0.2 : 1,
      }}
      transition={{ type: "spring", stiffness: 120, damping: 18 }}
      style={{ transform: "translate(-50%, -50%)", zIndex: isActive ? 20 : 10 }}
      onMouseEnter={() => onActivePlayer(dot.playerId)}
    >
      {(dot.isKill || isActive) && (
        <motion.span
          key={`flash-${dot.sk}`}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ backgroundColor: dot.isKill ? "#ef4444" : color }}
          initial={{ width: 8, height: 8, opacity: 0.8 }}
          animate={{ width: 36, height: 36, opacity: 0 }}
          transition={{ duration: 0.9, repeat: Number.POSITIVE_INFINITY, repeatDelay: 0.4 }}
        />
      )}
      <motion.span
        className="relative block rounded-full ring-2 ring-arena"
        animate={{ scale: isActive ? 1.6 : 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        style={{
          height: 10,
          width: 10,
          backgroundColor: color,
          boxShadow: `0 0 ${isActive ? 14 : 8}px ${color}`,
        }}
      />

      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-max -translate-x-1/2 rounded-md border border-edge bg-panel/95 px-2.5 py-1.5 shadow-xl"
          >
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs font-semibold text-ink">{dot.playerId}</span>
              <span
                className={`rounded border px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${TEAM_COLORS[team].badge}`}
              >
                {teamName}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${s.badge}`}
              >
                {s.label}
              </span>
              <span className="font-mono text-[10px] text-ink-faint">
                x:{dot.latest.CoordinateX.toFixed(0)} y:{dot.latest.CoordinateY.toFixed(0)}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export function TelemetryMap({ events, activePlayer, onActivePlayer }: TelemetryMapProps) {
  const dots = useMemo<PlayerDotData[]>(() => {
    // Events are newest-first — the first event seen per player is their latest.
    const latest = new Map<string, TelemetryEvent>();
    for (const e of events) {
      if (!latest.has(e.PlayerId)) latest.set(e.PlayerId, e);
    }
    return Array.from(latest.values()).map((e) => ({
      playerId: e.PlayerId,
      // Producer emits coordinates in a 0–100 space; flip Y so 0 is the bottom.
      x: clampPercent(e.CoordinateX),
      y: clampPercent(100 - e.CoordinateY),
      isKill: e.Action === "Kill",
      sk: e.SK,
      latest: e,
    }));
  }, [events]);

  return (
    <div className="flex flex-col rounded-lg border border-edge bg-panel-2">
      <div className="flex items-center gap-2 border-b border-edge px-3 py-2">
        <Crosshair className="h-3.5 w-3.5 text-brand-strong" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Arena Map</h3>
        {activePlayer ? (
          <span className="ml-auto font-mono text-[10px] text-brand-strong">{activePlayer}</span>
        ) : (
          <span className="ml-auto font-mono text-[10px] text-ink-faint">{dots.length} players</span>
        )}
      </div>

      <div className="p-3">
        <div
          className="relative aspect-square w-full overflow-hidden rounded-md border border-edge bg-arena"
          onMouseLeave={() => onActivePlayer(null)}
        >
          <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
            {GRID_LINES.map((p) => (
              <line key={`v${p}`} x1={`${p}%`} y1="0" x2={`${p}%`} y2="100%" stroke="rgba(255,255,255,0.05)" />
            ))}
            {GRID_LINES.map((p) => (
              <line key={`h${p}`} x1="0" y1={`${p}%`} x2="100%" y2={`${p}%`} stroke="rgba(255,255,255,0.05)" />
            ))}
          </svg>
          <div className="glow-brand pointer-events-none absolute inset-0" />

          {dots.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs text-ink-faint">No positions yet</span>
            </div>
          ) : (
            dots.map((d) => (
              <PlayerDot
                key={d.playerId}
                dot={d}
                isActive={activePlayer === d.playerId}
                isDimmed={activePlayer !== null && activePlayer !== d.playerId}
                onActivePlayer={onActivePlayer}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
