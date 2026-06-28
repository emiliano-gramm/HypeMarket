'use client'

import { motion } from 'framer-motion'

interface MomentumStripProps {
  alphaTeam: string
  betaTeam: string
  /** 0..1 share of momentum held by alpha */
  alphaShare: number
}

export function MomentumStrip({
  alphaTeam,
  betaTeam,
  alphaShare,
}: MomentumStripProps) {
  const alphaPct = Math.round(alphaShare * 100)
  const betaPct = 100 - alphaPct

  return (
    <div className="flex items-center gap-3 rounded-lg border border-edge bg-panel/60 px-3 py-2">
      <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-wider text-ink-faint sm:inline">
        Telemetry · last 5m
      </span>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-alpha" />
        <span className="font-display text-xs font-semibold text-ink">
          {alphaTeam}
        </span>
        <span className="font-mono text-xs tabular-nums text-ink-muted">
          {alphaPct}%
        </span>
      </div>

      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-beta/30">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-alpha"
          initial={false}
          animate={{ width: `${alphaPct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
        <div
          className="absolute inset-y-0 w-px bg-app"
          style={{ left: '50%' }}
          aria-hidden
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="font-mono text-xs tabular-nums text-ink-muted">
          {betaPct}%
        </span>
        <span className="font-display text-xs font-semibold text-ink">
          {betaTeam}
        </span>
        <span className="h-2 w-2 rounded-full bg-beta" />
      </div>
    </div>
  )
}
