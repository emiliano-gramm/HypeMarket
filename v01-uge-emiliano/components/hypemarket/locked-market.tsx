import { Lock } from 'lucide-react'

/**
 * Grayed "stone texture" overlay laid over the prediction market card while a
 * round plays out. Layered radial gradients fake a chiseled stone surface; the
 * backdrop is desaturated so the live odds beneath read as frozen.
 */
export function LockedMarket() {
  return (
    <div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl"
      style={{
        backdropFilter: 'grayscale(0.85) brightness(0.6) blur(1px)',
        WebkitBackdropFilter: 'grayscale(0.85) brightness(0.6) blur(1px)',
        backgroundColor: 'var(--panel-2)',
        backgroundImage:
          'radial-gradient(circle at 20% 25%, rgba(255,255,255,0.04) 0 8%, transparent 9%),' +
          'radial-gradient(circle at 70% 60%, rgba(0,0,0,0.18) 0 10%, transparent 11%),' +
          'radial-gradient(circle at 45% 80%, rgba(255,255,255,0.03) 0 6%, transparent 7%),' +
          'radial-gradient(circle at 85% 15%, rgba(0,0,0,0.15) 0 7%, transparent 8%)',
        opacity: 0.96,
      }}
      role="status"
      aria-label="Market locked"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-ink-faint/40 bg-panel text-ink-muted shadow-inner">
        <Lock className="h-5 w-5" aria-hidden />
      </span>
      <span className="font-display text-sm font-bold uppercase tracking-widest text-ink">
        Market Locked
      </span>
      <span className="font-mono text-[11px] tabular-nums text-ink-muted">
        Round in progress · awaiting result
      </span>
    </div>
  )
}
