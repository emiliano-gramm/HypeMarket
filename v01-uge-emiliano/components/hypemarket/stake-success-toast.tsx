'use client'

import { motion } from 'framer-motion'
import { X } from 'lucide-react'

interface StakeSuccessToastProps {
  message: string
  variant?: 'success' | 'info' | 'error' | 'muted'
  onDismiss: () => void
}

const VARIANT_STYLES = {
  success: 'border-gain/30 bg-gain/10 text-gain',
  info: 'border-brand/30 bg-brand/10 text-brand-strong',
  error: 'border-live/30 bg-live/10 text-live',
  muted: 'border-edge bg-panel-2 text-ink-muted',
}

export function StakeSuccessToast({
  message,
  variant = 'info',
  onDismiss,
}: StakeSuccessToastProps) {
  return (
    <motion.div
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -60, opacity: 0 }}
      transition={{ duration: 0.3 }}
      className={`fixed left-1/2 top-[88px] z-40 -translate-x-1/2 flex max-w-sm items-center justify-between gap-3 rounded-lg border px-4 py-3 font-mono text-sm ${VARIANT_STYLES[variant]}`}
    >
      <span>{message}</span>
      <motion.button
        type="button"
        whileTap={{ scale: 0.9 }}
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded p-1 transition-opacity hover:opacity-70"
      >
        <X className="h-3 w-3" />
      </motion.button>
    </motion.div>
  )
}
