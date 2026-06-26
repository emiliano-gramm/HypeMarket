"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Info, X } from "lucide-react"

export function OddsInfoPopover() {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative inline-flex font-sans">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="How odds work"
        className="inline-flex items-center gap-1.5 rounded-lg border border-edge bg-panel-2 px-2.5 py-1 text-xs font-medium text-ink-muted transition-colors hover:border-brand/30 hover:text-ink"
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
        How odds work
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* click-away layer */}
            <button
              type="button"
              aria-hidden="true"
              tabIndex={-1}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-10 cursor-default"
            />
            <motion.div
              role="dialog"
              aria-label="How odds work"
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-edge bg-panel p-4 shadow-xl shadow-black/40"
            >
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-ink">How odds work</h4>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="rounded-md p-0.5 text-ink-faint transition-colors hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
              <p className="text-xs leading-relaxed text-ink-muted">
                {
                  "This is a parimutuel market: every stake goes into one shared pool, and the odds simply reflect how that pool is split across outcomes right now."
                }
              </p>
              <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                {
                  "When the market resolves, the entire pool is paid out to everyone who backed the winning side, proportional to how much they staked."
                }
              </p>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
