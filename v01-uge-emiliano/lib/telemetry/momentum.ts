// Pure telemetry-derived momentum. No I/O — unit-testable by hand.
//
// Momentum is a SEPARATE signal from the crowd-implied market odds: it reflects
// recent match flow (kills/objectives) over a short sliding window, while the
// odds come only from how the crowd stakes. The UI labels them distinctly so we
// never claim telemetry sets the odds (see updated_idea.md honesty guardrails).

import type { TelemetryEvent } from "@/lib/telemetry/types";
import { eventTimestamp } from "@/lib/telemetry/types";

/** Only events newer than this (relative to "now") count toward momentum. */
export const MOMENTUM_WINDOW_MS = 300_000;

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

/** Dot / accent colors — match momentum strip via theme tokens (--alpha / --beta). */
export const TEAM_COLORS: Record<MomentumTeam, { dot: string; badge: string }> = {
  alpha: { dot: "var(--alpha)", badge: "bg-alpha/15 text-alpha border-alpha/30" },
  bravo: { dot: "var(--beta)", badge: "bg-beta/15 text-beta border-beta/30" },
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

function alphaShareFromScores(alphaScore: number, bravoScore: number): number {
  const total = alphaScore + bravoScore;
  if (total === 0) return 0.5;
  const momentum = (alphaScore - bravoScore) / total;
  return (momentum + 1) / 2;
}

function eventScore(event: TelemetryEvent): { alpha: number; bravo: number } | null {
  const weight = ACTION_WEIGHTS[event.Action] ?? 0;
  if (weight === 0) return null;
  return playerTeam(event.PlayerId) === "alpha"
    ? { alpha: weight, bravo: 0 }
    : { alpha: 0, bravo: weight };
}

/**
 * Marginal shift in Alpha's momentum share (0..1) when this event landed,
 * using the same window anchored at the event timestamp.
 * @deprecated Prefer computeEventWindowShare for UI that must match the live bar.
 */
export function computeEventMomentumDelta(
  target: TelemetryEvent,
  events: TelemetryEvent[]
): number | null {
  const targetScore = eventScore(target);
  if (!targetScore) return null;

  const targetTs = eventTimestamp(target);
  const cutoff = targetTs - MOMENTUM_WINDOW_MS;

  let alphaScore = 0;
  let bravoScore = 0;

  for (const event of events) {
    const ts = eventTimestamp(event);
    if (ts <= cutoff || ts > targetTs) continue;
    if (event.SK === target.SK) continue;

    const score = eventScore(event);
    if (!score) continue;
    alphaScore += score.alpha;
    bravoScore += score.bravo;
  }

  const before = alphaShareFromScores(alphaScore, bravoScore);
  const after = alphaShareFromScores(
    alphaScore + targetScore.alpha,
    bravoScore + targetScore.bravo
  );

  return after - before;
}

export function formatMomentumDelta(delta: number): string {
  const pct = Math.round(Math.abs(delta * 100));
  return `+${pct}%`;
}

/**
 * This event's weighted share of the current momentum window (0..1).
 * Signed from Alpha's perspective (+ alpha, − bravo). Null when the event
 * is movement or falls outside the live window.
 */
export function computeEventWindowShare(
  target: TelemetryEvent,
  events: TelemetryEvent[],
  now: number = Date.now()
): number | null {
  const targetScore = eventScore(target);
  if (!targetScore) return null;

  const cutoff = now - MOMENTUM_WINDOW_MS;
  if (eventTimestamp(target) < cutoff) return null;

  let alphaScore = 0;
  let bravoScore = 0;

  for (const event of events) {
    const ts = eventTimestamp(event);
    if (ts < cutoff) continue;

    const score = eventScore(event);
    if (!score) continue;
    alphaScore += score.alpha;
    bravoScore += score.bravo;
  }

  const total = alphaScore + bravoScore;
  if (total === 0) return null;

  const weight = targetScore.alpha + targetScore.bravo;
  const share = weight / total;
  return targetScore.alpha > 0 ? share : -share;
}
