import type { ConnectionStatus } from "@/lib/telemetry/types";

const STATUS_STYLES: Record<
  ConnectionStatus,
  { dot: string; label: string; text: string }
> = {
  idle: {
    dot: "bg-zinc-500",
    label: "Idle",
    text: "text-zinc-400",
  },
  connecting: {
    dot: "bg-amber-400 animate-pulse",
    label: "Connecting",
    text: "text-amber-300",
  },
  connected: {
    dot: "bg-emerald-400",
    label: "Live",
    text: "text-emerald-300",
  },
  disconnected: {
    dot: "bg-orange-400",
    label: "Disconnected",
    text: "text-orange-300",
  },
  error: {
    dot: "bg-red-500",
    label: "Error",
    text: "text-red-300",
  },
};

interface ConnectionBadgeProps {
  status: ConnectionStatus;
  topic: string;
  error?: string | null;
}

export function ConnectionBadge({ status, topic, error }: ConnectionBadgeProps) {
  const style = STATUS_STYLES[status];

  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${style.dot}`} />
        <span className={`text-xs font-medium uppercase tracking-wider ${style.text}`}>
          {style.label}
        </span>
      </div>
      <span className="font-mono text-[11px] text-zinc-500">{topic}</span>
      {error ? (
        <span className="text-xs text-red-400" title={error}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
