"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Radio, Coins, Trophy, Users, Lock, Check } from "lucide-react"
import { payoutPreview } from "@/lib/markets/odds"

export interface PredictionOutcome {
  optionKey: string
  label: string
  stakedTotal: number
  backerCount: number
  /** 0–1 implied probability, drives the pool share bar width */
  impliedProb: number
  decimalOdds: number
}

export interface PredictionMarketProps {
  question: string
  status: "open" | "locked" | "resolved"
  wallet: { balance: number }
  outcomes: PredictionOutcome[]
  /** the winning outcome when resolved, also used as the user's active pick */
  selectedOptionKey: string | null
  syncing: boolean
  onStake: (optionKey: string, amount: number) => void
}

const STAKE_CHIPS = [50, 100, 250]

function formatNum(n: number) {
  return n.toLocaleString("en-US")
}

export function PredictionMarket({
  question,
  status,
  wallet,
  outcomes,
  selectedOptionKey,
  syncing,
  onStake,
}: PredictionMarketProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [activeStake, setActiveStake] = useState<number>(STAKE_CHIPS[1])

  const isOpen = status === "open"
  const isLocked = status === "locked"
  const isResolved = status === "resolved"

  // Default selection to the first outcome once data arrives.
  useEffect(() => {
    if (outcomes.length > 0 && activeKey === null && !isResolved) {
      setActiveKey(outcomes[0].optionKey)
    }
  }, [outcomes, activeKey, isResolved])

  const previewKey =
    activeKey ?? selectedOptionKey ?? outcomes[0]?.optionKey ?? null
  const previewOutcome =
    outcomes.find((o) => o.optionKey === previewKey) ?? outcomes[0]
  const potentialPayout = previewOutcome
    ? payoutPreview(activeStake, previewOutcome.decimalOdds)
    : 0

  return (
    <section
      className={`rounded-xl border border-edge bg-panel font-sans ${
        isLocked ? "opacity-70" : ""
      }`}
      aria-label="Prediction market"
    >
      {/* Header */}
      <header className="flex items-center justify-between border-b border-edge px-4 py-3">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 text-brand-strong" aria-hidden="true" />
          <h2 className="text-sm font-semibold tracking-tight text-ink">
            Prediction Market
          </h2>
        </div>
        <StatusBadge status={status} />
      </header>

      <div className="flex flex-col gap-4 p-4">
        {/* Question + wallet chip */}
        <div className="flex flex-col gap-3">
          <p className="text-pretty text-sm leading-relaxed text-ink">{question}</p>
          <div className="flex items-center justify-between rounded-lg border border-edge bg-panel-2 px-3 py-2">
            <div className="flex items-center gap-2">
              <Coins className="size-4 text-brand-strong" aria-hidden="true" />
              <span className="text-xs text-ink-muted">Hype Credits</span>
            </div>
            <span className="font-mono text-sm font-semibold tabular-nums text-ink">
              {formatNum(wallet.balance)}
            </span>
          </div>
        </div>

        {/* Outcome rows */}
        <div className="flex flex-col gap-2">
          {outcomes.map((o) => {
            const isWinner = isResolved && o.optionKey === selectedOptionKey
            const isResolvedLoser = isResolved && o.optionKey !== selectedOptionKey
            const isPicked = !isResolved && o.optionKey === activeKey
            return (
              <OutcomeRow
                key={o.optionKey}
                outcome={o}
                isWinner={isWinner}
                isLoser={isResolvedLoser}
                isPicked={isPicked}
                disabled={!isOpen}
                onSelect={() => isOpen && setActiveKey(o.optionKey)}
              />
            )
          })}
        </div>

        {/* Stake controls */}
        {!isResolved && (
          <div className="flex flex-col gap-3 border-t border-edge pt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-ink-faint">
                Quick stake
              </span>
              {syncing && (
                <span className="font-mono text-[11px] text-ink-faint">syncing…</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {STAKE_CHIPS.map((amount) => {
                const selected = amount === activeStake
                return (
                  <motion.button
                    key={amount}
                    type="button"
                    disabled={isLocked}
                    whileTap={isLocked ? undefined : { scale: 0.92 }}
                    onClick={() => {
                      setActiveStake(amount)
                      const key = activeKey ?? outcomes[0]?.optionKey
                      if (key) {
                        setActiveKey(key)
                        onStake(key, amount)
                      }
                    }}
                    className={`flex-1 rounded-lg border px-3 py-2 font-mono text-sm font-semibold tabular-nums transition-colors disabled:cursor-not-allowed ${
                      selected
                        ? "border-brand/60 bg-brand/25 text-ink"
                        : "border-edge bg-panel-2 text-ink-muted hover:bg-brand/10"
                    }`}
                  >
                    {amount}
                  </motion.button>
                )
              })}
            </div>

            {/* Payout preview — keyed on odds so it visibly tracks pool shifts */}
            <div className="rounded-lg border border-brand/30 bg-brand/10 px-3 py-2">
              <p className="font-mono text-xs tabular-nums text-ink-muted">
                <span className="text-ink">{activeStake}</span>
                {" × "}
                <motion.span
                  key={previewOutcome?.decimalOdds.toFixed(2) ?? "—"}
                  className="inline-block text-ink"
                  initial={{ opacity: 0.5, y: -2 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {previewOutcome ? previewOutcome.decimalOdds.toFixed(2) : "—"}×
                </motion.span>
                {" = "}
                <motion.span
                  key={potentialPayout}
                  className="inline-block font-semibold text-brand-strong"
                  initial={{ opacity: 0.5, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  {formatNum(potentialPayout)}
                </motion.span>{" "}
                potential payout
                {previewOutcome && (
                  <span className="block mt-0.5 text-[10px] text-ink-faint">
                    at current odds on {previewOutcome.label}
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Footer disclaimer */}
        <p className="text-[11px] leading-relaxed text-ink-faint">
          Prediction simulation — play money, not real gambling.
        </p>
      </div>
    </section>
  )
}

function StatusBadge({ status }: { status: PredictionMarketProps["status"] }) {
  if (status === "open") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-brand/30 bg-brand/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand-strong">
        <Radio className="size-3" aria-hidden="true" />
        Live
      </span>
    )
  }
  if (status === "locked") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-edge bg-panel-2 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
        <Lock className="size-3" aria-hidden="true" />
        Locked
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--positive)]/40 bg-[var(--positive)]/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--positive)]">
      <Check className="size-3" aria-hidden="true" />
      Resolved
    </span>
  )
}

function OutcomeRow({
  outcome,
  isWinner,
  isLoser,
  isPicked,
  disabled,
  onSelect,
}: {
  outcome: PredictionOutcome
  isWinner: boolean
  isLoser: boolean
  isPicked: boolean
  disabled: boolean
  onSelect: () => void
}) {
  const pct = Math.round(outcome.impliedProb * 100)

  const barColor = isWinner
    ? "bg-[var(--positive)]/30"
    : isLoser
      ? "bg-panel-2"
      : "bg-brand/25"

  const shell = isWinner
    ? "border-[var(--positive)]/50 bg-[var(--positive)]/5"
    : isLoser
      ? "border-edge opacity-50"
      : isPicked
        ? "border-brand/60"
        : "border-edge"

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={`relative w-full overflow-hidden rounded-lg border px-3 py-3 text-left transition-colors disabled:cursor-default ${shell} ${
        !disabled && !isPicked ? "hover:border-brand/40" : ""
      }`}
    >
      {/* Pool share bar */}
      <motion.div
        className={`absolute inset-y-0 left-0 ${barColor}`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 20 }}
        aria-hidden="true"
      />
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-ink">
            {outcome.label}
            {isWinner && (
              <Trophy
                className="size-3.5 text-[var(--positive)]"
                aria-label="Winner"
              />
            )}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-ink-muted">
            <Users className="size-3" aria-hidden="true" />
            <span className="font-mono tabular-nums">
              {formatNum(outcome.backerCount)}
            </span>
            backers
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className="font-mono text-sm font-semibold tabular-nums text-ink">
            {outcome.decimalOdds.toFixed(2)}×
          </span>
          <span className="font-mono text-[11px] tabular-nums text-ink-faint">
            {pct}% · {formatNum(outcome.stakedTotal)}
          </span>
        </div>
      </div>
    </button>
  )
}
