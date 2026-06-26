'use client'

import type { ReactNode } from 'react'
import { Eye, Zap } from 'lucide-react'
import { ThemePicker } from './theme-picker'

interface TopBarProps {
  /** Optional viewer count — omitted when there is no real source. */
  viewers?: number
  /** Fallback connection state when no `connection` slot is provided. */
  connected?: boolean
  /** Real connection indicator (e.g. <ConnectionBadge/>), shown on wider screens. */
  connection?: ReactNode
}

function formatViewers(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return `${n}`
}

export function TopBar({
  viewers,
  connected = false,
  connection,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-edge bg-app/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-3 sm:px-4 lg:px-6">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand/15 text-brand-strong">
            <Zap className="h-4 w-4" aria-hidden />
          </span>
          <span className="font-display text-lg font-extrabold tracking-tight text-ink">
            Hype<span className="text-brand-strong">Market</span>
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Viewers — only when a real value is supplied */}
          {typeof viewers === 'number' && (
            <span className="hidden items-center gap-1.5 rounded-md border border-edge bg-panel px-2.5 py-1 text-xs text-ink-muted sm:inline-flex">
              <Eye className="h-3.5 w-3.5" aria-hidden />
              <span className="font-mono tabular-nums text-ink">
                {formatViewers(viewers)}
              </span>
            </span>
          )}

          {/* Connection status — real ConnectionBadge on wide screens, dot otherwise */}
          {connection ? (
            <div className="hidden md:block">{connection}</div>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 rounded-md border border-edge bg-panel px-2.5 py-1 text-xs text-ink-muted"
              aria-label={connected ? 'Connected' : 'Reconnecting'}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  connected ? 'bg-brand-strong' : 'bg-gold'
                }`}
              />
              <span className="hidden sm:inline">
                {connected ? 'Connected' : 'Reconnecting'}
              </span>
            </span>
          )}

          {/* Theme picker — 5 skins + light/dark toggle */}
          <ThemePicker />
        </div>
      </div>
    </header>
  )
}
