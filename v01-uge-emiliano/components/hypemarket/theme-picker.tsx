'use client'

import { Check, Moon, Palette, Sun } from 'lucide-react'
import { useState } from 'react'
import { SKINS } from './theme-config'
import { useTheme } from './theme-provider'

export function ThemePicker() {
  const { skin, mode, setSkin, toggleMode } = useTheme()
  const [open, setOpen] = useState(false)
  const active = SKINS.find((s) => s.id === skin) ?? SKINS[0]

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Choose theme"
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-edge bg-panel px-2 text-ink-muted transition-colors hover:text-ink"
      >
        <Palette className="h-4 w-4" aria-hidden />
        <span
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: active.dot }}
          aria-hidden
        />
      </button>

      {open && (
        <>
          {/* click-away */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-edge bg-panel p-2 shadow-2xl shadow-black/40"
          >
            <div className="flex items-center justify-between px-1.5 py-1">
              <span className="font-display text-xs font-semibold uppercase tracking-wider text-ink-faint">
                Theme
              </span>
              <button
                type="button"
                onClick={toggleMode}
                className="inline-flex items-center gap-1.5 rounded-md border border-edge bg-panel-2 px-2 py-1 text-[11px] font-medium text-ink-muted transition-colors hover:text-ink"
              >
                {mode === 'dark' ? (
                  <Moon className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Sun className="h-3.5 w-3.5" aria-hidden />
                )}
                {mode === 'dark' ? 'Dark' : 'Light'}
              </button>
            </div>

            <div className="mt-1 grid grid-cols-1 gap-1.5">
              {SKINS.map((s) => {
                const selected = s.id === skin
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    onClick={() => setSkin(s.id)}
                    className={`flex items-center gap-3 rounded-lg border p-2 text-left transition-colors ${
                      selected
                        ? 'border-brand/50 bg-brand/10'
                        : 'border-edge hover:bg-panel-2'
                    }`}
                  >
                    {/* mini preview card rendered with the skin's own colors */}
                    <span
                      className="relative flex h-10 w-14 shrink-0 flex-col justify-between overflow-hidden rounded-md p-1"
                      style={{ backgroundColor: s.preview.app }}
                      aria-hidden
                    >
                      <span
                        className="h-3 w-full rounded-sm"
                        style={{ backgroundColor: s.preview.panel }}
                      />
                      <span className="flex items-center gap-1">
                        <span
                          className="h-2 flex-1 rounded-full"
                          style={{ backgroundColor: s.preview.teamAlpha }}
                        />
                        <span
                          className="h-2 flex-1 rounded-full"
                          style={{ backgroundColor: s.preview.teamBravo }}
                        />
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: s.preview.brand }}
                        />
                      </span>
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="font-display text-sm font-semibold text-ink">
                          {s.name}
                        </span>
                        {selected && (
                          <Check
                            className="h-3.5 w-3.5 text-brand-strong"
                            aria-hidden
                          />
                        )}
                      </span>
                      <span className="block truncate text-[11px] text-ink-faint">
                        {s.blurb}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
