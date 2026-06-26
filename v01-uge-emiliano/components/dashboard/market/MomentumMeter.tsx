"use client"

import { useEffect, useRef } from "react"
import { motion, useAnimationControls } from "framer-motion"
import { Activity } from "lucide-react"
import { TEAM_COLORS } from "@/lib/telemetry/momentum"

export interface MomentumMeterProps {
  /** -1 = full Bravo (left), 0 = even, +1 = full Alpha (right) */
  momentum: number
  teamAlpha: string
  teamBravo: string
  /** Weighted kill/objective/assist score in the last 15s window */
  alphaScore?: number
  bravoScore?: number
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function MomentumMeter({
  momentum,
  teamAlpha,
  teamBravo,
  alphaScore = 0,
  bravoScore = 0,
}: MomentumMeterProps) {
  const value = clamp(momentum, -1, 1)
  const position = ((value + 1) / 2) * 100
  const fillLeft = value >= 0 ? 50 : position
  const fillWidth = Math.abs(value) * 50

  const leader = value > 0.04 ? teamAlpha : value < -0.04 ? teamBravo : "Even"
  const pct = Math.round(Math.abs(value) * 100)

  const controls = useAnimationControls()
  const prev = useRef(value)

  useEffect(() => {
    if (prev.current !== value) {
      controls.start({
        scale: [1, 1.45, 1],
        opacity: [0.5, 0, 0.5],
        transition: { duration: 0.7, ease: "easeOut" },
      })
      prev.current = value
    }
  }, [value, controls])

  return (
    <section className="flex h-full flex-col rounded-xl border border-edge bg-panel p-4 font-sans">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-brand-strong" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-ink">Match momentum (from telemetry)</h3>
      </div>
      <p className="mt-1 text-xs text-ink-faint">
        Crowd sets the odds — telemetry shows match flow
      </p>

      {/* Roster legend — maps Player_N dots to teams for the demo producer */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px]">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: TEAM_COLORS.alpha.dot }}
            aria-hidden="true"
          />
          <span className="text-ink-muted">
            <span className="font-medium text-ink">{teamAlpha}</span>
            {" · "}
            <span className="font-mono text-ink-faint">Player 0–4</span>
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: TEAM_COLORS.bravo.dot }}
            aria-hidden="true"
          />
          <span className="text-ink-muted">
            <span className="font-medium text-ink">{teamBravo}</span>
            {" · "}
            <span className="font-mono text-ink-faint">Player 5–9</span>
          </span>
        </span>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center text-xs font-medium">
        <span className={value < -0.04 ? "text-ink" : "text-ink-muted"}>
          {teamBravo}
          {bravoScore > 0 && (
            <span className="ml-1 font-mono text-[10px] tabular-nums text-ink-faint">
              +{bravoScore}
            </span>
          )}
        </span>
        <span className="px-2 text-center font-mono tabular-nums text-ink-faint">
          {leader === "Even" ? "EVEN" : `+${pct}%`}
        </span>
        <span className={`text-right ${value > 0.04 ? "text-ink" : "text-ink-muted"}`}>
          {alphaScore > 0 && (
            <span className="mr-1 font-mono text-[10px] tabular-nums text-ink-faint">
              +{alphaScore}
            </span>
          )}
          {teamAlpha}
        </span>
      </div>

      <div className="relative mt-2 h-2.5 w-full rounded-full bg-panel-2">
        <div className="absolute left-1/2 top-1/2 h-3.5 w-px -translate-x-1/2 -translate-y-1/2 bg-edge" />

        <motion.div
          className="absolute top-0 h-full rounded-full bg-brand/25"
          animate={{ left: `${fillLeft}%`, width: `${fillWidth}%` }}
          transition={{ type: "spring", stiffness: 220, damping: 28 }}
        />

        <motion.div
          className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
          animate={{ left: `${position}%` }}
          transition={{ type: "spring", stiffness: 220, damping: 28 }}
        >
          <motion.span
            className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand"
            animate={controls}
            initial={{ scale: 1, opacity: 0 }}
            aria-hidden="true"
          />
          <span className="relative block h-3.5 w-3.5 rounded-full border border-brand/30 bg-brand-strong shadow-[0_0_8px] shadow-brand/50" />
        </motion.div>
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-ink-faint">
        Kills, assists, and objectives in the last 15s — weighted score, not the market odds.
      </p>
    </section>
  )
}
