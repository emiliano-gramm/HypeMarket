'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown, Map as MapIcon } from 'lucide-react'

interface ArenaIntelProps {
  /** Short status pill, e.g. "14 kills · 3 obj". */
  objective: string
  /** Live arena minimap (real telemetry). */
  map: ReactNode
  /** Live event feed (real telemetry). */
  feed: ReactNode
}

/**
 * Collapsible "Arena Intel" shell from the v0 design, repurposed to host the
 * real telemetry minimap + event feed instead of static blips.
 */
export function ArenaIntel({ objective, map, feed }: ArenaIntelProps) {
  const [open, setOpen] = useState(true)

  return (
    <section className="rounded-xl border border-edge bg-panel">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <MapIcon className="h-4 w-4 text-brand-strong" aria-hidden />
        <span className="font-display text-sm font-bold uppercase tracking-wide text-ink">
          Arena Intel
        </span>
        <span className="ml-2 rounded border border-edge bg-panel-2 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-ink-muted">
          {objective}
        </span>
        <ChevronDown
          className={`ml-auto h-4 w-4 text-ink-muted transition-transform ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>

      {open && (
        <div className="grid grid-cols-1 gap-4 border-t border-edge p-4 lg:grid-cols-2">
          {map}
          {feed}
        </div>
      )}
    </section>
  )
}
