"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Loader2, Radio, WifiOff } from "lucide-react";
import type { ConnectionStatus } from "@/lib/telemetry/types";

interface ConnectionBadgeProps {
  status: ConnectionStatus;
  topic: string;
  error?: string | null;
}

const STATUS_MAP: Record<
  ConnectionStatus,
  { label: string; dot: string; text: string; ring: string }
> = {
  idle: { label: "Idle", dot: "bg-ink-faint", text: "text-ink-muted", ring: "ring-edge" },
  connecting: { label: "Connecting", dot: "bg-amber-400", text: "text-amber-500", ring: "ring-amber-500/30" },
  connected: { label: "Live", dot: "bg-emerald-400", text: "text-emerald-500", ring: "ring-emerald-500/30" },
  disconnected: { label: "Disconnected", dot: "bg-ink-faint", text: "text-ink-muted", ring: "ring-edge" },
  error: { label: "Error", dot: "bg-red-500", text: "text-red-500", ring: "ring-red-500/30" },
};

export function ConnectionBadge({ status, topic, error }: ConnectionBadgeProps) {
  const s = STATUS_MAP[status];
  const isConnected = status === "connected";
  const isConnecting = status === "connecting";
  const isError = status === "error";

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-edge bg-panel/60 px-3 py-2 ring-1 ${s.ring}`}
    >
      <div className="relative flex h-3 w-3 items-center justify-center">
        {isConnected && (
          <motion.span
            className="absolute inline-flex h-full w-full rounded-full bg-emerald-400"
            animate={{ scale: [1, 2.2, 1], opacity: [0.7, 0, 0.7] }}
            transition={{ duration: 1.6, repeat: Number.POSITIVE_INFINITY, ease: "easeOut" }}
          />
        )}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${s.dot}`} />
      </div>

      <div className="flex flex-col leading-tight">
        <div className="flex items-center gap-1.5">
          {isConnecting && <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />}
          {isError && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
          {status === "disconnected" && <WifiOff className="h-3.5 w-3.5 text-ink-muted" />}
          {isConnected && <Radio className="h-3.5 w-3.5 text-emerald-500" />}
          <span className={`text-xs font-semibold uppercase tracking-wider ${s.text}`}>{s.label}</span>
        </div>
        <span className="font-mono text-[11px] text-ink-faint">{error && isError ? error : topic}</span>
      </div>
    </div>
  );
}
