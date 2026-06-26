'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp } from 'lucide-react'
import { LockedMarket } from './locked-market'
import type { MarketStatus, Outcome, OutcomeKey } from './types'

interface PredictionMarketProps {
  question: string
  outcomes: Outcome[]
  balance: number
  closesIn: string
  status: MarketStatus
  /** key of the winning outcome when status === 'resolved' */
  winnerKey?: OutcomeKey
  onStake: (optionKey: OutcomeKey, amount: number) => void
  onSelectOutcome?: (optionKey: OutcomeKey) => void
}

const CHIPS = [50, 100, 250]

const STATUS_STYLES: Record<MarketStatus, string> = {
  live: 'border-live/40 bg-live/15 text-live',
  locked: 'border-ink-faint/40 bg-panel-2 text-ink-muted',
  resolved: 'border-gain/40 bg-gain/15 text-gain',
}

export function PredictionMarket({
  question,
  outcomes,
  balance,
  closesIn,
  status,
  winnerKey,
  onStake,
  onSelectOutcome,
}: PredictionMarketProps) {
  const [selected, setSelected] = useState<OutcomeKey>(
    outcomes[0]?.key ?? 'alpha',
  )
  const [amount, setAmount] = useState<number>(100)

  const open = status === 'live'
  const active = outcomes.find((o) => o.key === selected) ?? outcomes[0]
  const canStake = open && amount > 0 && amount <= balance
  const potential = active ? amount * active.odds : 0

  function pick(key: OutcomeKey) {
    if (!open) return
    setSelected(key)
    onSelectOutcome?.(key)
  }

  return (
    <div className="relative rounded-xl border border-edge bg-panel p-4">
      {status === 'locked' && <LockedMarket />}
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-wide text-ink">
          <TrendingUp className="h-4 w-4 text-brand-strong" aria-hidden />
          Crowd Odds
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLES[status]}`}
        >
          {status === 'live' && (
            <motion.span
              className="h-1.5 w-1.5 rounded-full bg-live"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          {status}
        </span>
      </div>

      <p className="mb-1 font-display text-base font-semibold text-ink">
        {question}
      </p>
      <p className="mb-3 font-mono text-[11px] tabular-nums text-ink-muted">
        {status === 'live'
          ? closesIn
            ? `locks in ${closesIn}`
            : 'staking open'
          : status === 'locked'
            ? 'betting closed · awaiting result'
            : 'market resolved'}
      </p>

      {/* outcome rows with parimutuel bar fill behind each */}
      <div className="mb-4 flex flex-col gap-2">
        {outcomes.map((o) => {
          const isSel = open && o.key === selected
          const isWinner = status === 'resolved' && o.key === winnerKey
          const isAlpha = o.key === 'alpha'
          const barClass = isAlpha ? 'bg-alpha/25' : 'bg-beta/25'
          const dotClass = isAlpha ? 'bg-alpha' : 'bg-beta'
          const selRing = isAlpha
            ? 'border-alpha ring-1 ring-alpha'
            : 'border-beta ring-1 ring-beta'
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => pick(o.key)}
              aria-pressed={isSel}
              disabled={!open}
              className={`relative overflow-hidden rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-default ${
                isSel
                  ? selRing
                  : isWinner
                    ? 'border-gain'
                    : 'border-edge hover:border-ink-faint'
              }`}
            >
              {/* fill behind */}
              <motion.span
                className={`absolute inset-y-0 left-0 ${barClass}`}
                initial={false}
                animate={{ width: `${Math.round(o.share * 100)}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 22 }}
                aria-hidden
              />
              <span className="relative flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${dotClass}`} />
                  <span className="font-display text-sm font-bold text-ink">
                    {o.team}
                  </span>
                  <span className="font-mono text-[10px] tabular-nums text-ink-faint">
                    {Math.round(o.share * 100)}%
                  </span>
                  {isWinner && (
                    <span className="rounded bg-gain/20 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-gain">
                      Won
                    </span>
                  )}
                </span>
                <span className="font-mono text-base font-semibold tabular-nums text-ink">
                  {o.odds.toFixed(2)}×
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {open ? (
        <>
          {/* stake chips */}
          <div className="mb-3 flex items-center gap-2">
            {CHIPS.map((c) => (
              <motion.button
                key={c}
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={() => setAmount(c)}
                className={`flex-1 rounded-md border py-1.5 font-mono text-xs tabular-nums transition-colors ${
                  amount === c
                    ? 'border-brand/40 bg-brand/15 text-brand-strong'
                    : 'border-edge bg-panel-2 text-ink-muted hover:text-ink'
                }`}
              >
                {c}
              </motion.button>
            ))}
          </div>

          {/* payout preview */}
          <div className="mb-3 flex items-center justify-center rounded-lg border border-edge bg-panel-2 px-3 py-2 font-mono text-xs tabular-nums">
            <span className="text-ink">{amount}</span>
            <span className="mx-1.5 text-ink-faint">×</span>
            <span className="text-ink">{active?.odds.toFixed(2)}×</span>
            <span className="mx-1.5 text-ink-faint">=</span>
            <span className="font-semibold text-brand-strong">
              {Math.round(potential).toLocaleString()}
            </span>
            <span className="ml-1 text-ink-muted">potential</span>
          </div>

          {/* stake button */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            disabled={!canStake}
            onClick={() => active && canStake && onStake(active.key, amount)}
            className="w-full rounded-lg bg-brand py-2.5 font-display text-sm font-bold uppercase tracking-wide text-app transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            {amount > balance
              ? 'Not enough credits'
              : `Stake on ${active?.team}`}
          </motion.button>
        </>
      ) : (
        <p className="rounded-lg border border-dashed border-edge bg-panel-2 px-3 py-3 text-center text-xs text-ink-faint">
          {status === 'locked'
            ? 'Staking is locked while the round plays out.'
            : 'This market has resolved. Check your positions for payouts.'}
        </p>
      )}
    </div>
  )
}
