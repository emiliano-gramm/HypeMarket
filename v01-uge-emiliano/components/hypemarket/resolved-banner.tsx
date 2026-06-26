'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'

interface ResolvedBannerProps {
  userWon: boolean
  payout: number
  newBalance: number
  onDismiss: () => void
}

/** Confetti-lite particle: floats down with rotation. */
function Confetto({
  delay,
  x,
}: {
  delay: number
  x: number
}) {
  return (
    <motion.div
      className="pointer-events-none fixed h-2 w-2 rounded-full bg-brand"
      style={{
        left: `${x}%`,
        top: 0,
      }}
      initial={{ opacity: 1, y: 0, rotate: 0 }}
      animate={{ opacity: 0, y: 120, rotate: 360 }}
      transition={{
        duration: 2,
        delay,
        ease: 'easeIn',
      }}
    />
  )
}

export function ResolvedBanner({
  userWon,
  payout,
  newBalance,
  onDismiss,
}: ResolvedBannerProps) {
  const [displayedBalance, setDisplayedBalance] = useState(newBalance - payout)
  const [dismissed, setDismissed] = useState(false)

  // Count up to the new balance over ~1.2s (after banner slides in ~0.4s)
  useEffect(() => {
    if (!userWon || dismissed) return
    const start = newBalance - payout
    const end = newBalance
    const duration = 1200
    const startTime = Date.now()

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      setDisplayedBalance(Math.floor(start + (end - start) * progress))
    }, 16)

    return () => clearInterval(interval)
  }, [dismissed, userWon, payout, newBalance])

  if (dismissed) return null

  const handleDismiss = () => {
    setDismissed(true)
    onDismiss()
  }

  return (
    <>
      {userWon &&
        Array.from({ length: 12 }).map((_, i) => (
          <Confetto
            key={i}
            delay={i * 0.08}
            x={10 + Math.random() * 80}
          />
        ))}

      <motion.div
        initial={{ y: -120, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-3 border-b border-edge bg-panel px-4 py-4 sm:px-6"
      >
        <div className="flex flex-1 flex-col gap-1">
          {userWon ? (
            <>
              <p className="font-display text-sm font-bold uppercase tracking-wide text-gain">
                🎉 Congratulations!
              </p>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
                <p className="font-mono text-sm text-ink-muted">Total payout</p>
                <p className="font-mono text-lg font-bold tabular-nums text-gain">
                  +{payout.toLocaleString()} Hype Credits
                </p>
                <span className="hidden font-mono text-xs text-ink-faint sm:inline">
                  • New balance:
                </span>
                <p className="font-mono text-xs tabular-nums text-ink-muted sm:text-base sm:font-semibold sm:text-ink">
                  {displayedBalance.toLocaleString()}
                </p>
              </div>
            </>
          ) : (
            <>
              <p className="font-display text-sm font-bold uppercase tracking-wide text-ink-muted">
                Market resolved
              </p>
              <p className="font-mono text-sm text-ink-faint">
                Your position did not win. Better luck next round.
              </p>
            </>
          )}
        </div>

        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={handleDismiss}
          aria-label="Dismiss notification"
          className="shrink-0 rounded-md border border-edge bg-panel-2 p-1.5 text-ink-muted transition-colors hover:text-ink"
        >
          <X className="h-4 w-4" />
        </motion.button>
      </motion.div>
    </>
  )
}
