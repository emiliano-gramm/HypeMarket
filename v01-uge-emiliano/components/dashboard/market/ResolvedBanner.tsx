"use client"

import { motion } from "framer-motion"
import { Trophy, Coins } from "lucide-react"

export interface ResolvedBannerProps {
  winnerLabel: string
  payoutAmount: number
  walletBalance: number
}

function formatNum(n: number) {
  return n.toLocaleString("en-US")
}

export function ResolvedBanner({
  winnerLabel,
  payoutAmount,
  walletBalance,
}: ResolvedBannerProps) {
  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 160, damping: 18 }}
      className="relative overflow-hidden rounded-xl border border-[var(--positive)]/40 bg-panel p-5 font-sans"
      aria-label="Market resolved"
    >
      {/* Soft positive glow accent */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-[var(--positive)]/10 blur-2xl"
        aria-hidden="true"
      />

      <div className="relative flex items-center gap-4">
        <motion.div
          initial={{ rotate: -12, scale: 0.8 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
          className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-[var(--positive)]/40 bg-[var(--positive)]/10"
        >
          <Trophy className="size-6 text-[var(--positive)]" aria-hidden="true" />
        </motion.div>

        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--positive)]">
            Market resolved
          </span>
          <h2 className="text-pretty text-lg font-bold leading-tight tracking-tight text-ink">
            {winnerLabel} wins —{" "}
            <span className="font-mono tabular-nums text-[var(--positive)]">
              +{formatNum(payoutAmount)}
            </span>{" "}
            Hype Credits paid out
          </h2>
        </div>
      </div>

      <div className="relative mt-4 flex items-center justify-between rounded-lg border border-edge bg-panel-2 px-3 py-2">
        <div className="flex items-center gap-2">
          <Coins className="size-4 text-brand-strong" aria-hidden="true" />
          <span className="text-xs text-ink-muted">New wallet balance</span>
        </div>
        <span className="font-mono text-sm font-semibold tabular-nums text-ink">
          {formatNum(walletBalance)}
        </span>
      </div>
    </motion.section>
  )
}
