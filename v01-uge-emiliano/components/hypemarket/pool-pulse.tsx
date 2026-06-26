'use client'

import { useEffect, useState } from 'react'
import { animate } from 'framer-motion'
import { Flame, Users } from 'lucide-react'

interface PoolPulseProps {
  /** total credits in the pool */
  pool: number
  /** number of unique backers */
  backers: number
}

function useCountUp(value: number) {
  const [display, setDisplay] = useState(value)
  useEffect(() => {
    const controls = animate(display, value, {
      duration: 0.7,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(v),
    })
    return () => controls.stop()
    // only re-run when the target value changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return Math.round(display)
}

export function PoolPulse({ pool, backers }: PoolPulseProps) {
  const poolView = useCountUp(pool)
  const backersView = useCountUp(backers)

  return (
    <div className="grid grid-cols-2 gap-3 rounded-xl border border-edge bg-panel p-4">
      <div>
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-ink-faint">
          <Flame className="h-3.5 w-3.5 text-brand-strong" aria-hidden />
          Pool size
        </div>
        <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-ink">
          {poolView.toLocaleString()}
        </div>
      </div>
      <div className="border-l border-edge pl-3">
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-ink-faint">
          <Users className="h-3.5 w-3.5 text-brand-strong" aria-hidden />
          Backers
        </div>
        <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-ink">
          {backersView.toLocaleString()}
        </div>
      </div>
    </div>
  )
}
