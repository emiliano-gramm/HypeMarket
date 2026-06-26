"use client"

import { motion } from "framer-motion"
import { Wallet, Check, TrendingUp } from "lucide-react"

export interface Position {
  optionKey: string
  label: string
  amount: number
  payout: number
  settled: boolean
}

export interface PositionsListProps {
  positions: Position[]
}

function formatNum(n: number) {
  return n.toLocaleString("en-US")
}

export function PositionsList({ positions }: PositionsListProps) {
  return (
    <section
      className="rounded-xl border border-edge bg-panel font-sans"
      aria-label="Your positions"
    >
      <header className="flex items-center justify-between border-b border-edge px-4 py-3">
        <div className="flex items-center gap-2">
          <Wallet className="size-4 text-brand-strong" aria-hidden="true" />
          <h2 className="text-sm font-semibold tracking-tight text-ink">Your positions</h2>
        </div>
        <span className="font-mono text-[11px] tabular-nums text-ink-faint">
          {positions.length} active
        </span>
      </header>

      {positions.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-ink-faint">
          No positions yet — stake on an outcome to get started.
        </p>
      ) : (
        <ul className="flex flex-col">
          {positions.map((p, i) => (
            <motion.li
              key={p.optionKey}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center justify-between gap-3 border-b border-edge px-4 py-3 last:border-b-0"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-sm font-semibold text-ink">{p.label}</span>
                <span className="flex items-center gap-1 text-[11px] text-ink-muted">
                  <span className="text-ink-faint">Staked</span>
                  <span className="font-mono tabular-nums text-ink">{formatNum(p.amount)}</span>
                </span>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                {p.settled ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--positive)]/40 bg-[var(--positive)]/10 px-2 py-1 font-mono text-xs font-semibold tabular-nums text-[var(--positive)]">
                    <Check className="size-3" aria-hidden="true" />+{formatNum(p.payout)}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-brand/30 bg-brand/10 px-2 py-1 font-mono text-xs font-semibold tabular-nums text-brand-strong">
                    <TrendingUp className="size-3" aria-hidden="true" />
                    {formatNum(p.payout)}
                  </span>
                )}
                <span className="text-[11px] text-ink-faint">
                  {p.settled ? "paid out" : "potential payout"}
                </span>
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  )
}
