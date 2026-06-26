// Pure telemetry-derived momentum. No I/O — unit-testable by hand.
//
// Momentum is a SEPARATE signal from the crowd-implied market odds: it reflects
// recent match flow (kills/objectives) over a short sliding window, while the
// odds come only from how the crowd stakes. The UI labels them distinctly so we
// never claim telemetry sets the odds (see updated_idea.md honesty guardrails).

import type { TelemetryEvent } from "@/lib/telemetry/types";
import { eventTimestamp } from "@/lib/telemetry/types";

/** Only events newer than this (relative to "now") count toward momentum. */
export const MOMENTUM_WINDOW_MS = 15_000;

/** Action impact weights. Movement is noise and contributes nothing. */
const ACTION_WEIGHTS: Record<string, number> = {
  Objective: 3,
  Kill: 2,
  Assist: 1,
  Movement: 0,
};

export type MomentumTeam = "alpha" | "bravo";

export const TEAM_ALPHA_LABEL = "Team Alpha";
export const TEAM_BRAVO_LABEL = "Team Bravo";

/** Dot / accent colors — Alpha = brand violet, Bravo = sky blue. */
export const TEAM_COLORS: Record<MomentumTeam, { dot: string; badge: string }> = {
  alpha: { dot: "#8b5cf6", badge: "bg-brand/15 text-brand-strong border-brand/30" },
  bravo: { dot: "#38bdf8", badge: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
};

/**
 * The mock producer emits Player_0…Player_9 with no team field, so we split the
 * roster deterministically: 0–4 → Alpha (team-a), 5–9 → Bravo (team-b).
 * Real game telemetry would carry an explicit team id instead.
 */
export function playerTeam(playerId: string): MomentumTeam {
  const n = Number.parseInt(playerId.replace(/\D/g, ""), 10);
  return Number.isFinite(n) && n >= 5 ? "bravo" : "alpha";
}

export function teamLabel(team: MomentumTeam): string {
  return team === "alpha" ? TEAM_ALPHA_LABEL : TEAM_BRAVO_LABEL;
}

export function teamOptionKey(team: MomentumTeam): string {
  return team === "alpha" ? "team-a" : "team-b";
}

export type MomentumBreakdown = {
  momentum: number;
  alphaScore: number;
  bravoScore: number;
};

/**
 * Net momentum in [-1, 1] plus raw weighted scores for the UI legend.
 */
export function computeMomentumBreakdown(
  events: TelemetryEvent[],
  now: number = Date.now()
): MomentumBreakdown {
  const cutoff = now - MOMENTUM_WINDOW_MS;

  let alphaScore = 0;
  let bravoScore = 0;

  for (const event of events) {
    if (eventTimestamp(event) < cutoff) continue;
    const weight = ACTION_WEIGHTS[event.Action] ?? 0;
    if (weight === 0) continue;

    if (playerTeam(event.PlayerId) === "alpha") {
      alphaScore += weight;
    } else {
      bravoScore += weight;
    }
  }

  const total = alphaScore + bravoScore;
  const momentum = total === 0 ? 0 : (alphaScore - bravoScore) / total;

  return { momentum, alphaScore, bravoScore };
}

export function computeMomentum(
  events: TelemetryEvent[],
  now: number = Date.now()
): number {
  return computeMomentumBreakdown(events, now).momentum;
}
