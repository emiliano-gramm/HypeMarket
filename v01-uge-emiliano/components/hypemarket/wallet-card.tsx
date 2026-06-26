import { ArrowUpRight, Coins } from 'lucide-react'

interface WalletCardProps {
  balance: number
  staked: number
  potential: number
  /** net credits gained/lost this session */
  sessionDelta: number
}

export function WalletCard({
  balance,
  staked,
  potential,
  sessionDelta,
}: WalletCardProps) {
  const up = sessionDelta >= 0
  return (
    <div className="rounded-xl border border-gold/25 bg-gradient-to-b from-gold/10 to-panel p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-gold">
          Hype Credits
        </span>
        <Coins className="h-4 w-4 text-gold" aria-hidden />
      </div>

      <div className="mt-1 flex items-end gap-2">
        <span className="font-mono text-3xl font-bold tabular-nums text-ink">
          {balance.toLocaleString()}
        </span>
        <span
          className={`mb-1 inline-flex items-center gap-0.5 font-mono text-xs font-semibold tabular-nums ${
            up ? 'text-gain' : 'text-live'
          }`}
        >
          <ArrowUpRight
            className={`h-3 w-3 ${up ? '' : 'rotate-90'}`}
            aria-hidden
          />
          {up ? '+' : ''}
          {sessionDelta.toLocaleString()} this session
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg border border-edge bg-panel-2 py-2">
          <div className="font-mono text-sm font-semibold tabular-nums text-ink">
            {staked.toLocaleString()}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-ink-faint">
            In Play
          </div>
        </div>
        <div className="rounded-lg border border-edge bg-panel-2 py-2">
          <div className="font-mono text-sm font-semibold tabular-nums text-brand-strong">
            {potential.toLocaleString()}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-ink-faint">
            Potential
          </div>
        </div>
      </div>

      <p className="mt-3 text-center text-[10px] text-ink-faint">
        Play money · not gambling · no real-world value
      </p>
    </div>
  )
}
