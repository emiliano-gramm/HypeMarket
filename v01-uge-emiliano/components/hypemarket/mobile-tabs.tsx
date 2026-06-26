'use client'

import { Map as MapIcon, Play, TrendingUp } from 'lucide-react'

export type MobileTab = 'watch' | 'arena' | 'predict'

const TABS: { key: MobileTab; label: string; Icon: typeof Play }[] = [
  { key: 'watch', label: 'Watch', Icon: Play },
  { key: 'arena', label: 'Arena', Icon: MapIcon },
  { key: 'predict', label: 'Predict', Icon: TrendingUp },
]

export function MobileTabs({
  active,
  onChange,
}: {
  active: MobileTab
  onChange: (tab: MobileTab) => void
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-edge bg-app/90 backdrop-blur-md lg:hidden">
      <ul className="mx-auto flex max-w-md">
        {TABS.map(({ key, label, Icon }) => {
          const isActive = key === active
          return (
            <li key={key} className="flex-1">
              <button
                type="button"
                onClick={() => onChange(key)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                  isActive ? 'text-brand-strong' : 'text-ink-faint'
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
