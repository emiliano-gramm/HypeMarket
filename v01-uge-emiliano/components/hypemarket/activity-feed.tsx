import { Radio } from 'lucide-react'
import type { ActivityItem } from './types'

function ago(s: number) {
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m`
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <div className="rounded-xl border border-edge bg-panel p-4">
      <div className="mb-3 flex items-center gap-1.5">
        <Radio className="h-4 w-4 text-brand-strong" aria-hidden />
        <span className="font-display text-sm font-bold uppercase tracking-wide text-ink">
          Activity
        </span>
      </div>

      <ul className="scroll-thin max-h-[220px] space-y-1.5 overflow-y-auto pr-1">
        {items.map((it) => (
          <li
            key={it.id}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-panel-2"
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                it.outcomeKey === 'alpha' ? 'bg-alpha' : 'bg-beta'
              }`}
            />
            <span className="min-w-0 flex-1 truncate text-ink-muted">
              <span className="font-medium text-ink">{it.user}</span> staked{' '}
              <span className="font-mono tabular-nums text-ink">
                {it.amount}
              </span>{' '}
              on <span className="text-ink">{it.team}</span>
            </span>
            <span className="font-mono text-[10px] tabular-nums text-ink-faint">
              {ago(it.ago)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
