import { Ticket } from 'lucide-react'
import type { Position } from './types'

export function PositionsList({ positions }: { positions: Position[] }) {
  const total = positions.reduce((s, p) => s + p.staked, 0)

  return (
    <div className="rounded-xl border border-edge bg-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-wide text-ink">
          <Ticket className="h-4 w-4 text-brand-strong" aria-hidden />
          Positions
        </span>
        <span className="font-mono text-[11px] tabular-nums text-ink-muted">
          {total.toLocaleString()} staked
        </span>
      </div>

      {positions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-edge bg-panel-2 px-3 py-6 text-center text-xs text-ink-faint">
          No active positions. Place a stake to get in the game.
        </p>
      ) : (
        <ul className="space-y-2">
          {positions.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-edge bg-panel-2 px-3 py-2"
            >
              <span className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    p.outcomeKey === 'alpha' ? 'bg-alpha' : 'bg-beta'
                  }`}
                />
                <span className="font-display text-sm font-semibold text-ink">
                  {p.team}
                </span>
                <span className="font-mono text-[11px] tabular-nums text-ink-faint">
                  @ {p.odds.toFixed(2)}×
                </span>
              </span>
              <span className="text-right">
                <span className="block font-mono text-sm font-semibold tabular-nums text-ink">
                  {p.staked.toLocaleString()}
                </span>
                <span className="block font-mono text-[10px] tabular-nums text-brand-strong">
                  → {Math.round(p.staked * p.odds).toLocaleString()}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
